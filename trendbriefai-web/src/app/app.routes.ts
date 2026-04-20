import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    children: [
      { path: '', redirectTo: 'feed', pathMatch: 'full' },
      { path: 'feed', loadComponent: () => import('./pages/feed/feed.component').then(m => m.FeedComponent) },
      { path: 'article/:id', loadComponent: () => import('./pages/article/article.component').then(m => m.ArticleComponent) },
      { path: 'search', loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent) },
      { path: 'topic/:topic', loadComponent: () => import('./pages/feed/feed.component').then(m => m.FeedComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
