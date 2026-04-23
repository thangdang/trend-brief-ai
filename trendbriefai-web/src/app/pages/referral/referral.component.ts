import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-referral',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="referral-page">
      <div class="card">
        <div class="icon">⚡</div>
        <h1>TrendBrief AI</h1>
        <p>Bạn được mời dùng TrendBrief AI — tin tức AI tóm tắt 30 giây!</p>
        <p class="reward">🎁 Nhận 7 ngày Premium miễn phí khi đăng ký</p>
        <div class="buttons">
          <a href="https://apps.apple.com/app/trendbriefai" class="btn ios">📱 App Store</a>
          <a href="https://play.google.com/store/apps/details?id=vn.trendbriefai" class="btn android">🤖 Google Play</a>
        </div>
        <p class="code">Mã giới thiệu: <strong>{{ code }}</strong></p>
      </div>
    </div>
  `,
  styles: [`
    .referral-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a1a2e, #16213e); }
    .card { background: #fff; border-radius: 20px; padding: 48px; text-align: center; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .icon { font-size: 48px; margin-bottom: 12px; }
    h1 { font-size: 28px; margin: 0 0 12px; }
    p { color: #666; margin: 8px 0; }
    .reward { color: #6366f1; font-weight: 600; font-size: 18px; margin: 16px 0; }
    .buttons { display: flex; gap: 12px; justify-content: center; margin: 24px 0; }
    .btn { padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; }
    .ios { background: #000; color: #fff; }
    .android { background: #34a853; color: #fff; }
    .code { font-size: 14px; color: #999; margin-top: 16px; }
  `],
})
export class ReferralComponent implements OnInit {
  private route = inject(ActivatedRoute);
  code = '';

  ngOnInit() {
    this.code = this.route.snapshot.paramMap.get('code') || '';
  }
}
