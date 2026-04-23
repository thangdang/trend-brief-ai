import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-ads',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <h2>📢 Quản lý quảng cáo</h2>

      <div class="add-form">
        <h3>{{ editingId ? 'Sửa quảng cáo' : 'Tạo quảng cáo mới' }}</h3>
        <div class="form-grid">
          <input placeholder="Tiêu đề" [(ngModel)]="form.title" />
          <input placeholder="Mô tả" [(ngModel)]="form.description" />
          <input placeholder="Image URL" [(ngModel)]="form.image_url" />
          <input placeholder="Target URL" [(ngModel)]="form.target_url" />
          <input placeholder="Advertiser" [(ngModel)]="form.advertiser" />
          <select [(ngModel)]="form.topic">
            <option value="ai">AI</option><option value="finance">Finance</option>
            <option value="lifestyle">Lifestyle</option><option value="drama">Drama</option>
          </select>
          <input type="date" [(ngModel)]="form.start_date" />
          <input type="date" [(ngModel)]="form.end_date" />
          <input type="number" placeholder="Budget (cents)" [(ngModel)]="form.budget_cents" />
          <div>
            <button (click)="save()">{{ editingId ? 'Cập nhật' : 'Tạo' }}</button>
            <button *ngIf="editingId" (click)="cancelEdit()">Hủy</button>
          </div>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr><th>Tiêu đề</th><th>Topic</th><th>Status</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Budget</th><th>Thao tác</th></tr>
        </thead>
        <tbody>
          @for (ad of ads(); track ad._id) {
            <tr>
              <td>{{ ad.title }}</td>
              <td>{{ ad.topic }}</td>
              <td><span [class]="'badge-' + ad.status">{{ ad.status }}</span></td>
              <td>{{ ad.impressions }}</td>
              <td>{{ ad.clicks }}</td>
              <td>{{ ad.impressions ? ((ad.clicks / ad.impressions) * 100).toFixed(1) + '%' : '0%' }}</td>
              <td>{{ (ad.spent_cents / 100).toFixed(0) }}/{{ (ad.budget_cents / 100).toFixed(0) }}$</td>
              <td><button (click)="edit(ad)">✏️</button></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .admin-page { padding: 24px; }
    .add-form { background: #f9f9f9; padding: 16px; border-radius: 12px; margin-bottom: 24px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .form-grid input, .form-grid select { padding: 8px; border: 1px solid #ddd; border-radius: 6px; }
    .form-grid button { padding: 8px 16px; background: #6366f1; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
    .data-table th { background: #f9f9f9; font-weight: 600; }
    .badge-active { color: #22c55e; } .badge-paused { color: #f59e0b; } .badge-expired { color: #94a3b8; }
  `],
})
export class AdsComponent implements OnInit {
  private api = inject(ApiService);
  ads = signal<any[]>([]);
  editingId: string | null = null;
  form: any = { title: '', description: '', image_url: '', target_url: '', advertiser: '', topic: 'ai', start_date: '', end_date: '', budget_cents: 0 };

  ngOnInit() { this.load(); }
  load() { this.api.getAds().subscribe(a => this.ads.set(a)); }

  save() {
    const obs = this.editingId ? this.api.updateAd(this.editingId, this.form) : this.api.createAd(this.form);
    obs.subscribe(() => { this.cancelEdit(); this.load(); });
  }

  edit(ad: any) {
    this.editingId = ad._id;
    this.form = { ...ad, start_date: ad.start_date?.slice(0, 10), end_date: ad.end_date?.slice(0, 10) };
  }

  cancelEdit() {
    this.editingId = null;
    this.form = { title: '', description: '', image_url: '', target_url: '', advertiser: '', topic: 'ai', start_date: '', end_date: '', budget_cents: 0 };
  }
}
