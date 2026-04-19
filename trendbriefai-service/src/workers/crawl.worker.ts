import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import cron from 'node-cron';
import axios from 'axios';
import { config } from '../config';
import { RssSource } from '../models/RssSource';

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
      try {
        await axios.post(`${config.aiServiceUrl}/crawl`, {
          source_url: source.url,
          source_name: source.name,
          source_type: source.source_type ?? 'rss',
          scrape_link_selector: source.scrape_link_selector ?? null,
        });

        source.last_crawled_at = new Date();
        await source.save();
        processed++;

        await job.updateProgress(Math.round((processed / sources.length) * 100));
        console.log(`[CrawlWorker] Crawled source: ${source.name}`);
      } catch (err: any) {
        console.error(`[CrawlWorker] Failed to crawl source ${source.name}:`, err.message);
      }
    }

    console.log(`[CrawlWorker] Job ${job.id} complete — ${processed}/${sources.length} sources crawled`);
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
