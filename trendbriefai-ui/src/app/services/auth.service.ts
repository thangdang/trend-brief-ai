import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthTokens, UserProfile } from '../types/api.types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly accessTokenKey = 'tb_access_token';
  private readonly refreshTokenKey = 'tb_refresh_token';

  private _isLoggedIn = signal(this.hasToken());
  readonly isLoggedIn = this._isLoggedIn.asReadonly();

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(`${this.apiUrl}/auth/login`, { email, password })
      .pipe(tap(tokens => this.storeTokens(tokens)));
  }

  register(email: string, password: string): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(`${this.apiUrl}/auth/register`, { email, password })
      .pipe(tap(tokens => this.storeTokens(tokens)));
  }

  refreshToken(): Observable<AuthTokens> {
    const refreshToken = localStorage.getItem(this.refreshTokenKey);
    return this.http
      .post<AuthTokens>(`${this.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(tap(tokens => this.storeTokens(tokens)));
  }

  logout(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    this._isLoggedIn.set(false);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(this.accessTokenKey, tokens.accessToken);
    localStorage.setItem(this.refreshTokenKey, tokens.refreshToken);
    this._isLoggedIn.set(true);
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.accessTokenKey);
  }
}
