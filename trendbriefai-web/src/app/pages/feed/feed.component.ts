import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService, Article } from '../../services/api.service';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.css'],
})
export class FeedComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  topic = signal<string | null>(null);
  items = signal<Article[]>([]);
  trending = signal<Article[]>([]);
  cursor = signal<string | null>(null);
  hasMore = signal(false);
  loading = signal(false);

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const t = params.get('topic');
      this.topic.set(t);
      this.items.set([]);
      this.cursor.set(null);
      this.loadFeed();
    });
    this.api.getTrending(6).subscribe({ next: r => this.trending.set(r.items) });
  }

  loadMore() {
    this.loadFeed();
  }

  private loadFeed() {
    this.loading.set(true);
    this.api.getFeed(this.topic() || undefined, this.cursor() || undefined).subscribe({
      next: (res) => {
        this.items.update(prev => [...prev, ...res.items]);
        this.cursor.set(res.nextCursor);
        this.hasMore.set(res.hasMore);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
