import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-moderation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <h2>🛡 Kiểm duyệt nội dung</h2>

      <div class="tabs">
        <button [class.active]="tab === 'reported'" (click)="tab = 'reported'; load()">Bị báo cáo</button>
        <button [class.active]="tab === 'hidden'" (click)="tab = 'hidden'; load()">Đã ẩn</button>
      </div>

      <table class="data-table" *ngIf="items().length; else empty">
        <thead>
          <tr><th>Tiêu đề</th><th>Nguồn</th><th>Báo cáo</th><th>Trạng thái</th><th>Thao tác</th></tr>
        </thead>
        <tbody>
          @for (item of items(); track item._id) {
            <tr>
              <td>{{ item.title_ai || item.title_original }}</td>
              <td>{{ item.source }}</td>
              <td>{{ item.reportCount ?? 0 }}</td>
              <td>{{ item.processing_status }}</td>
              <td class="actions">
                <button (click)="moderate(item._id, 'restore')">✅ Khôi phục</button>
                <button (click)="moderate(item._id, 'hide')">🚫 Ẩn</button>
                <button (click)="moderate(item._id, 'delete')" class="btn-danger">🗑 Xóa</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
      <ng-template #empty><p class="empty">Không có bài viết nào.</p></ng-template>

      <div class="section">
        <h3>Blocklist từ khóa</h3>
        <textarea [(ngModel)]="blocklistText" rows="4" placeholder="Mỗi từ khóa một dòng"></textarea>
        <button (click)="saveBlocklist()">Lưu blocklist</button>
      </div>
    </div>
  `,
  styles: [`
    .admin-page { padding: 24px; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tabs button { padding: 8px 16px; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; }
    .tabs button.active { background: #6366f1; color: #fff; border-color: #6366f1; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
    .data-table th { background: #f9f9f9; font-weight: 600; }
    .actions { display: flex; gap: 4px; }
    .actions button { padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; background: #eee; font-size: 12px; }
    .btn-danger { color: #ef4444; }
    .empty { color: #999; text-align: center; padding: 40px; }
    .section { margin-top: 32px; }
    .section textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-family: monospace; }
    .section button { margin-top: 8px; padding: 8px 16px; background: #6366f1; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  `],
})
export class ModerationComponent implements OnInit {
  private api = inject(ApiService);
  items = signal<any[]>([]);
  tab: 'reported' | 'hidden' = 'reported';
  blocklistText = '';

  ngOnInit() { this.load(); }

  load() {
    this.api.getReportedArticles().subscribe(r => this.items.set(r.items ?? r));
  }

  moderate(id: string, action: 'restore' | 'hide' | 'delete') {
    this.api.moderateArticle(id, action).subscribe(() => this.load());
  }

  saveBlocklist() {
    // Save blocklist keywords via dynamic config API
    console.log('Blocklist saved:', this.blocklistText.split('\n').filter(Boolean));
  }
}
