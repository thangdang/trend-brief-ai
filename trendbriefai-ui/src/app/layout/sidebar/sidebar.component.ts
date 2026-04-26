import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  isDark = false;

  ngOnInit() {
    if (typeof localStorage !== 'undefined') {
      this.isDark = localStorage.getItem('admin_theme') === 'dark';
      if (this.isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
    localStorage.setItem('admin_theme', this.isDark ? 'dark' : 'light');
  }

  menuSections = [
    {
      title: 'User',
      items: [
        { path: '/feed', icon: '📰', label: 'Feed' },
        { path: '/bookmarks', icon: '🔖', label: 'Bookmarks' },
        { path: '/profile', icon: '👤', label: 'Profile' },
      ],
    },
    {
      title: 'Admin',
      items: [
        { path: '/admin/analytics', icon: '📊', label: 'Analytics' },
        { path: '/admin/sources', icon: '🌐', label: 'Sources' },
        { path: '/admin/moderation', icon: '🛡️', label: 'Moderation' },
        { path: '/admin/ads', icon: '📢', label: 'Ads' },
        { path: '/admin/affiliates', icon: '💰', label: 'Affiliates' },
        { path: '/admin/notifications', icon: '🔔', label: 'Notifications' },
        { path: '/admin/users', icon: '👥', label: 'Users' },
      ],
    },
  ];
}