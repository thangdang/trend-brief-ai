import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ApiService, Article } from '../../services/api.service';
import { SeoService } from '../../services/seo.service';
import { AnalyticsService } from '../../services/analytics.service';

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
  private seo = inject(SeoService);
  private analytics = inject(AnalyticsService);

  article = signal<Article | null>(null);
  loading = signal(true);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getArticle(id).subscribe({
      next: (a) => {
        this.article.set(a);
        this.loading.set(false);
        this.seo.updatePage({
          title: a.titleAi || a.titleOriginal,
          description: a.summaryBullets?.join(' ') || a.titleAi,
          url: `/article/${id}`,
          image: `/api/public/share-image/${id}`,
          type: 'article',
          article: { publishedAt: a.publishedAt, section: a.topic },
        });
        this.analytics.trackArticleView(id, a.titleAi || a.titleOriginal);
        // JSON-LD Article schema (Task 32.3)
        this.seo.setArticleSchema({
          title: a.titleAi || a.titleOriginal,
          description: a.summaryBullets?.join(' ') || '',
          url: `/article/${id}`,
          image: `/api/public/share-image/${id}`,
          publishedAt: a.publishedAt,
          section: a.topic,
        });
      },
      error: () => this.loading.set(false),
    });
  }

  share(a: Article) {
    const text = `${a.titleAi}\n\n${a.summaryBullets.join('\n')}\n\n${a.url}`;
    const method = navigator.share ? 'native' : 'clipboard';
    this.analytics.trackArticleShare(a.id || '', method);
    if (navigator.share) {
      navigator.share({ title: a.titleAi, text, url: a.url });
    } else {
      navigator.clipboard.writeText(text);
      alert('Đã copy link!');
    }
  }

  encodeURI(url: string): string {
    return encodeURIComponent(url);
  }

  copyLink(a: Article) {
    navigator.clipboard.writeText(`https://trendbriefai.vn/article/${a.id}`);
    this.analytics.trackArticleShare(a.id || '', 'copy_link');
    alert('Đã copy link!');
  }
}
