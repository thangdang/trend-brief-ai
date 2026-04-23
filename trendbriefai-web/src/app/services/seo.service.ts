import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

const SITE_NAME = 'TrendBrief AI';
const BASE_URL = 'https://trendbriefai.vn';
const DEFAULT_IMAGE = `${BASE_URL}/assets/og-image.png`;
const DEFAULT_DESC = 'Đọc nhanh tin tức Việt Nam trong 30-60 giây. AI tóm tắt 3 điểm chính.';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private doc = inject(DOCUMENT);

  updatePage(opts: {
    title?: string;
    description?: string;
    url?: string;
    image?: string;
    type?: string;
    article?: { publishedAt?: string; section?: string };
  }) {
    const t = opts.title ? `${opts.title} | ${SITE_NAME}` : `${SITE_NAME} — Tin tức AI tóm tắt nhanh cho người Việt`;
    const desc = opts.description || DEFAULT_DESC;
    const url = opts.url ? `${BASE_URL}${opts.url}` : BASE_URL;
    const image = opts.image || DEFAULT_IMAGE;
    const type = opts.type || 'website';

    // Title
    this.title.setTitle(t);

    // Primary meta
    this.meta.updateTag({ name: 'description', content: desc });

    // Canonical
    this.updateCanonical(url);

    // Open Graph
    this.meta.updateTag({ property: 'og:title', content: t });
    this.meta.updateTag({ property: 'og:description', content: desc });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:type', content: type });

    // Twitter
    this.meta.updateTag({ name: 'twitter:title', content: t });
    this.meta.updateTag({ name: 'twitter:description', content: desc });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    // Article-specific
    if (opts.article) {
      if (opts.article.publishedAt) {
        this.meta.updateTag({ property: 'article:published_time', content: opts.article.publishedAt });
      }
      if (opts.article.section) {
        this.meta.updateTag({ property: 'article:section', content: opts.article.section });
      }
    }
  }

  /** Inject JSON-LD Article schema (Task 32.3) */
  setArticleSchema(data: {
    title: string;
    description: string;
    url: string;
    image?: string;
    publishedAt?: string;
    section?: string;
  }) {
    // Remove existing article schema
    const existing = this.doc.querySelector('script[data-schema="article"]');
    if (existing) existing.remove();

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: data.title,
      description: data.description,
      url: `${BASE_URL}${data.url}`,
      image: data.image || DEFAULT_IMAGE,
      datePublished: data.publishedAt || new Date().toISOString(),
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: BASE_URL,
      },
      articleSection: data.section || 'News',
      inLanguage: 'vi',
    };

    const script = this.doc.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'article');
    script.textContent = JSON.stringify(schema);
    this.doc.head.appendChild(script);
  }

  private updateCanonical(url: string) {
    let link: HTMLLinkElement | null = this.doc.querySelector('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
