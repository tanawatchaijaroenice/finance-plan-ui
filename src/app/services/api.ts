import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Month {
  id: number;
  name: string;
  totalIncome: number;
  expenses?: Expense[];
  createdAt: string;
}

export interface Expense {
  id: number;
  amount: number;
  note?: string;
  status: string;
  categoryId?: number | null;
  category?: Category;
  accountId?: number | null;
  account?: Account;
}

export interface Account {
  id: number;
  name: string;
  type: string;
  dueDate?: number;
}

export interface Category {
  id: number;
  name: string;
  type?: 'EXPENSE' | 'INCOME';
  defaultAmount: number;
  seqNo?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'https://finance-plan-api.onrender.com/api';
  // private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  getMonths(): Observable<Month[]> {
    return this.http.get<Month[]>(`${this.apiUrl}/months`);
  }

  getMonthDetails(id: number): Observable<Month> {
    return this.http.get<Month>(`${this.apiUrl}/months/${id}`);
  }

  createMonth(data: { name: string, totalIncome: number, autoFillFromTemplate: boolean }): Observable<Month> {
    return this.http.post<Month>(`${this.apiUrl}/months`, data);
  }

  deleteMonth(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/months/${id}`);
  }

  updateMonth(id: number, data: { totalIncome: number }): Observable<Month> {
    return this.http.put<Month>(`${this.apiUrl}/months/${id}`, data);
  }

  addExpense(data: { monthId: number, categoryId?: number | null, amount: number, note?: string, status?: string, accountId?: number | null }): Observable<Expense> {
    return this.http.post<Expense>(`${this.apiUrl}/expenses`, data);
  }

  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.apiUrl}/accounts`);
  }

  createAccount(data: { name: string, type: string, dueDate?: number }): Observable<Account> {
    return this.http.post<Account>(`${this.apiUrl}/accounts`, data);
  }

  updateExpense(id: number, data: { amount?: number, note?: string, status?: string, accountId?: number | null }): Observable<Expense> {
    return this.http.put<Expense>(`${this.apiUrl}/expenses/${id}`, data);
  }

  deleteExpense(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/expenses/${id}`);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }
}
