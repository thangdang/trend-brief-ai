import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
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
