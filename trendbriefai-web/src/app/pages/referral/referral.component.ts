import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-referral',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './referral.component.html',
  styleUrl: './referral.component.scss',
})
export class ReferralComponent implements OnInit {
  private route = inject(ActivatedRoute);
  code = '';

  ngOnInit() {
    this.code = this.route.snapshot.paramMap.get('code') || '';
  }
}
