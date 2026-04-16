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
  template: `
    <div class="profile-page">
      <h1 class="page-title">Hồ sơ cá nhân</h1>

      <div class="profile-card">
        <div class="section">
          <h3>Thông tin tài khoản</h3>
          <div class="info-row">
            <span class="info-label">Email</span>
            <span class="info-value">{{ email() }}</span>
          </div>
        </div>

        <div class="section">
          <h3>Chủ đề quan tâm</h3>
          <p class="section-desc">Chọn chủ đề bạn muốn theo dõi để cá nhân hóa bảng tin.</p>
          <div class="topic-grid">
            @for (opt of topicOptions; track opt.value) {
              <label class="topic-checkbox" [class.checked]="isSelected(opt.value)">
                <input
                  type="checkbox"
                  [checked]="isSelected(opt.value)"
                  (change)="toggleTopic(opt.value)"
                />
                <span class="check-icon">@if (isSelected(opt.value)) { ✓ }</span>
                <span>{{ opt.label }}</span>
              </label>
            }
          </div>
        </div>

        @if (message()) {
          <div class="alert-success">{{ message() }}</div>
        }
        @if (error()) {
          <div class="alert-error">{{ error() }}</div>
        }

        <button class="btn-save" (click)="save()" [disabled]="saving()">
          @if (saving()) { Đang lưu... } @else { Lưu thay đổi }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .profile-page { max-width: 600px; margin: 0 auto; }
    .page-title { font-size: 22px; font-weight: 700; color: #1e293b; margin-bottom: 20px; }
    .profile-card {
      background: #fff;
      border-radius: 10px;
      padding: 28px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .section { margin-bottom: 24px; }
    .section h3 { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
    .section-desc { font-size: 13px; color: #64748b; margin-bottom: 14px; }
    .info-row { display: flex; gap: 12px; align-items: center; }
    .info-label { font-size: 13px; color: #94a3b8; min-width: 60px; }
    .info-value { font-size: 14px; color: #1e293b; font-weight: 500; }
    .topic-grid { display: flex; flex-wrap: wrap; gap: 10px; }
    .topic-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s;
      user-select: none;
    }
    .topic-checkbox:hover { border-color: #6366f1; }
    .topic-checkbox.checked {
      background: #f5f3ff;
      border-color: #6366f1;
      color: #6366f1;
      font-weight: 600;
    }
    .topic-checkbox input { display: none; }
    .check-icon {
      width: 18px;
      height: 18px;
      border: 2px solid #d1d5db;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: #6366f1;
      flex-shrink: 0;
    }
    .checked .check-icon { border-color: #6366f1; background: #ede9fe; }
    .alert-success {
      background: #f0fdf4;
      color: #15803d;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      border: 1px solid #bbf7d0;
    }
    .alert-error {
      background: #fef2f2;
      color: #dc2626;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      border: 1px solid #fecaca;
    }
    .btn-save {
      width: 100%;
      padding: 12px;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-save:hover { background: #4f46e5; }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
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
