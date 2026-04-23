import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnalyticsService } from './services/analytics.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private analytics = inject(AnalyticsService);
  private deferredPrompt: any = null;
  showInstallBanner = false;

  ngOnInit(): void {
    this.analytics.init();

    // PWA install prompt (Task 32.2)
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallBanner = true;
    });
  }

  installApp(): void {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then(() => {
        this.deferredPrompt = null;
        this.showInstallBanner = false;
      });
    }
  }

  dismissInstall(): void {
    this.showInstallBanner = false;
  }
}
