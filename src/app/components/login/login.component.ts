import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './login.html'
})
export class LoginComponent {
    username = signal('');
    password = signal('');
    error = signal('');

    constructor(private authService: AuthService, private router: Router) {
        if (this.authService.isLoggedIn()) {
            this.router.navigate(['/']);
        }
    }

    onSubmit() {
        this.error.set('');
        if (!this.username() || !this.password()) {
            this.error.set('Please enter both username and password');
            return;
        }

        this.authService.login({ username: this.username(), password: this.password() })
            .subscribe({
                next: () => {
                    this.router.navigate(['/']);
                },
                error: (err) => {
                    this.error.set(err.error?.error || 'Login failed');
                }
            });
    }
}
