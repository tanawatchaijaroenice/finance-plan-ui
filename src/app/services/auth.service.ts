import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

const API_URL = 'http://localhost:3000/api';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly TOKEN_KEY = 'auth_token';
    private readonly USERNAME_KEY = 'auth_username';
    currentUser = signal<string | null>(null);

    constructor(private http: HttpClient, private router: Router) {
        const token = this.getToken();
        if (token) {
            const storedUser = localStorage.getItem(this.USERNAME_KEY);
            if (storedUser) {
                this.currentUser.set(storedUser);
            } else {
                // Try to decode token
                try {
                    const decoded = this.decodeToken(token);
                    if (decoded && decoded.username) {
                        this.currentUser.set(decoded.username);
                        localStorage.setItem(this.USERNAME_KEY, decoded.username);
                    }
                } catch (e) {
                    console.error('Failed to decode token', e);
                    this.currentUser.set('User');
                }
            }
        }
    }

    private decodeToken(token: string): any {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
    }

    login(credentials: any) {
        return this.http.post<{ token: string, username: string }>(`${API_URL}/auth/login`, credentials)
            .pipe(
                tap(response => {
                    localStorage.setItem(this.TOKEN_KEY, response.token);
                    localStorage.setItem(this.USERNAME_KEY, response.username);
                    this.currentUser.set(response.username);
                })
            );
    }

    register(credentials: any) {
        return this.http.post(`${API_URL}/auth/register`, credentials);
    }

    logout() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USERNAME_KEY);
        this.currentUser.set(null);
        this.router.navigate(['/login']);
    }

    getToken(): string | null {
        return localStorage.getItem(this.TOKEN_KEY);
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }
}
