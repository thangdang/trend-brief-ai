import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthWebService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  nameField = '';
  error = '';
  loading = false;
  isRegister = false;
  ssoLoading = '';

  constructor(private auth: AuthWebService, private router: Router, private ngZone: NgZone) {}

  ngOnInit() {
    if (!(environment as any).googleClientId) return;
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      google.accounts.id.initialize({
        client_id: (environment as any).googleClientId,
        callback: (r: any) => this.handleGoogle(r),
      });
      google.accounts.id.renderButton(document.getElementById('google-signin-btn'),
        { theme: 'outline', size: 'large', width: 380, text: 'signin_with', locale: 'vi' });
    };
    document.head.appendChild(s);
  }

  handleGoogle(response: any) {
    this.ngZone.run(() => {
      this.ssoLoading = 'google';
      this.auth.googleLogin(response.credential).subscribe({
        next: () => { this.router.navigate(['/feed']); this.ssoLoading = ''; },
        error: (e: any) => { this.error = e.error?.error || 'Google login failed'; this.ssoLoading = ''; }
      });
    });
  }

  loginWithApple() { this.error = 'Apple Sign In sẽ được hỗ trợ trên ứng dụng mobile'; }

  submit() {
    this.error = '';
    this.loading = true;
    const obs = this.isRegister
      ? this.auth.register(this.email, this.password)
      : this.auth.login(this.email, this.password);
    obs.subscribe({
      next: () => { this.router.navigate(['/feed']); this.loading = false; },
      error: (e: any) => { this.error = e.error?.error || 'Thất bại'; this.loading = false; }
    });
  }
}