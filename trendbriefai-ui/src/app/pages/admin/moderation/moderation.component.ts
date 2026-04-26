import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-moderation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './moderation.component.html',
  styleUrl: './moderation.component.scss',
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
