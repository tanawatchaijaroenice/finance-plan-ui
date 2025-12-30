import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { MonthListComponent } from './components/month-list/month-list';
import { MonthDetailComponent } from './components/month-detail/month-detail';

export const routes: Routes = [
    { path: '', component: DashboardComponent },
    { path: 'history', component: MonthListComponent },
    { path: 'month/:id', component: MonthDetailComponent },
    { path: '**', redirectTo: '' }
];
