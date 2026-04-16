import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header class="app-header">
      <div class="header-title">TrendBrief AI</div>
      <div class="header-actions">
        <button class="btn-logout" (click)="logout()">Đăng xuất</button>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
