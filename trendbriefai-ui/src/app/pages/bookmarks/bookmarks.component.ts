import { Component, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { FeedItem } from '../../types/api.types';

@Component({
  selector: 'app-bookmarks',
  standalone: true,
  template: `
    <div class="bookmarks-page">
      <h1 class="page-title">Bài đã lưu</h1>

      @if (loading() && items().length === 0) {
        <div class="loading">Đang tải...</div>
      }

      <div class="card-grid">
        @for (item of items(); track item.id) {
          <div class="article-card">
            <div class="card-header">
              <span class="badge-topic" [class]="'topic-' + item.topic">{{ item.topic | uppercase }}</span>
              <button class="remove-btn" (click)="removeBookmark(item)" aria-label="Bỏ lưu">✕</button>
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
              <a [href]="item.url" target="_blank" rel="noopener" class="read-link">Đọc full →</a>
            </div>
          </div>
        }
      </div>

      @if (items().length === 0 && !loading()) {
        <div class="empty">Bạn chưa lưu bài viết nào.</div>
      }

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
    .bookmarks-page { max-width: 900px; margin: 0 auto; }
    .page-title { font-size: 22px; font-weight: 700; color: #1e293b; margin-bottom: 20px; }
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
    .remove-btn {
      background: none;
      border: 1px solid #fecaca;
      border-radius: 6px;
      color: #ef4444;
      font-size: 14px;
      width: 30px;
      height: 30px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .remove-btn:hover { background: #fef2f2; }
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
export class BookmarksComponent implements OnInit {
  private api = inject(ApiService);

  items = signal<FeedItem[]>([]);
  page = signal(1);
  hasMore = signal(false);
  loading = signal(false);

  ngOnInit(): void {
    this.loadBookmarks(true);
  }

  loadMore(): void {
    this.page.update(p => p + 1);
    this.loadBookmarks(false);
  }

  removeBookmark(item: FeedItem): void {
    this.api.removeBookmark(item.id).subscribe({
      next: () => this.items.update(list => list.filter(i => i.id !== item.id)),
    });
  }

  private loadBookmarks(reset: boolean): void {
    this.loading.set(true);
    this.api.getBookmarks(this.page()).subscribe({
      next: (res) => {
        this.items.update(prev => reset ? res.items : [...prev, ...res.items]);
        this.hasMore.set(res.hasMore);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
