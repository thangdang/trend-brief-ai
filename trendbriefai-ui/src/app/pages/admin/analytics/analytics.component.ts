import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent implements OnInit {
  private api = inject(ApiService);

  dau = signal(0);
  mau = signal(0);
  retention = signal(0);
  dailyData = signal<any[]>([]);
  topArticles = signal<any[]>([]);
  adViewability = signal<any[]>([]);
  viewabilityRate = signal(0);
  viewableImpressions = signal(0);
  totalImpressions = signal(0);

  startDate = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  endDate = new Date().toISOString().slice(0, 10);

  ngOnInit() {
    this.loadMetrics();
    this.loadAnalytics();
    this.loadViewability();
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

  loadViewability() {
    this.api.get('/ads').subscribe({
      next: (ads: any) => {
        const adList = Array.isArray(ads) ? ads : [];
        this.adViewability.set(adList);
        const totalImp = adList.reduce((s: number, a: any) => s + (a.impressions || 0), 0);
        const viewableImp = adList.reduce((s: number, a: any) => s + (a.viewable_impressions || 0), 0);
        this.totalImpressions.set(totalImp);
        this.viewableImpressions.set(viewableImp);
        this.viewabilityRate.set(totalImp > 0 ? Math.round((viewableImp / totalImp) * 1000) / 10 : 0);
      },
      error: () => {},
    });
  }
}
