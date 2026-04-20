import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, TopicItem } from '../services/api.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export class LayoutComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  topics = signal<TopicItem[]>([]);
  searchQuery = '';

  ngOnInit() {
    this.api.getTopics().subscribe({
      next: (t) => this.topics.set(t),
    });
  }

  doSearch() {
    const q = this.searchQuery.trim();
    if (q) this.router.navigate(['/search'], { queryParams: { q } });
  }
}
