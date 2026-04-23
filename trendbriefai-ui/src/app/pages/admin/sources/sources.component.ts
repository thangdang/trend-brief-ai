import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-sources',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <h2>📡 Quản lý nguồn tin</h2>

      <div class="add-form">
        <h3>{{ editingId ? 'Sửa nguồn' : 'Thêm nguồn mới' }}</h3>
        <div class="form-row">
          <input placeholder="Tên nguồn" [(ngModel)]="form.name" />
          <input placeholder="URL" [(ngModel)]="form.url" />
          <select [(ngModel)]="form.source_type">
            <option value="rss">RSS</option>
            <option value="html_scrape">HTML Scrape</option>
            <option value="api">API</option>
          </select>
          <input type="number" placeholder="Interval (min)" [(ngModel)]="form.crawl_interval_minutes" />
          <button (click)="save()">{{ editingId ? 'Cập nhật' : 'Thêm' }}</button>
          <button *ngIf="editingId" (click)="cancelEdit()">Hủy</button>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr><th>Tên</th><th>URL</th><th>Loại</th><th>Trạng thái</th><th>Crawl gần nhất</th><th>Thao tác</th></tr>
        </thead>
        <tbody>
          @for (s of sources(); track s._id) {
            <tr>
              <td>{{ s.name }}</td>
              <td class="url-cell">{{ s.url }}</td>
              <td>{{ s.source_type }}</td>
              <td><span [class]="s.is_active ? 'badge-active' : 'badge-inactive'">{{ s.is_active ? 'Active' : 'Inactive' }}</span></td>
              <td>{{ s.last_crawled_at ? (s.last_crawled_at | date:'short') : 'Chưa crawl' }}</td>
              <td class="actions">
                <button (click)="edit(s)">✏️</button>
                <button (click)="toggleActive(s)">{{ s.is_active ? '⏸' : '▶️' }}</button>
                <button (click)="crawlNow(s._id)">🔄 Crawl</button>
                <button (click)="remove(s._id)" class="btn-danger">🗑</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .admin-page { padding: 24px; }
    .add-form { background: #f9f9f9; padding: 16px; border-radius: 12px; margin-bottom: 24px; }
    .form-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .form-row input, .form-row select { padding: 8px; border: 1px solid #ddd; border-radius: 6px; }
    .form-row button { padding: 8px 16px; background: #6366f1; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
    .data-table th { background: #f9f9f9; font-weight: 600; }
    .url-cell { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .actions { display: flex; gap: 4px; }
    .actions button { padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; background: #eee; }
    .btn-danger { color: #ef4444; }
    .badge-active { color: #22c55e; font-weight: 600; }
    .badge-inactive { color: #94a3b8; }
  `],
})
export class SourcesComponent implements OnInit {
  private api = inject(ApiService);
  sources = signal<any[]>([]);
  editingId: string | null = null;
  form: any = { name: '', url: '', source_type: 'rss', crawl_interval_minutes: 10 };

  ngOnInit() { this.load(); }

  load() { this.api.getSources().subscribe(s => this.sources.set(s)); }

  save() {
    const obs = this.editingId
      ? this.api.updateSource(this.editingId, this.form)
      : this.api.createSource(this.form);
    obs.subscribe(() => { this.cancelEdit(); this.load(); });
  }

  edit(s: any) {
    this.editingId = s._id;
    this.form = { name: s.name, url: s.url, source_type: s.source_type, crawl_interval_minutes: s.crawl_interval_minutes };
  }

  cancelEdit() {
    this.editingId = null;
    this.form = { name: '', url: '', source_type: 'rss', crawl_interval_minutes: 10 };
  }

  toggleActive(s: any) {
    this.api.updateSource(s._id, { is_active: !s.is_active }).subscribe(() => this.load());
  }

  crawlNow(id: string) { this.api.triggerCrawl(id).subscribe(); }

  remove(id: string) {
    if (confirm('Xóa nguồn tin này?')) {
      this.api.deleteSource(id).subscribe(() => this.load());
    }
  }
}
