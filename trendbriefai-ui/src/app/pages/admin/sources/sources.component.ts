import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-sources',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sources.component.html',
  styleUrl: './sources.component.scss',
})
export class SourcesComponent implements OnInit {
  private api = inject(ApiService);
  sources = signal<any[]>([]);
  healthData = signal<any>(null);
  activeTab = signal<'manage' | 'health'>('manage');
  editingId: string | null = null;
  form: any = { name: '', url: '', source_type: 'rss', crawl_interval_minutes: 10 };

  ngOnInit() { this.load(); this.loadHealth(); }

  load() { this.api.getSources().subscribe(s => this.sources.set(s)); }

  loadHealth() {
    this.api.get('/admin/sources/health').subscribe({
      next: (d: any) => this.healthData.set(d),
      error: () => {},
    });
  }

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
