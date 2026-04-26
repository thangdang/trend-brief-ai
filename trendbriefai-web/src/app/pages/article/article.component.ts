import { Component, inject, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
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
  styleUrl: './article.component.scss',
})
export class ArticleComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);
  private analytics = inject(AnalyticsService);

  article = signal<Article | null>(null);
  loading = signal(true);
  readingProgress = signal(0);
  relatedArticles = signal<any[]>([]);

  private readStartTime = 0;
  private articleId = '';

  ngOnInit() {
    this.articleId = this.route.snapshot.paramMap.get('id')!;
    this.readStartTime = Date.now();

    this.api.getArticle(this.articleId).subscribe({
      next: (a) => {
        this.article.set(a);
        this.loading.set(false);
        this.seo.updatePage({
          title: a.titleAi || a.titleOriginal,
          description: a.summaryBullets?.join(' ') || a.titleAi,
          url: `/article/${this.articleId}`,
          image: `/api/public/share-image/${this.articleId}`,
          type: 'article',
          article: { publishedAt: a.publishedAt, section: a.topic },
        });
        this.analytics.trackArticleView(this.articleId, a.titleAi || a.titleOriginal);
        this.seo.setArticleSchema({
          title: a.titleAi || a.titleOriginal,
          description: a.summaryBullets?.join(' ') || '',
          url: `/article/${this.articleId}`,
          image: `/api/public/share-image/${this.articleId}`,
          publishedAt: a.publishedAt,
          section: a.topic,
        });
        // Load related articles
        this.loadRelated();
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy() {
    // Track reading time on leave
    if (this.readStartTime && this.articleId) {
      const durationSec = Math.round((Date.now() - this.readStartTime) / 1000);
      if (durationSec >= 3) {
        this.analytics.trackReadingTime(this.articleId, durationSec);
      }
    }
  }

  @HostListener('window:scroll')
  onScroll() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      this.readingProgress.set(Math.min(100, Math.round((scrollTop / docHeight) * 100)));
    }
  }

  private loadRelated() {
    this.api.getRelatedArticles(this.articleId).subscribe({
      next: (articles) => this.relatedArticles.set(articles),
      error: () => {},
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
