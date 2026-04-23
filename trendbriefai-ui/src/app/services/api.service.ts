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

  // History
  getHistory(page: number = 1): Observable<FeedResponse> {
    const httpParams = new HttpParams().set('page', page.toString());
    return this.http.get<FeedResponse>(`${this.apiUrl}/history`, { params: httpParams });
  }

  // Topics
  getTopics(): Observable<{ topics: Topic[] }> {
    return this.http.get<{ topics: Topic[] }>(`${this.apiUrl}/topics`);
  }

  // ── Admin APIs ─────────────────────────────────────────────────────────────

  // Analytics
  getAnalytics(startDate: string, endDate: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/analytics`, {
      params: new HttpParams().set('startDate', startDate).set('endDate', endDate),
    });
  }
  getDAU(date?: string): Observable<{ date: string; dau: number }> {
    let p = new HttpParams();
    if (date) p = p.set('date', date);
    return this.http.get<{ date: string; dau: number }>(`${this.apiUrl}/analytics/dau`, { params: p });
  }
  getMAU(month?: string): Observable<{ month: string; mau: number }> {
    let p = new HttpParams();
    if (month) p = p.set('month', month);
    return this.http.get<{ month: string; mau: number }>(`${this.apiUrl}/analytics/mau`, { params: p });
  }
  getRetention(cohortDate: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/analytics/retention`, {
      params: new HttpParams().set('cohortDate', cohortDate),
    });
  }
  aggregateAnalytics(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/analytics/aggregate`, {});
  }

  // Sources
  getSources(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/sources`);
  }
  createSource(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/sources`, data);
  }
  updateSource(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/sources/${id}`, data);
  }
  deleteSource(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/sources/${id}`);
  }
  triggerCrawl(id: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/sources/${id}/crawl`, {});
  }

  // Ads
  getAds(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/ads`);
  }
  createAd(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/ads`, data);
  }
  updateAd(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/ads/${id}`, data);
  }

  // Affiliates
  getAffiliates(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/affiliates`);
  }
  createAffiliate(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/affiliates`, data);
  }

  // Notifications (admin)
  sendManualPush(data: { title: string; body: string; topic?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/notifications/send`, data);
  }
  getNotificationLogs(page = 1): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/admin/notifications/logs`, {
      params: new HttpParams().set('page', page.toString()),
    });
  }

  // Users (admin)
  getUsers(page = 1, limit = 20): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/admin/users`, {
      params: new HttpParams().set('page', page.toString()).set('limit', limit.toString()),
    });
  }
  banUser(userId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/users/${userId}/ban`, {});
  }
  suspendUser(userId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/users/${userId}/suspend`, {});
  }

  // Moderation
  getReportedArticles(page = 1): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/admin/moderation`, {
      params: new HttpParams().set('page', page.toString()),
    });
  }
  moderateArticle(id: string, action: 'restore' | 'hide' | 'delete'): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/admin/moderation/${id}/${action}`, {});
  }
}
