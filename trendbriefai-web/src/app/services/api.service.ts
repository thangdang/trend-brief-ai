import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Article {
  id: string;
  titleOriginal: string;
  titleAi: string;
  summaryBullets: string[];
  reason: string;
  url: string;
  topic: string;
  source: string;
  publishedAt: string;
  createdAt: string;
  contentClean?: string;
  sourceLang?: string;
  wasTranslated?: boolean;
  imageUrl?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface FeedResponse {
  items: Article[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SearchResponse {
  items: Article[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface TopicItem {
  _id: string;
  key: string;
  label: string;
  icon: string;
  color: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private api = environment.apiUrl;
  private pendingGets = new Map<string, Observable<any>>();

  constructor(private http: HttpClient) {}

  /** Deduplicated GET — prevents duplicate concurrent requests to the same URL+params. */
  private deduplicatedGet<T>(url: string, params?: HttpParams): Observable<T> {
    const key = url + (params?.toString() || '');
    if (this.pendingGets.has(key)) return this.pendingGets.get(key)! as Observable<T>;
    const req$ = this.http.get<T>(url, { params }).pipe(
      shareReplay(1),
      finalize(() => this.pendingGets.delete(key)),
    );
    this.pendingGets.set(key, req$);
    return req$;
  }

  getFeed(topic?: string, cursor?: string, limit = 20): Observable<FeedResponse> {
    let params = new HttpParams().set('limit', limit);
    if (topic) params = params.set('topic', topic);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<FeedResponse>(`${this.api}/feed`, { params });
  }

  getArticle(id: string): Observable<Article> {
    return this.http.get<Article>(`${this.api}/articles/${id}`);
  }

  getRelatedArticles(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/articles/${id}/related`);
  }

  search(q: string, topic?: string, page = 1, limit = 20): Observable<SearchResponse> {
    let params = new HttpParams().set('q', q).set('page', page).set('limit', limit);
    if (topic) params = params.set('topic', topic);
    return this.http.get<SearchResponse>(`${this.api}/search`, { params });
  }

  getTrending(limit = 10): Observable<{ items: Article[] }> {
    const params = new HttpParams().set('limit', limit);
    return this.deduplicatedGet<{ items: Article[] }>(`${this.api}/trending`, params);
  }

  getTopics(): Observable<TopicItem[]> {
    return this.deduplicatedGet<TopicItem[]>(`${this.api}/topics`);
  }

  rateSummary(articleId: string, rating: 'up' | 'down'): Observable<any> {
    return this.http.post(`${this.api}/feedback`, { articleId, rating });
  }
}
