import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Month } from '../../services/api';

@Component({
  selector: 'app-month-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './month-list.html',
  styleUrl: './month-list.css'
})
export class MonthListComponent implements OnInit {
  months: Month[] = [];

  constructor(private api: ApiService) { }

  ngOnInit() {
    this.api.getMonths().subscribe(data => {
      this.months = data;
    });
  }
}
