import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'feed', pathMatch: 'full' },
      {
        path: 'feed',
        loadComponent: () =>
          import('./pages/feed/feed.component').then(m => m.FeedComponent),
      },
      {
        path: 'bookmarks',
        loadComponent: () =>
          import('./pages/bookmarks/bookmarks.component').then(m => m.BookmarksComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.component').then(m => m.ProfileComponent),
      },
      // Admin pages
      {
        path: 'admin/analytics',
        loadComponent: () =>
          import('./pages/admin/analytics/analytics.component').then(m => m.AnalyticsComponent),
      },
      {
        path: 'admin/sources',
        loadComponent: () =>
          import('./pages/admin/sources/sources.component').then(m => m.SourcesComponent),
      },
      {
        path: 'admin/moderation',
        loadComponent: () =>
          import('./pages/admin/moderation/moderation.component').then(m => m.ModerationComponent),
      },
      {
        path: 'admin/ads',
        loadComponent: () =>
          import('./pages/admin/ads/ads.component').then(m => m.AdsComponent),
      },
      {
        path: 'admin/affiliates',
        loadComponent: () =>
          import('./pages/admin/affiliates/affiliates.component').then(m => m.AffiliatesComponent),
      },
      {
        path: 'admin/notifications',
        loadComponent: () =>
          import('./pages/admin/notifications/notifications.component').then(m => m.NotificationsComponent),
      },
      {
        path: 'admin/users',
        loadComponent: () =>
          import('./pages/admin/users/users.component').then(m => m.UsersComponent),
      },
    ],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then(m => m.RegisterComponent),
  },
  { path: '**', redirectTo: 'feed' },
];
