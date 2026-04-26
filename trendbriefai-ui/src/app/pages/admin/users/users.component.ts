import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);
  users = signal<any[]>([]);
  totalPages = signal(1);
  page = 1;

  ngOnInit() { this.load(); }

  load() {
    this.api.getUsers(this.page).subscribe(r => {
      this.users.set(r.users ?? r);
      this.totalPages.set(r.totalPages ?? 1);
    });
  }

  goPage(p: number) { this.page = p; this.load(); }
  ban(id: string) { this.api.banUser(id).subscribe(() => this.load()); }
  suspend(id: string) { this.api.suspendUser(id).subscribe(() => this.load()); }
}
