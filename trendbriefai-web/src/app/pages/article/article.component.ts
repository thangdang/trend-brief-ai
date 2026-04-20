import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService, Article } from '../../services/api.service';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './article.component.html',
  styleUrls: ['./article.component.css'],
})
export class ArticleComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  article = signal<Article | null>(null);
  loading = signal(true);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getArticle(id).subscribe({
      next: (a) => { this.article.set(a); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  share(a: Article) {
    const text = `${a.titleAi}\n\n${a.summaryBullets.join('\n')}\n\n${a.url}`;
    if (navigator.share) {
      navigator.share({ title: a.titleAi, text, url: a.url });
    } else {
      navigator.clipboard.writeText(text);
      alert('Đã copy link!');
    }
  }
}
