import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    children: [
      { path: '', redirectTo: 'feed', pathMatch: 'full' },
      { path: 'feed', title: 'Bảng tin — TrendBrief AI', loadComponent: () => import('./pages/feed/feed.component').then(m => m.FeedComponent) },
      { path: 'article/:id', title: 'Bài viết — TrendBrief AI', loadComponent: () => import('./pages/article/article.component').then(m => m.ArticleComponent) },
      { path: 'search', title: 'Tìm kiếm — TrendBrief AI', loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent) },
      { path: 'topic/:topic', title: 'Chủ đề — TrendBrief AI', loadComponent: () => import('./pages/feed/feed.component').then(m => m.FeedComponent) },
      { path: 'summarize', title: 'Tóm tắt cho tôi — TrendBrief AI', loadComponent: () => import('./pages/summarize/summarize.component').then(m => m.SummarizeComponent) },
    ],
  },
  { path: 'privacy', title: 'Chính sách bảo mật — TrendBrief AI', loadComponent: () => import('./pages/privacy/privacy.component').then(m => m.PrivacyComponent) },
  { path: 'terms', title: 'Điều khoản sử dụng — TrendBrief AI', loadComponent: () => import('./pages/terms/terms.component').then(m => m.TermsComponent) },
  { path: 'ref/:code', title: 'Mời bạn bè — TrendBrief AI', loadComponent: () => import('./pages/referral/referral.component').then(m => m.ReferralComponent) },
  { path: 'login', title: 'Đăng nhập — TrendBrief AI', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'payment', title: 'Nâng cấp Pro — TrendBrief AI', loadComponent: () => import('./pages/payment/payment.component').then(m => m.PaymentComponent) },
  { path: '**', redirectTo: '' },
];
