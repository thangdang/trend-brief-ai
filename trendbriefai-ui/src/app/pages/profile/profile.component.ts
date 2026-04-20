import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Topic } from '../../types/api.types';

interface TopicOption {
  value: Topic;
  label: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent {
  private api = inject(ApiService);

  topicOptions: TopicOption[] = [
    { value: 'ai', label: 'AI' },
    { value: 'finance', label: 'Tài chính' },
    { value: 'lifestyle', label: 'Đời sống' },
    { value: 'drama', label: 'Drama' },
  ];

  selectedTopics = signal<Set<Topic>>(new Set());
  email = signal('user@example.com');
  saving = signal(false);
  message = signal('');
  error = signal('');

  isSelected(topic: Topic): boolean {
    return this.selectedTopics().has(topic);
  }

  toggleTopic(topic: Topic): void {
    this.selectedTopics.update(set => {
      const next = new Set(set);
      if (next.has(topic)) {
        next.delete(topic);
      } else {
        next.add(topic);
      }
      return next;
    });
    this.message.set('');
  }

  save(): void {
    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    const topics = Array.from(this.selectedTopics());
    this.api.updateInterests(topics).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Đã lưu thành công!');
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Lưu thất bại, vui lòng thử lại.');
      },
    });
  }
}
