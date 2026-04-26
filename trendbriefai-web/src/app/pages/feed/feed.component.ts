import { Component, inject, OnInit, OnDestroy, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService, Article } from '../../services/api.service';
import { SeoService } from '../../services/seo.service';

const TOPIC_LABELS: Record<string, string> = {
  ai: 'AI & Trí tuệ nhân tạo', finance: 'Tài chính', lifestyle: 'Đời sống',
  drama: 'Drama', technology: 'Công nghệ', career: 'Sự nghiệp',
  health: 'Sức khỏe', entertainment: 'Giải trí', sport: 'Thể thao', insight: 'Insight',
};

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss',
})
export class FeedComponent implements OnInit, OnDestroy, AfterViewInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);

  topic = signal<string | null>(null);
  items = signal<Article[]>([]);
  trending = signal<Article[]>([]);
  cursor = signal<string | null>(null);
  hasMore = signal(true);
  loading = signal(false);
  error = signal(false);
  showScrollTop = signal(false);
  tooltipItem = signal<Article | null>(null);
  tooltipPos = signal<{ top: number; left: number } | null>(null);
  private _tooltipTimer: any = null;
  private _isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window);
  private _ratedArticles = new Set<string>();

  @ViewChild('sentinel') sentinelRef!: ElementRef;
  private observer: IntersectionObserver | null = null;
  private _adObserver: IntersectionObserver | null = null;
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const t = params.get('topic');
      this.topic.set(t);
      this.items.set([]);
      this.cursor.set(null);
      this.hasMore.set(true);
      if (t) {
        const label = TOPIC_LABELS[t] || t.toUpperCase();
        this.seo.updatePage({
          title: `${label} — Tin tức mới nhất`,
          description: `Tin tức ${label} mới nhất, AI tóm tắt nhanh trong 30-60 giây.`,
          url: `/topic/${t}`,
        });
      } else {
        this.seo.updatePage({ url: '/feed' });
      }
      this.loadFeed();
    });
    this.api.getTrending(6).subscribe({ next: r => this.trending.set(r.items) });

    // Scroll-to-top button visibility
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this._onScroll);
    }

    // Keyboard navigation (arrow keys + Enter)
    if (typeof document !== 'undefined') {
      this._keyHandler = (e: KeyboardEvent) => {
        const cards = document.querySelectorAll<HTMLElement>('.articles .card');
        if (!cards.length) return;
        const focused = document.querySelector<HTMLElement>('.card.kb-focus');
        const idx = focused ? Array.from(cards).indexOf(focused) : -1;

        if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          focused?.classList.remove('kb-focus');
          const next = cards[Math.min(idx + 1, cards.length - 1)];
          next.classList.add('kb-focus');
          next.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          focused?.classList.remove('kb-focus');
          const prev = cards[Math.max(idx - 1, 0)];
          prev.classList.add('kb-focus');
          prev.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } else if (e.key === 'Enter' && focused) {
          const link = focused.querySelector<HTMLAnchorElement>('.card-title');
          link?.click();
        }
      };
      document.addEventListener('keydown', this._keyHandler);
    }
  }

  ngAfterViewInit() {
    this._setupInfiniteScroll();
    this._setupAdViewability();
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this._adObserver?.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._onScroll);
    }
    if (this._keyHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }

  showTooltip(item: Article, event: MouseEvent) {
    if (this._isTouchDevice) return;
    this._tooltipTimer = setTimeout(() => {
      const rect = (event.target as HTMLElement).closest('.card')?.getBoundingClientRect();
      if (rect) {
        const top = rect.top > 300 ? rect.top - 120 : rect.bottom + 8;
        this.tooltipPos.set({ top, left: rect.left });
        this.tooltipItem.set(item);
      }
    }, 500);
  }

  hideTooltip() {
    clearTimeout(this._tooltipTimer);
    this.tooltipItem.set(null);
    this.tooltipPos.set(null);
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private _onScroll = () => {
    this.showScrollTop.set(window.scrollY > window.innerHeight * 2);
  };

  private _setupAdViewability() {
    if (typeof IntersectionObserver === 'undefined') return;
    this._adObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            (el as any)._viewTimer = setTimeout(() => {
              const adId = el.dataset['adId'];
              if (adId) {
                fetch('/api/ads/viewable', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ad_id: adId,
                    visible_duration_ms: 1000,
                    viewport_percentage: Math.round(entry.intersectionRatio * 100),
                  }),
                }).catch(() => {});
              }
            }, 1000);
          } else {
            clearTimeout((el as any)._viewTimer);
          }
        });
      },
      { threshold: 0.5 },
    );
    // Observe ad cards after render
    setTimeout(() => {
      document.querySelectorAll('[data-ad-id]').forEach(el => {
        this._adObserver!.observe(el);
      });
    }, 500);
  }

  private _setupInfiniteScroll() {
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !this.loading() && this.hasMore()) {
          this.loadFeed();
        }
      },
      { rootMargin: '200px' },
    );

    // Observe after a tick (sentinel may not be in DOM yet)
    setTimeout(() => {
      if (this.sentinelRef?.nativeElement) {
        this.observer!.observe(this.sentinelRef.nativeElement);
      }
    }, 100);
  }

  private loadFeed() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.api.getFeed(this.topic() || undefined, this.cursor() || undefined).subscribe({
      next: (res) => {
        this.items.update(prev => [...prev, ...res.items]);
        this.cursor.set(res.nextCursor);
        this.hasMore.set(res.hasMore);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  retryLoad() {
    this.error.set(false);
    this.loadFeed();
  }

  rateSummary(articleId: string, rating: 'up' | 'down') {
    if (this._ratedArticles.has(articleId)) return;
    this._ratedArticles.add(articleId);
    this.api.rateSummary(articleId, rating).subscribe({ error: () => this._ratedArticles.delete(articleId) });
  }
}
