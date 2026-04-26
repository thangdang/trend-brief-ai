import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthWebService } from '../../services/auth.service';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss',
})
export class PaymentComponent implements OnInit {
  plans: any[] = [];
  subscription: any = null;
  paymentLoading = '';
  error = '';
  success = '';

  constructor(private auth: AuthWebService) {}

  ngOnInit() {
    this.auth.getPlans().subscribe({ next: (r: any) => this.plans = r.plans || [] });
    this.auth.getSubscription().subscribe({ next: (r: any) => this.subscription = r.subscription });
  }

  subscribe(planId: string, method: string) {
    this.paymentLoading = `${planId}-${method}`;
    this.auth.createPayment(planId, method).subscribe({
      next: (r: any) => { if (r.payUrl || r.url) window.location.href = r.payUrl || r.url; this.paymentLoading = ''; },
      error: (e: any) => { this.error = e.error?.error || 'Lỗi thanh toán'; this.paymentLoading = ''; }
    });
  }

  cancelSub() {
    if (!confirm('Hủy gói Pro?')) return;
    this.auth.cancelSubscription().subscribe({
      next: () => { this.success = 'Đã hủy'; this.subscription = null; },
      error: () => { this.error = 'Không thể hủy'; }
    });
  }

  formatPrice(p: number) { return new Intl.NumberFormat('vi-VN').format(p) + 'đ'; }
  formatDate(d: string) { return new Date(d).toLocaleDateString('vi-VN'); }
}
