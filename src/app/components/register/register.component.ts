import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './register.html'
})
export class RegisterComponent {
    username = signal('');
    password = signal('');
    confirmPassword = signal('');
    error = signal('');
    success = signal('');

    constructor(private authService: AuthService, private router: Router) {
        if (this.authService.isLoggedIn()) {
            this.router.navigate(['/']);
        }
    }

    onSubmit() {
        this.error.set('');
        this.success.set('');

        if (!this.username() || !this.password()) {
            this.error.set('Please enter both username and password');
            return;
        }

        if (this.password() !== this.confirmPassword()) {
            this.error.set('Passwords do not match');
            return;
        }

        this.authService.register({ username: this.username(), password: this.password() })
            .subscribe({
                next: () => {
                    this.success.set('Registration successful! Redirecting to login...');
                    setTimeout(() => {
                        this.router.navigate(['/login']);
                    }, 1500);
                },
                error: (err) => {
                    this.error.set(err.error?.error || 'Registration failed');
                }
            });
    }
}
