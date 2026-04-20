import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  constructor(private http: HttpClient) {}

  getFeed(topic?: string, cursor?: string, limit = 20): Observable<FeedResponse> {
    let params = new HttpParams().set('limit', limit);
    if (topic) params = params.set('topic', topic);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<FeedResponse>(`${this.api}/feed`, { params });
  }

  getArticle(id: string): Observable<Article> {
    return this.http.get<Article>(`${this.api}/articles/${id}`);
  }

  search(q: string, topic?: string, page = 1, limit = 20): Observable<SearchResponse> {
    let params = new HttpParams().set('q', q).set('page', page).set('limit', limit);
    if (topic) params = params.set('topic', topic);
    return this.http.get<SearchResponse>(`${this.api}/search`, { params });
  }

  getTrending(limit = 10): Observable<{ items: Article[] }> {
    return this.http.get<{ items: Article[] }>(`${this.api}/trending`, {
      params: new HttpParams().set('limit', limit),
    });
  }

  getTopics(): Observable<TopicItem[]> {
    return this.http.get<TopicItem[]>(`${this.api}/topics`);
  }
}
