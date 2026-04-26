import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

const ALL_TOPICS = [
  { id: 'ai', label: 'AI & Công nghệ', emoji: '🤖' },
  { id: 'finance', label: 'Tài chính', emoji: '💰' },
  { id: 'lifestyle', label: 'Đời sống', emoji: '🌿' },
  { id: 'drama', label: 'Drama', emoji: '🎭' },
  { id: 'career', label: 'Sự nghiệp', emoji: '💼' },
  { id: 'technology', label: 'Công nghệ', emoji: '📱' },
  { id: 'health', label: 'Sức khỏe', emoji: '🏥' },
  { id: 'entertainment', label: 'Giải trí', emoji: '🎬' },
  { id: 'sport', label: 'Thể thao', emoji: '⚽' },
  { id: 'insight', label: 'Insight', emoji: '💡' },
];

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent {
  topics = ALL_TOPICS;
  step = signal(1);
  selectedTopics = signal<string[]>([]);

  constructor(private router: Router) {}

  toggleTopic(id: string) {
    this.selectedTopics.update(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  }

  enableNotifications() {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
    this.step.set(3);
  }

  skip() {
    this.finish();
  }

  finish() {
    localStorage.setItem('onboarding_completed', 'true');
    if (this.selectedTopics().length > 0) {
      localStorage.setItem('user_topics', JSON.stringify(this.selectedTopics()));
    }
    this.router.navigate(['/feed']);
  }
}
