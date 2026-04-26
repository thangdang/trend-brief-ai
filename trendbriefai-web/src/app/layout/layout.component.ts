import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, TopicItem } from '../services/api.service';
import { OnboardingComponent } from '../pages/onboarding/onboarding.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, OnboardingComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  topics = signal<TopicItem[]>([]);
  searchQuery = '';
  isDark = signal(false);
  showOnboarding = signal(false);

  ngOnInit() {
    this.api.getTopics().subscribe({
      next: (t) => this.topics.set(t),
    });

    // Load saved theme preference
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') {
        this.isDark.set(true);
        document.documentElement.setAttribute('data-theme', 'dark');
      } else if (saved === 'light') {
        this.isDark.set(false);
        document.documentElement.setAttribute('data-theme', 'light');
      } else if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        this.isDark.set(true);
      }

      // Show onboarding for first-time visitors
      if (!localStorage.getItem('onboarding_completed')) {
        this.showOnboarding.set(true);
      }
    }
  }

  toggleTheme() {
    const next = this.isDark() ? 'light' : 'dark';
    this.isDark.set(next === 'dark');
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  doSearch() {
    const q = this.searchQuery.trim();
    if (q) this.router.navigate(['/search'], { queryParams: { q } });
  }
}
