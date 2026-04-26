import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-ads',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ads.component.html',
  styleUrl: './ads.component.scss',
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
