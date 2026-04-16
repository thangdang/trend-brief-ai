import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { FeedItem, Topic } from '../../types/api.types';

interface TopicTab {
  label: string;
  value: Topic | null;
}

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="feed-page">
      <h1 class="page-title">Bảng tin</h1>

      <!-- Search bar -->
      <div class="search-bar">
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Tìm kiếm bài viết..."
          (keyup.enter)="onSearch()"
        />
        @if (searchQuery) {
          <button class="search-clear" (click)="clearSearch()">✕</button>
        }
        <button class="search-btn" (click)="onSearch()">🔍</button>
      </div>

      @if (isSearchMode()) {
        <div class="search-info">
          Kết quả cho "{{ searchQuery }}"
          <button class="clear-link" (click)="clearSearch()">Xóa tìm kiếm</button>
        </div>
      }

      <!-- Topic filter tabs -->
      @if (!isSearchMode()) {
        <div class="topic-tabs">
          @for (tab of tabs; track tab.label) {
            <button
              class="tab-btn"
              [class.active]="activeTopic() === tab.value"
              (click)="selectTopic(tab.value)"
            >
              {{ tab.label }}
            </button>
          }
        </div>
      }

      <!-- Trending section -->
      @if (!isSearchMode() && trendingItems().length > 0 && activeTopic() === null && page() === 1) {
        <div class="trending-section">
          <h2 class="section-title">🔥 Đang hot</h2>
          <div class="trending-grid">
            @for (item of trendingItems(); track item.id) {
              <div class="trending-card">
                <span class="badge-topic small" [class]="'topic-' + item.topic">{{ item.topic | uppercase }}</span>
                <h4>{{ item.titleAi }}</h4>
                <span class="trending-source">{{ item.source }}</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Loading -->
      @if (loading() && items().length === 0) {
        <div class="loading">Đang tải...</div>
      }

      <!-- Article cards -->
      <div class="card-grid">
        @for (item of items(); track item.id) {
          <div class="article-card">
            <div class="card-header">
              <div class="card-meta">
                <span class="badge-topic" [class]="'topic-' + item.topic">{{ item.topic | uppercase }}</span>
                <span class="reading-time">⏱ {{ item.readingTimeSec }}s đọc</span>
              </div>
              <div class="card-actions">
                <button class="action-btn share-btn" (click)="shareArticle(item)" aria-label="Chia sẻ">↗</button>
                <button class="action-btn bookmark-btn" (click)="toggleBookmark(item)" [attr.aria-label]="item.isBookmarked ? 'Bỏ lưu' : 'Lưu bài'">
                  @if (item.isBookmarked) { ★ } @else { ☆ }
                </button>
              </div>
            </div>
            <h3 class="card-title">{{ item.titleAi }}</h3>
            <ul class="bullets">
              @for (bullet of item.summaryBullets; track $index) {
                <li>{{ bullet }}</li>
              }
            </ul>
            <p class="reason">💡 {{ item.reason }}</p>
            <div class="card-footer">
              <span class="source">{{ item.source }}</span>
              <a [href]="item.url" target="_blank" rel="noopener" class="read-link" (click)="trackClick(item)">Đọc full →</a>
            </div>
          </div>
        }
      </div>

      @if (items().length === 0 && !loading()) {
        <div class="empty">Không có bài viết nào.</div>
      }

      <!-- Pagination -->
      @if (hasMore()) {
        <div class="pagination">
          <button class="load-more-btn" (click)="loadMore()" [disabled]="loading()">
            @if (loading()) { Đang tải... } @else { Tải thêm }
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .feed-page { max-width: 900px; margin: 0 auto; }
    .page-title { font-size: 22px; font-weight: 700; color: #1e293b; margin-bottom: 20px; }
    .search-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      position: relative;
    }
    .search-bar input {
      flex: 1;
      padding: 10px 36px 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-bar input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
    .search-clear {
      position: absolute;
      right: 52px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 14px;
    }
    .search-btn {
      padding: 10px 16px;
      background: #6366f1;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 16px;
    }
    .search-info {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      font-size: 14px;
      color: #64748b;
    }
    .clear-link {
      background: none;
      border: none;
      color: #6366f1;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    .trending-section { margin-bottom: 24px; }
    .section-title { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
    .trending-grid {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
    }
    .trending-card {
      min-width: 200px;
      max-width: 240px;
      background: #fff;
      border-radius: 10px;
      padding: 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      flex-shrink: 0;
    }
    .trending-card h4 {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      margin: 8px 0 6px;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .trending-source { font-size: 11px; color: #94a3b8; }
    .badge-topic.small { font-size: 10px; padding: 2px 6px; }
    .topic-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .tab-btn {
      padding: 8px 18px;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      background: #fff;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-btn:hover { border-color: #6366f1; color: #6366f1; }
    .tab-btn.active { background: #6366f1; color: #fff; border-color: #6366f1; }
    .card-grid { display: flex; flex-direction: column; gap: 16px; }
    .article-card {
      background: #fff;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      transition: box-shadow 0.2s;
    }
    .article-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .card-meta { display: flex; align-items: center; gap: 10px; }
    .reading-time { font-size: 11px; color: #94a3b8; }
    .card-actions { display: flex; gap: 4px; }
    .action-btn {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      line-height: 1;
      padding: 2px 4px;
    }
    .share-btn { color: #6366f1; font-size: 18px; }
    .share-btn:hover { color: #4f46e5; }
    .bookmark-btn { color: #f59e0b; }
    .badge-topic {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .topic-ai { background: #ede9fe; color: #6d28d9; }
    .topic-finance { background: #dcfce7; color: #15803d; }
    .topic-lifestyle { background: #fef3c7; color: #b45309; }
    .topic-drama { background: #fce7f3; color: #be185d; }
    .card-title { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 10px; line-height: 1.4; }
    .bullets { padding-left: 18px; margin-bottom: 10px; }
    .bullets li { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 4px; }
    .reason {
      font-size: 13px;
      color: #6366f1;
      background: #f5f3ff;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .card-footer { display: flex; justify-content: space-between; align-items: center; }
    .source { font-size: 12px; color: #94a3b8; }
    .read-link { font-size: 13px; font-weight: 600; color: #6366f1; text-decoration: none; }
    .read-link:hover { text-decoration: underline; }
    .loading, .empty { text-align: center; padding: 40px; color: #94a3b8; font-size: 15px; }
    .pagination { text-align: center; margin-top: 24px; }
    .load-more-btn {
      padding: 10px 32px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s;
    }
    .load-more-btn:hover { border-color: #6366f1; color: #6366f1; }
    .load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
})
export class FeedComponent implements OnInit {
  private api = inject(ApiService);

  tabs: TopicTab[] = [
    { label: 'Tất cả', value: null },
    { label: 'AI', value: 'ai' },
    { label: 'Tài chính', value: 'finance' },
    { label: 'Đời sống', value: 'lifestyle' },
    { label: 'Drama', value: 'drama' },
  ];

  activeTopic = signal<Topic | null>(null);
  items = signal<FeedItem[]>([]);
  trendingItems = signal<FeedItem[]>([]);
  page = signal(1);
  hasMore = signal(false);
  loading = signal(false);
  isSearchMode = signal(false);
  searchQuery = '';

  ngOnInit(): void {
    this.loadFeed(true);
    this.loadTrending();
  }

  selectTopic(topic: Topic | null): void {
    this.activeTopic.set(topic);
    this.page.set(1);
    this.items.set([]);
    this.isSearchMode.set(false);
    this.searchQuery = '';
    this.loadFeed(true);
  }

  onSearch(): void {
    const q = this.searchQuery.trim();
    if (!q) return;
    this.isSearchMode.set(true);
    this.page.set(1);
    this.items.set([]);
    this.loadSearch(true);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.isSearchMode.set(false);
    this.page.set(1);
    this.items.set([]);
    this.loadFeed(true);
  }

  loadMore(): void {
    this.page.update(p => p + 1);
    if (this.isSearchMode()) {
      this.loadSearch(false);
    } else {
      this.loadFeed(false);
    }
  }

  toggleBookmark(item: FeedItem): void {
    const action$ = item.isBookmarked
      ? this.api.removeBookmark(item.id)
      : this.api.addBookmark(item.id);
    item.isBookmarked = !item.isBookmarked;
    action$.subscribe({ error: () => (item.isBookmarked = !item.isBookmarked) });
  }

  shareArticle(item: FeedItem): void {
    const text = `${item.titleAi}\n\n${item.summaryBullets.join('\n')}\n\n${item.url}`;
    if (navigator.share) {
      navigator.share({ title: item.titleAi, text, url: item.url });
    } else {
      navigator.clipboard.writeText(text);
    }
    this.api.trackInteraction(item.id, 'share').subscribe();
  }

  trackClick(item: FeedItem): void {
    this.api.trackInteraction(item.id, 'click_original').subscribe();
  }

  private loadFeed(reset: boolean): void {
    this.loading.set(true);
    const topic = this.activeTopic() ?? undefined;
    this.api.getFeed({ topic, page: this.page() }).subscribe({
      next: (res) => {
        this.items.update(prev => reset ? res.items : [...prev, ...res.items]);
        this.hasMore.set(res.hasMore);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadSearch(reset: boolean): void {
    this.loading.set(true);
    this.api.searchArticles({ q: this.searchQuery, page: this.page() }).subscribe({
      next: (res) => {
        this.items.update(prev => reset ? res.items : [...prev, ...res.items]);
        this.hasMore.set(res.hasMore);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadTrending(): void {
    this.api.getTrending(5).subscribe({
      next: (res) => this.trendingItems.set(res.items),
    });
  }
}
