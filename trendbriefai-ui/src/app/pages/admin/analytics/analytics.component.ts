import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <h2>📊 Analytics Dashboard</h2>

      <div class="metrics-row">
        <div class="metric-card">
          <div class="metric-label">DAU</div>
          <div class="metric-value">{{ dau() }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">MAU</div>
          <div class="metric-value">{{ mau() }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">D7 Retention</div>
          <div class="metric-value">{{ retention() }}%</div>
        </div>
      </div>

      <div class="date-range">
        <label>Từ: <input type="date" [(ngModel)]="startDate" (change)="loadAnalytics()" /></label>
        <label>Đến: <input type="date" [(ngModel)]="endDate" (change)="loadAnalytics()" /></label>
        <button (click)="aggregate()">Cập nhật hôm nay</button>
      </div>

      <div class="section">
        <h3>Lượt xem theo ngày</h3>
        <table class="data-table">
          <thead>
            <tr><th>Ngày</th><th>Views</th><th>Users</th><th>Shares</th><th>Bookmarks</th><th>Ad Clicks</th><th>Aff Clicks</th></tr>
          </thead>
          <tbody>
            @for (row of dailyData(); track row.date) {
              <tr>
                <td>{{ row.date }}</td>
                <td>{{ row.total_views }}</td>
                <td>{{ row.unique_users }}</td>
                <td>{{ row.total_shares }}</td>
                <td>{{ row.total_bookmarks }}</td>
                <td>{{ row.ad_clicks }}</td>
                <td>{{ row.affiliate_clicks }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="section" *ngIf="topArticles().length">
        <h3>Top 10 bài viết</h3>
        <table class="data-table">
          <thead><tr><th>#</th><th>Tiêu đề</th><th>Chủ đề</th><th>Views</th></tr></thead>
          <tbody>
            @for (a of topArticles(); track a._id; let i = $index) {
              <tr><td>{{ i + 1 }}</td><td>{{ a.title_ai || a.title_original }}</td><td>{{ a.topic }}</td><td>{{ a.viewCount }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .admin-page { padding: 24px; }
    .metrics-row { display: flex; gap: 16px; margin-bottom: 24px; }
    .metric-card { background: var(--surface, #f5f5f5); border-radius: 12px; padding: 20px; flex: 1; text-align: center; }
    .metric-label { font-size: 14px; color: #666; }
    .metric-value { font-size: 32px; font-weight: 700; margin-top: 4px; }
    .date-range { display: flex; gap: 12px; align-items: center; margin-bottom: 24px; }
    .date-range input { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; }
    .date-range button { padding: 8px 16px; background: #6366f1; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .section { margin-bottom: 32px; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 10px 12px; border-bottom: 1px solid #eee; text-align: left; }
    .data-table th { background: #f9f9f9; font-weight: 600; }
  `],
})
export class AnalyticsComponent implements OnInit {
  private api = inject(ApiService);

  dau = signal(0);
  mau = signal(0);
  retention = signal(0);
  dailyData = signal<any[]>([]);
  topArticles = signal<any[]>([]);

  startDate = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  endDate = new Date().toISOString().slice(0, 10);

  ngOnInit() {
    this.loadMetrics();
    this.loadAnalytics();
  }

  loadMetrics() {
    this.api.getDAU().subscribe(r => this.dau.set(r.dau));
    this.api.getMAU().subscribe(r => this.mau.set(r.mau));
    const cohort = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    this.api.getRetention(cohort).subscribe(r => this.retention.set(r.retentionRate ?? 0));
  }

  loadAnalytics() {
    this.api.getAnalytics(this.startDate, this.endDate).subscribe(data => this.dailyData.set(data));
  }

  aggregate() {
    this.api.aggregateAnalytics().subscribe(() => {
      this.loadMetrics();
      this.loadAnalytics();
    });
  }
}
