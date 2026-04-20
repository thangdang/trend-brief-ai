import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService, Article } from '../../services/api.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
})
export class SearchComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  query = signal('');
  items = signal<Article[]>([]);
  total = signal(0);
  page = signal(1);
  hasMore = signal(false);
  loading = signal(false);

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => {
      const q = params.get('q') || '';
      this.query.set(q);
      this.items.set([]);
      this.page.set(1);
      if (q) this.doSearch(true);
    });
  }

  loadMore() {
    this.page.update(p => p + 1);
    this.doSearch(false);
  }

  private doSearch(reset: boolean) {
    this.loading.set(true);
    this.api.search(this.query(), undefined, this.page()).subscribe({
      next: (res) => {
        this.items.update(prev => reset ? res.items : [...prev, ...res.items]);
        this.total.set(res.total);
        this.hasMore.set(res.hasMore);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
