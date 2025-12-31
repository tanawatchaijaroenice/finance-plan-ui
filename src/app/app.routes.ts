import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { MonthListComponent } from './components/month-list/month-list';
import { MonthDetailComponent } from './components/month-detail/month-detail';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: '', component: DashboardComponent, canActivate: [authGuard] },
    { path: 'history', component: MonthListComponent, canActivate: [authGuard] },
    { path: 'month/:id', component: MonthDetailComponent, canActivate: [authGuard] },
    { path: '**', redirectTo: '' }
];
