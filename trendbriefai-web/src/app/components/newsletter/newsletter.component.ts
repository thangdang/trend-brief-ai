import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-newsletter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './newsletter.component.html',
  styleUrl: './newsletter.component.scss',
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
