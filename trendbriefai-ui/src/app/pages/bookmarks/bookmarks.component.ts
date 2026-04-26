import { Component, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { FeedItem } from '../../types/api.types';

@Component({
  selector: 'app-bookmarks',
  standalone: true,
  templateUrl: './bookmarks.component.html',
  styleUrl: './bookmarks.component.scss',
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
