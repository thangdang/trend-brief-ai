import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-page">
      <h2>👥 Quản lý người dùng</h2>

      <table class="data-table">
        <thead>
          <tr><th>Email</th><th>Interests</th><th>Notifications</th><th>Onboarded</th><th>Ngày tạo</th><th>Thao tác</th></tr>
        </thead>
        <tbody>
          @for (u of users(); track u._id) {
            <tr>
              <td>{{ u.email }}</td>
              <td>{{ u.interests?.join(', ') || '—' }}</td>
              <td>{{ u.notifications_enabled ? '✅' : '❌' }}</td>
              <td>{{ u.onboarding_completed ? '✅' : '❌' }}</td>
              <td>{{ u.created_at | date:'shortDate' }}</td>
              <td class="actions">
                <button (click)="ban(u._id)">🚫 Ban</button>
                <button (click)="suspend(u._id)">⏸ Suspend</button>
              </td>
            </tr>
          }
        </tbody>
      </table>

      <div class="pagination" *ngIf="totalPages() > 1">
        <button [disabled]="page === 1" (click)="goPage(page - 1)">← Trước</button>
        <span>Trang {{ page }} / {{ totalPages() }}</span>
        <button [disabled]="page >= totalPages()" (click)="goPage(page + 1)">Sau →</button>
      </div>
    </div>
  `,
  styles: [`
    .admin-page { padding: 24px; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
    .data-table th { background: #f9f9f9; font-weight: 600; }
    .actions { display: flex; gap: 4px; }
    .actions button { padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; background: #eee; font-size: 12px; }
    .pagination { display: flex; gap: 12px; align-items: center; justify-content: center; margin-top: 20px; }
    .pagination button { padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; }
    .pagination button:disabled { opacity: 0.4; cursor: default; }
  `],
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);
  users = signal<any[]>([]);
  totalPages = signal(1);
  page = 1;

  ngOnInit() { this.load(); }

  load() {
    this.api.getUsers(this.page).subscribe(r => {
      this.users.set(r.users ?? r);
      this.totalPages.set(r.totalPages ?? 1);
    });
  }

  goPage(p: number) { this.page = p; this.load(); }
  ban(id: string) { this.api.banUser(id).subscribe(() => this.load()); }
  suspend(id: string) { this.api.suspendUser(id).subscribe(() => this.load()); }
}
