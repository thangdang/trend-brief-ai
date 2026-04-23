import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-affiliates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <h2>🔗 Quản lý Affiliate</h2>

      <div class="add-form">
        <h3>Thêm link affiliate</h3>
        <div class="form-row">
          <input placeholder="Tiêu đề" [(ngModel)]="form.title" />
          <input placeholder="URL" [(ngModel)]="form.url" />
          <select [(ngModel)]="form.topic">
            <option value="ai">AI</option><option value="finance">Finance</option>
            <option value="lifestyle">Lifestyle</option><option value="drama">Drama</option>
          </select>
          <input placeholder="Provider" [(ngModel)]="form.provider" />
          <input placeholder="Commission" [(ngModel)]="form.commission" />
          <button (click)="create()">Thêm</button>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr><th>Tiêu đề</th><th>Provider</th><th>Topic</th><th>Clicks</th><th>Impressions</th><th>Conversions</th><th>Active</th></tr>
        </thead>
        <tbody>
          @for (link of links(); track link._id) {
            <tr>
              <td>{{ link.title }}</td>
              <td>{{ link.provider }}</td>
              <td>{{ link.topic }}</td>
              <td>{{ link.clicks }}</td>
              <td>{{ link.impressions }}</td>
              <td>{{ link.conversions }}</td>
              <td>{{ link.is_active ? '✅' : '❌' }}</td>
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
  `],
})
export class AffiliatesComponent implements OnInit {
  private api = inject(ApiService);
  links = signal<any[]>([]);
  form: any = { title: '', url: '', topic: 'ai', provider: '', commission: '' };

  ngOnInit() { this.load(); }
  load() { this.api.getAffiliates().subscribe(l => this.links.set(l)); }

  create() {
    this.api.createAffiliate(this.form).subscribe(() => {
      this.form = { title: '', url: '', topic: 'ai', provider: '', commission: '' };
      this.load();
    });
  }
}
