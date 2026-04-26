import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-summarize',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './summarize.component.html',
  styleUrl: './summarize.component.scss',
})
export class SummarizeComponent {
  private http = inject(HttpClient);

  url = '';
  loading = signal(false);
  result = signal<any>(null);
  error = signal('');

  summarize() {
    if (!this.url.trim()) return;
    this.loading.set(true);
    this.result.set(null);
    this.error.set('');

    this.http.post<any>(`${environment.apiUrl}/public/summarize-url`, { url: this.url }).subscribe({
      next: (data) => {
        this.result.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Không thể tóm tắt URL này. Thử lại sau.');
        this.loading.set(false);
      },
    });
  }

  copyResult() {
    const r = this.result();
    if (!r) return;
    const text = `${r.title_ai}\n\n${r.summary_bullets?.map((b: string) => `• ${b}`).join('\n')}\n\n💡 ${r.reason}`;
    navigator.clipboard.writeText(text);
  }

  shareResult() {
    const r = this.result();
    if (!r) return;
    const text = `${r.title_ai}\n\n${r.summary_bullets?.join('\n')}\n\nTóm tắt bởi TrendBrief AI`;
    if (navigator.share) {
      navigator.share({ title: r.title_ai, text });
    } else {
      navigator.clipboard.writeText(text);
    }
  }
}
