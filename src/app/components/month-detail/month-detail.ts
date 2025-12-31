import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { ApiService, Month, Category, Expense, Account } from '../../services/api';

@Component({
  selector: 'app-month-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './month-detail.html',
  styleUrl: './month-detail.css'
})
export class MonthDetailComponent implements OnInit {
  month: Month | null = null;
  categories: Category[] = [];
  accounts: Account[] = [];

  // New Expense Form
  newExpense: Partial<Expense> = {
    amount: 0,
    categoryId: undefined,
    note: '',
    status: 'UNPAID'
  };

  constructor(
    private route: ActivatedRoute,
    private api: ApiService
  ) { }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadMonth(parseInt(id));
    }
    this.loadCategories();
    this.loadAccounts();
  }

  groupedExpenses: { category: Category | null, expenses: Expense[], total: number }[] = [];

  loadMonth(id: number) {
    this.api.getMonthDetails(id).subscribe(month => {
      this.month = month;
      this.processGroups();
    });
  }

  processGroups() {
    if (!this.month || !this.month.expenses) return;

    const map = new Map<number | string, { category: Category | null, expenses: Expense[], total: number }>();

    // Initialize map with all available categories to ensure they show up even if empty (optional, but good for "adding detail")
    this.categories.forEach(cat => {
      map.set(cat.id, { category: cat, expenses: [], total: 0 });
    });
    // Also handle uncategorized
    map.set('uncategorized', { category: null, expenses: [], total: 0 });

    this.month.expenses.forEach(ex => {
      const key = ex.categoryId || 'uncategorized';
      const group = map.get(key);
      if (group) {
        group.expenses.push(ex);
        group.total += Number(ex.amount);
      }
    });

    const result = Array.from(map.values())
      .filter(g => g.category !== null || g.expenses.length > 0) // Only show categories or non-empty uncategorized
      .map(g => {
        g.expenses.sort((a, b) => {
          const nameA = a.account?.name || '';
          const nameB = b.account?.name || '';
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        });
        return {
          ...g,
          allPaid: g.expenses.length > 0 && g.expenses.every(e => e.status === 'PAID')
        };
      })
      .sort((a, b) => {
        const seqA = a.category?.seqNo ?? 99;
        const seqB = b.category?.seqNo ?? 99;
        return seqA - seqB;
      });

    this.groupedExpenses = result;
  }

  loadCategories() {
    this.api.getCategories().subscribe(cats => {
      this.categories = cats;
      if (this.month) this.processGroups(); // Process again if categories load after month
    });
  }

  loadAccounts() {
    this.api.getAccounts().subscribe(accs => this.accounts = accs);
  }

  getAvailableAccounts(categoryId: number | string | null): Account[] {
    if (!categoryId || categoryId === 'uncategorized') return this.accounts.filter(a => a.type !== 'CREDIT_CARD');

    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return this.accounts.filter(a => a.type !== 'CREDIT_CARD');

    // Check if category name contains "Credit Card" (case insensitive)
    if (category.name.toLowerCase().includes('credit card')) {
      return this.accounts.filter(a => a.type === 'CREDIT_CARD');
    }

    // Default: Return non-credit card accounts
    // Or should we return ALL except credit card?
    // Let's assume for now we hide credit cards elsewhere.
    return this.accounts.filter(a => a.type !== 'CREDIT_CARD');
  }

  isCreditCardCategory(categoryId: number | string | null): boolean {
    if (!categoryId || categoryId === 'uncategorized') return false;
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name.toLowerCase().includes('credit card') : false;
  }

  editingId: number | null = null;
  editingExpense: Partial<Expense> = {};

  addExpense() {
    if (!this.month || !this.newExpense.categoryId || !this.newExpense.amount) return;

    this.api.addExpense({
      monthId: this.month.id,
      categoryId: Number(this.newExpense.categoryId),
      amount: this.newExpense.amount,
      note: this.newExpense.note,
      status: this.newExpense.status
    }).subscribe(() => {
      this.resetNewForm();
      if (this.month) this.loadMonth(this.month.id);
    });
  }

  startEdit(expense: Expense) {
    this.editingId = expense.id;
    this.editingExpense = { ...expense };
  }

  cancelEdit() {
    this.editingId = null;
    this.editingExpense = {};
  }

  saveEdit() {
    if (!this.editingId || !this.editingExpense.amount) return;

    this.api.updateExpense(this.editingId, {
      amount: this.editingExpense.amount,
      note: this.editingExpense.note,
      accountId: this.editingExpense.accountId,
      status: this.editingExpense.status
    }).subscribe(() => {
      this.cancelEdit();
      if (this.month) this.loadMonth(this.month.id);
    });
  }



  toggleStatus(expense: Expense) {
    const newStatus = expense.status === 'PAID' ? 'UNPAID' : 'PAID';
    // Optimistic update
    expense.status = newStatus;

    this.api.updateExpense(expense.id, expense).subscribe({
      error: () => {
        // Revert on error
        expense.status = newStatus === 'PAID' ? 'UNPAID' : 'PAID';
      }
    });
  }

  deleteExpense(id: number) {
    Swal.fire({
      title: 'Delete Expense?',
      text: 'Are you sure you want to remove this item?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.api.deleteExpense(id).subscribe(() => {
          if (this.month) this.loadMonth(this.month.id);
          const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
          });
          Toast.fire({
            icon: 'success',
            title: 'Expense deleted'
          });
        });
      }
    });
  }

  resetNewForm() {
    this.newExpense = { amount: 0, categoryId: undefined, note: '', status: 'UNPAID' };
  }

  addingCategoryId: number | string | null = null;
  newDetail: Partial<Expense> = {};

  startAddDetail(category: Category | null) {
    this.addingCategoryId = category?.id || 'uncategorized';
    this.newDetail = {
      amount: undefined,
      categoryId: category?.id,
      note: '',
      accountId: null, // Default to first account
      status: 'UNPAID'
    };
  }

  cancelAddDetail() {
    this.addingCategoryId = null;
    this.newDetail = {};
  }

  saveNewDetail() {
    if (!this.month || !this.newDetail.amount) return;

    // Use current category ID from state or 'uncategorized' fallback handling if needed
    // But api.addExpense needs a numeric categoryId (or handle uncategorized logic in backend if we supported it fully, 
    // strictly speaking schema says categoryId is optional? checking schema... schema says Category is relation, but if optional? 
    // In schema.prisma: category Category? @relation... categoryId Int?
    // So categoryId CAN be null/undefined.

    this.api.addExpense({
      monthId: this.month.id,
      categoryId: this.newDetail.categoryId,
      amount: Number(this.newDetail.amount),
      note: this.newDetail.note,
      status: this.newDetail.status,
      accountId: this.newDetail.accountId ? Number(this.newDetail.accountId) : null
    }).subscribe(() => {
      this.cancelAddDetail();
      if (this.month) this.loadMonth(this.month.id);
    });
  }

  getTotalExpenses(): number {
    return this.month?.expenses?.reduce((sum, ex) => {
      if (ex.category?.type === 'INCOME') return sum;
      return sum + Number(ex.amount);
    }, 0) || 0;
  }

  getRemaining(): number {
    // "Charge Others" items (INCOME type) are excluded from Total Expenses,
    // and requested to NOT be added to Income. So remaining is just Income - NormalExpenses.
    return Number(this.month?.totalIncome || 0) - this.getTotalExpenses();
  }

  // Income Editing
  editingIncome = false;
  tempIncome: number | null = null;

  startEditIncome() {
    if (this.month) {
      this.tempIncome = this.month.totalIncome;
      this.editingIncome = true;
    }
  }

  cancelEditIncome() {
    this.editingIncome = false;
    this.tempIncome = null;
  }

  saveIncome() {
    if (!this.month || this.tempIncome === null) return;

    this.api.updateMonth(this.month.id, { totalIncome: this.tempIncome }).subscribe((updatedMonth) => {
      if (this.month) {
        this.month.totalIncome = updatedMonth.totalIncome;
      }
      this.editingIncome = false;
    });
  }

  // Category Colors
  getCategoryColor(id: number | undefined): { bg: string, text: string, border: string } {
    if (!id) return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100' };

    const colors = [
      { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
      { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
      { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
      { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
      { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' },
      { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100' },
      { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', border: 'border-fuchsia-100' },
      { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
      { bg: 'bg-lime-50', text: 'text-lime-600', border: 'border-lime-100' },
      { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
    ];

    return colors[id % colors.length];
  }

  getAccountStyle(account: Account | undefined | null): string {
    if (!account) return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600';

    const name = account.name.toUpperCase();

    // Specific Bank/Card Colors
    if (name.includes('KTC')) {
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    }
    if (name.includes('XPRESS CASH')) {
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    }
    if (name.includes('KRUNGSRI NOW')) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    }
    if (name.includes('FIRST CHOICE')) {
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    }

    // Fallback to Type logic
    const normalizedType = account.type.toUpperCase();
    if (normalizedType === 'CREDIT_CARD' || normalizedType.includes('CREDIT')) {
      return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
    } else if (normalizedType === 'CASH') {
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
    } else if (normalizedType === 'SAVINGS') {
      return 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800';
    } else {
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600';
    }
  }


}
