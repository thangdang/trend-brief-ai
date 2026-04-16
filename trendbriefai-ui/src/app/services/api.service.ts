import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  FeedResponse,
  FeedItem,
  Topic,
  UserProfile,
  InteractionAction,
} from '../types/api.types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Feed
  getFeed(params: { topic?: Topic; page?: number; limit?: number }): Observable<FeedResponse> {
    let httpParams = new HttpParams();
    if (params.topic) httpParams = httpParams.set('topic', params.topic);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this.http.get<FeedResponse>(`${this.apiUrl}/feed`, { params: httpParams });
  }

  getArticle(id: string): Observable<FeedItem> {
    return this.http.get<FeedItem>(`${this.apiUrl}/articles/${id}`);
  }

  // Bookmarks
  addBookmark(articleId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/bookmarks`, { articleId });
  }

  removeBookmark(articleId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/bookmarks/${articleId}`);
  }

  getBookmarks(page?: number): Observable<FeedResponse> {
    let httpParams = new HttpParams();
    if (page) httpParams = httpParams.set('page', page.toString());
    return this.http.get<FeedResponse>(`${this.apiUrl}/bookmarks`, { params: httpParams });
  }

  // Interactions
  trackInteraction(articleId: string, action: InteractionAction): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/interactions`, { articleId, action });
  }

  // User
  updateInterests(topics: Topic[]): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.apiUrl}/users/interests`, { interests: topics });
  }

  // Search
  searchArticles(params: { q: string; topic?: Topic; page?: number; limit?: number }): Observable<FeedResponse> {
    let httpParams = new HttpParams().set('q', params.q);
    if (params.topic) httpParams = httpParams.set('topic', params.topic);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    return this.http.get<FeedResponse>(`${this.apiUrl}/search`, { params: httpParams });
  }

  // Trending
  getTrending(limit: number = 10): Observable<{ items: FeedItem[] }> {
    const httpParams = new HttpParams().set('limit', limit.toString());
    return this.http.get<{ items: FeedItem[] }>(`${this.apiUrl}/trending`, { params: httpParams });
  }

  // Topics
  getTopics(): Observable<{ topics: Topic[] }> {
    return this.http.get<{ topics: Topic[] }>(`${this.apiUrl}/topics`);
  }
}
