import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <h2>🔔 Quản lý thông báo</h2>

      <div class="send-form">
        <h3>Gửi thông báo thủ công</h3>
        <div class="form-row">
          <input placeholder="Tiêu đề" [(ngModel)]="pushForm.title" />
          <input placeholder="Nội dung" [(ngModel)]="pushForm.body" />
          <input placeholder="Topic (optional)" [(ngModel)]="pushForm.topic" />
          <button (click)="sendPush()" [disabled]="sending()">{{ sending() ? 'Đang gửi...' : 'Gửi push' }}</button>
        </div>
        <p *ngIf="sendResult()" class="result">{{ sendResult() }}</p>
      </div>

      <div class="section">
        <h3>Lịch sử gửi</h3>
        <table class="data-table">
          <thead>
            <tr><th>Loại</th><th>User</th><th>Article</th><th>Gửi lúc</th><th>Delivered</th><th>Opened</th></tr>
          </thead>
          <tbody>
            @for (log of logs(); track log._id) {
              <tr>
                <td>{{ log.type }}</td>
                <td>{{ log.user_id }}</td>
                <td>{{ log.article_id?.title_ai || log.article_id }}</td>
                <td>{{ log.sent_at | date:'short' }}</td>
                <td>{{ log.delivered_at ? (log.delivered_at | date:'short') : '—' }}</td>
                <td>{{ log.opened_at ? (log.opened_at | date:'short') : '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
        <button *ngIf="hasMore()" (click)="loadMore()">Tải thêm</button>
      </div>
    </div>
  `,
  styles: [`
    .admin-page { padding: 24px; }
    .send-form { background: #f9f9f9; padding: 16px; border-radius: 12px; margin-bottom: 24px; }
    .form-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .form-row input { padding: 8px; border: 1px solid #ddd; border-radius: 6px; flex: 1; }
    .form-row button { padding: 8px 16px; background: #6366f1; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .form-row button:disabled { opacity: 0.5; }
    .result { color: #22c55e; margin-top: 8px; }
    .section { margin-top: 24px; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
    .data-table th { background: #f9f9f9; font-weight: 600; }
    .section > button { margin-top: 12px; padding: 8px 16px; background: #eee; border: none; border-radius: 6px; cursor: pointer; }
  `],
})
export class NotificationsComponent implements OnInit {
  private api = inject(ApiService);
  logs = signal<any[]>([]);
  sending = signal(false);
  sendResult = signal('');
  hasMore = signal(false);
  page = 1;
  pushForm = { title: '', body: '', topic: '' };

  ngOnInit() { this.loadLogs(); }

  loadLogs() {
    this.api.getNotificationLogs(this.page).subscribe(r => {
      this.logs.set(r.logs ?? r);
      this.hasMore.set(r.page < r.totalPages);
    });
  }

  loadMore() {
    this.page++;
    this.api.getNotificationLogs(this.page).subscribe(r => {
      this.logs.update(prev => [...prev, ...(r.logs ?? r)]);
      this.hasMore.set(r.page < r.totalPages);
    });
  }

  sendPush() {
    this.sending.set(true);
    this.sendResult.set('');
    this.api.sendManualPush(this.pushForm).subscribe({
      next: () => {
        this.sendResult.set('Đã gửi thành công!');
        this.sending.set(false);
        this.pushForm = { title: '', body: '', topic: '' };
        this.loadLogs();
      },
      error: () => {
        this.sendResult.set('Gửi thất bại.');
        this.sending.set(false);
      },
    });
  }
}
