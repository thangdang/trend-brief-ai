import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private router = inject(Router);
  private measurementId = environment.gaMeasurementId;

  /**
   * Load the gtag.js script dynamically and subscribe to router events
   * for automatic page/screen view tracking.
   */
  init(): void {
    this.loadGtagScript();

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.trackScreenView(e.urlAfterRedirects);
      });
  }

  /** Track a screen/page view (matches mobile screen_view event). */
  trackScreenView(screenName: string): void {
    this.gtag('event', 'screen_view', {
      screen_name: screenName,
      page_path: screenName,
      send_to: this.measurementId,
    });
  }

  /** Track when a user views an article. */
  trackArticleView(articleId: string, title: string): void {
    this.gtag('event', 'article_view', {
      article_id: articleId,
      article_title: title,
    });
  }

  /** Track when a user shares an article. */
  trackArticleShare(articleId: string, method: string): void {
    this.gtag('event', 'article_share', {
      article_id: articleId,
      share_method: method,
    });
  }

  /** Track when a user bookmarks an article. */
  trackBookmarkAdd(articleId: string): void {
    this.gtag('event', 'bookmark_add', {
      article_id: articleId,
    });
  }

  /** Dynamically inject the gtag.js script using the configured measurement ID. */
  private loadGtagScript(): void {
    if (typeof document === 'undefined' || !this.measurementId) {
      return;
    }

    // Avoid duplicate script injection
    if (document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
      // Script already present (e.g. from index.html), just reconfigure
      this.configureGtag();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
    document.head.appendChild(script);

    this.configureGtag();
  }

  private configureGtag(): void {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function (...args: unknown[]) {
      window.dataLayer.push(args);
    };
    window.gtag('js', new Date());
    window.gtag('config', this.measurementId, { send_page_view: false });
  }

  private gtag(...args: unknown[]): void {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag(...args);
    }
  }
}
