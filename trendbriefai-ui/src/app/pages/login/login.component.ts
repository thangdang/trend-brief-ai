import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-brand">🔥 TrendBrief AI</div>
        <h2>Đăng nhập</h2>
        <p class="auth-sub">Chào mừng bạn quay lại</p>

        @if (error()) {
          <div class="alert-error">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="email">Email</label>
            <input id="email" type="email" formControlName="email" placeholder="you@example.com" />
            @if (form.controls.email.touched && form.controls.email.errors) {
              <span class="field-error">Email không hợp lệ</span>
            }
          </div>

          <div class="form-group">
            <label for="password">Mật khẩu</label>
            <input id="password" type="password" formControlName="password" placeholder="••••••••" />
            @if (form.controls.password.touched && form.controls.password.errors) {
              <span class="field-error">Mật khẩu tối thiểu 6 ký tự</span>
            }
          </div>

          <button type="submit" class="btn-primary" [disabled]="loading()">
            @if (loading()) { Đang xử lý... } @else { Đăng nhập }
          </button>
        </form>

        <p class="auth-footer">
          Chưa có tài khoản? <a routerLink="/register">Đăng ký ngay</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .auth-card {
      background: #fff;
      border-radius: 12px;
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    }
    .auth-brand {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 24px;
      color: #6366f1;
    }
    h2 { font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
    .auth-sub { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    .form-group { margin-bottom: 18px; }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
    }
    .form-group input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
      outline: none;
      box-sizing: border-box;
    }
    .form-group input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
    .field-error { color: #ef4444; font-size: 12px; margin-top: 4px; display: block; }
    .alert-error {
      background: #fef2f2;
      color: #dc2626;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      border: 1px solid #fecaca;
    }
    .btn-primary {
      width: 100%;
      padding: 12px;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-primary:hover { background: #4f46e5; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .auth-footer {
      text-align: center;
      margin-top: 20px;
      font-size: 13px;
      color: #64748b;
    }
    .auth-footer a { color: #6366f1; font-weight: 600; }
  `],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/feed']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Đăng nhập thất bại');
      },
    });
  }
}
