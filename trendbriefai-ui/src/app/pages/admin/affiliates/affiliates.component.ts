import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-affiliates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './affiliates.component.html',
  styleUrl: './affiliates.component.scss',
})
export class AffiliatesComponent implements OnInit {
  private api = inject(ApiService);
  links = signal<any[]>([]);
  form: any = { title: '', url: '', topic: 'ai', provider: '', commission: '' };

  ngOnInit() { this.load(); }
  load() { this.api.getAffiliates().subscribe(l => this.links.set(l)); }

  create() {
    this.api.createAffiliate(this.form).subscribe(() => {
      this.form = { title: '', url: '', topic: 'ai', provider: '', commission: '' };
      this.load();
    });
  }
}
