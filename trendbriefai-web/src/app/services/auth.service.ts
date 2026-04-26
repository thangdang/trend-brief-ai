import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthWebService {
  private authApi = (environment as any).authApiUrl || '/api';
  private _isLoggedIn = new BehaviorSubject<boolean>(!!localStorage.getItem('token'));

  isLoggedIn$ = this._isLoggedIn.asObservable();

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.authApi}/auth/login`, { email, password }).pipe(
      tap((res: any) => this.saveTokens(res))
    );
  }

  register(email: string, password: string): Observable<any> {
    return this.http.post(`${this.authApi}/auth/register`, { email, password }).pipe(
      tap((res: any) => this.saveTokens(res))
    );
  }

  googleLogin(idToken: string): Observable<any> {
    return this.http.post(`${this.authApi}/auth/google`, { idToken }).pipe(
      tap((res: any) => this.saveTokens(res))
    );
  }

  appleLogin(idToken: string, user?: { name?: string }): Observable<any> {
    return this.http.post(`${this.authApi}/auth/apple`, { idToken, user }).pipe(
      tap((res: any) => this.saveTokens(res))
    );
  }

  getPlans(): Observable<any> {
    return this.http.get(`${this.authApi}/payment/plans`);
  }

  createPayment(plan: string, method: string): Observable<any> {
    return this.http.post(`${this.authApi}/payment/create`, { plan, method });
  }

  getSubscription(): Observable<any> {
    return this.http.get(`${this.authApi}/payment/subscription`);
  }

  cancelSubscription(): Observable<any> {
    return this.http.post(`${this.authApi}/payment/cancel`, {});
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    this._isLoggedIn.next(false);
  }

  private saveTokens(res: any) {
    const token = res.accessToken || res.token;
    if (token) localStorage.setItem('token', token);
    if (res.refreshToken) localStorage.setItem('refreshToken', res.refreshToken);
    this._isLoggedIn.next(true);
  }
}
