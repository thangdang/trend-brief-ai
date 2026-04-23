import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-newsletter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="newsletter">
      <h3>📬 Nhận tin mỗi sáng</h3>
      <p>Đăng ký nhận tóm tắt tin tức AI mỗi ngày qua email.</p>
      <form (submit)="subscribe($event)" class="form">
        <input type="email" [(ngModel)]="email" name="email" placeholder="Email của bạn" required />
        <button type="submit" [disabled]="submitted()">{{ submitted() ? '✅ Đã đăng ký!' : 'Đăng ký' }}</button>
      </form>
    </div>
  `,
  styles: [`
    .newsletter { background: linear-gradient(135deg, #6366f1, #818cf8); color: #fff; padding: 32px; border-radius: 16px; text-align: center; margin: 32px 0; }
    h3 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0 0 16px; opacity: 0.9; }
    .form { display: flex; gap: 8px; justify-content: center; }
    input { padding: 10px 16px; border: none; border-radius: 8px; font-size: 16px; width: 260px; }
    button { padding: 10px 20px; background: #1a1a2e; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
    button:disabled { opacity: 0.7; }
  `],
})
export class NewsletterComponent {
  email = '';
  submitted = signal(false);

  subscribe(e: Event) {
    e.preventDefault();
    if (!this.email) return;
    // Store in localStorage for now (backend newsletter service can be added later)
    const subs = JSON.parse(localStorage.getItem('newsletter_subs') || '[]');
    subs.push({ email: this.email, date: new Date().toISOString() });
    localStorage.setItem('newsletter_subs', JSON.stringify(subs));
    this.submitted.set(true);
  }
}
