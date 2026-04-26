import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import cron from 'node-cron';
import axios from 'axios';
import { config } from '../config';
import { RssSource } from '../models/RssSource';
import { aiEngineBreaker } from '../middleware/circuitBreaker';

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const crawlQueue = new Queue('crawl', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

const crawlWorker = new Worker(
  'crawl',
  async (job: Job) => {
    console.log(`[CrawlWorker] Processing job ${job.id}`);

    const sources = await RssSource.find({ is_active: true });
    console.log(`[CrawlWorker] Found ${sources.length} active RSS sources`);

    let processed = 0;
    for (const source of sources) {
      // Skip auto-disabled sources
      if (source.health?.auto_disabled && source.health.disabled_until && source.health.disabled_until > new Date()) {
        console.log(`[CrawlWorker] Skipping auto-disabled source: ${source.name} (until ${source.health.disabled_until.toISOString()})`);
        continue;
      }
      // Re-enable if cooldown expired
      if (source.health?.auto_disabled && source.health.disabled_until && source.health.disabled_until <= new Date()) {
        source.health.auto_disabled = false;
        source.health.disabled_until = undefined;
        source.health.consecutive_failures = 0;
        await source.save();
        console.log(`[CrawlWorker] Re-enabled source: ${source.name}`);
      }

      try {
        await aiEngineBreaker.exec(
          () => axios.post(`${config.aiServiceUrl}/crawl`, {
            source_url: source.url,
            source_name: source.name,
            source_type: source.source_type ?? 'rss',
            scrape_link_selector: source.scrape_link_selector ?? null,
          }, { timeout: 120000 }),
          () => {
            console.log(`[CrawlWorker] Circuit open — skipping ${source.name}`);
            return { data: { new: 0, duplicate: 0, failed: 0 } };
          },
        );

        // Health: record success
        source.last_crawled_at = new Date();
        if (!source.health) source.health = { success_count_24h: 0, total_count_24h: 0, success_rate: 1, consecutive_failures: 0, auto_disabled: false };
        source.health.success_count_24h++;
        source.health.total_count_24h++;
        source.health.consecutive_failures = 0;
        source.health.last_successful_at = new Date();
        source.health.success_rate = source.health.success_count_24h / Math.max(source.health.total_count_24h, 1);
        await source.save();
        processed++;

        await job.updateProgress(Math.round((processed / sources.length) * 100));
        console.log(`[CrawlWorker] Crawled source: ${source.name} (health: ${(source.health.success_rate * 100).toFixed(0)}%)`);
      } catch (err: any) {
        // Health: record failure
        if (!source.health) source.health = { success_count_24h: 0, total_count_24h: 0, success_rate: 1, consecutive_failures: 0, auto_disabled: false };
        source.health.total_count_24h++;
        source.health.consecutive_failures++;
        source.health.last_error = err.message?.slice(0, 200);
        source.health.success_rate = source.health.success_count_24h / Math.max(source.health.total_count_24h, 1);

        // Auto-disable if success rate < 10%
        if (source.health.total_count_24h >= 5 && source.health.success_rate < 0.1) {
          source.health.auto_disabled = true;
          source.health.disabled_until = new Date(Date.now() + 24 * 60 * 60 * 1000);
          console.warn(`[CrawlWorker] Auto-disabled source: ${source.name} (success_rate: ${(source.health.success_rate * 100).toFixed(0)}%)`);
        }
        // Alert on 5 consecutive failures
        if (source.health.consecutive_failures >= 5) {
          console.warn(`[CrawlWorker] ⚠️ Source ${source.name} has ${source.health.consecutive_failures} consecutive failures`);
        }

        await source.save();
        console.error(`[CrawlWorker] Failed to crawl source ${source.name}:`, err.message);
      }
    }

    console.log(`[CrawlWorker] Job ${job.id} complete — ${processed}/${sources.length} sources crawled (circuit: ${aiEngineBreaker.getStatus().state})`);
    return { processed, total: sources.length };
  },
  { connection, concurrency: 1 },
);

crawlWorker.on('failed', (job, err) => {
  console.error(`[CrawlWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

crawlWorker.on('completed', (job) => {
  console.log(`[CrawlWorker] Job ${job.id} completed successfully`);
});

export function startCrawlScheduler(): void {
  console.log(`[CrawlScheduler] Scheduling crawl every ${config.crawlIntervalMinutes} minutes`);

  cron.schedule(`*/${config.crawlIntervalMinutes} * * * *`, async () => {
    try {
      await crawlQueue.add('scheduled-crawl', {}, { jobId: `crawl-${Date.now()}` });
      console.log('[CrawlScheduler] Enqueued scheduled crawl job');
    } catch (err: any) {
      console.error('[CrawlScheduler] Failed to enqueue crawl job:', err.message);
    }
  });

  // Fire an initial crawl on startup
  crawlQueue.add('initial-crawl', {}, { jobId: `crawl-init-${Date.now()}` }).then(() => {
    console.log('[CrawlScheduler] Enqueued initial crawl job');
  }).catch((err) => {
    console.error('[CrawlScheduler] Failed to enqueue initial crawl:', err.message);
  });

  // Weekly resource discovery — every Sunday 3:00 AM
  cron.schedule('0 3 * * 0', async () => {
    console.log('[CrawlScheduler] Running weekly resource discovery...');
    try {
      const resp = await axios.post(`${config.aiServiceUrl}/discover`, {}, { timeout: 300000 });
      const data = resp.data;
      console.log(`[CrawlScheduler] Discovery complete: ${data.discovered} found, ${data.stored} stored`);
      if (data.sources?.length > 0) {
        console.log('[CrawlScheduler] New sources (pending admin review):');
        for (const s of data.sources) {
          console.log(`  - ${s.name} (${s.domain}) [${s.source_type}] quality=${s.quality} via=${s.via.join(',')}`);
        }
      }
    } catch (err: any) {
      console.error('[CrawlScheduler] Discovery failed:', err.message);
    }
  });
  console.log('[CrawlScheduler] Weekly resource discovery scheduled: Sunday 3:00 AM');
}
