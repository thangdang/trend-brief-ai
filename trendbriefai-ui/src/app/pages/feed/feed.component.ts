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
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss',
})
export class FeedComponent implements OnInit {
  private api = inject(ApiService);

  tabs: TopicTab[] = [
    { label: 'Tất cả', value: null },
    { label: 'AI', value: 'ai' },
    { label: 'Tài chính', value: 'finance' },
    { label: 'Đời sống', value: 'lifestyle' },
    { label: 'Drama', value: 'drama' },
    { label: 'Công nghệ', value: 'technology' },
    { label: 'Sự nghiệp', value: 'career' },
    { label: 'Sức khỏe', value: 'health' },
    { label: 'Giải trí', value: 'entertainment' },
    { label: 'Thể thao', value: 'sport' },
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
