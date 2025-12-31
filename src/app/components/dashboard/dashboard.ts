import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Month, Expense, Category, Account } from '../../services/api';

import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  currentMonth: Month | null = null;
  loading = true;
  totalExpenses = 0;
  remaining = 0;
  groupedExpenses: { category: Category | null, total: number, expenses: Expense[], allPaid: boolean }[] = [];

  // Create Modal State
  showCreateModal = false;
  newPlan = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1, // 1-12
    income: 30000
  };

  monthsList = [
    { val: 1, name: 'January' }, { val: 2, name: 'February' }, { val: 3, name: 'March' },
    { val: 4, name: 'April' }, { val: 5, name: 'May' }, { val: 6, name: 'June' },
    { val: 7, name: 'July' }, { val: 8, name: 'August' }, { val: 9, name: 'September' },
    { val: 10, name: 'October' }, { val: 11, name: 'November' }, { val: 12, name: 'December' }
  ];

  allMonths: Month[] = [];
  selectedMonthId: number | null = null;

  constructor(private api: ApiService) { }

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.api.getMonths().subscribe(months => {
      this.allMonths = months;
      if (months.length > 0) {
        // Try to find current month by name (e.g. "December 2025")
        const now = new Date();
        const currentMonthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
        const found = months.find(m => m.name === currentMonthName);

        if (found) {
          this.selectedMonthId = found.id;
        } else {
          this.selectedMonthId = months[0].id; // Fallback to latest
        }

        if (this.selectedMonthId) {
          this.loadMonthDetails(this.selectedMonthId);
        }
      } else {
        this.loading = false;
      }
    });
  }

  onMonthChange() {
    if (this.selectedMonthId) {
      this.loadMonthDetails(Number(this.selectedMonthId));
    }
  }

  loadMonthDetails(id: number) {
    this.api.getMonthDetails(id).subscribe(month => {
      this.currentMonth = month;
      this.calculateTotals();
      this.loading = false;
    });
  }

  calculateTotals() {
    if (!this.currentMonth || !this.currentMonth.expenses) return;

    // Filter out INCOME expenses from Total Expenses
    this.totalExpenses = this.currentMonth.expenses.reduce((sum, ex) => {
      if (ex.category?.type === 'INCOME') return sum;
      return sum + Number(ex.amount);
    }, 0);

    // Calculate Additional Income (Visual only, does not affect Remaining Balance)
    // User requested "Charge Others" behavior: Don't effect anything.

    this.remaining = Number(this.currentMonth.totalIncome) - this.totalExpenses;

    const map = new Map<number | string, { category: Category | null, total: number, expenses: Expense[] }>();

    this.currentMonth.expenses.forEach(ex => {
      const key = ex.categoryId || 'uncategorized';
      let group = map.get(key);

      if (!group) {
        group = {
          category: ex.category || null,
          total: 0,
          expenses: []
        };
        map.set(key, group);
      }

      group.expenses.push(ex);
      // Only add to group total if it's an EXPENSE (or maybe we DO want to show total for Income categories?
      // Usually Expense breakdown should only show expenses. Let's separate or exclude Income categories from the main list?)
      // User said "Income as category". If I show them in the list, they should look like income.
      if (ex.category?.type !== 'INCOME') {
        group.total += Number(ex.amount);
      } else {
        // For INCOME categories, we might want to track total but maybe visually distinct?
        // Let's track it for now, but the loop below sorts by total.
        group.total += Number(ex.amount);
      }
    });

    this.groupedExpenses = Array.from(map.values())
      .map(g => {
        // Sort expenses by Account Name (to keep same card together), then by ID
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
  }

  openCreateModal() {
    this.showCreateModal = true;
    const nextMonthDate = new Date();
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    this.newPlan = {
      month: nextMonthDate.getMonth() + 1,
      year: nextMonthDate.getFullYear(),
      income: 0
    };
  }

  toggleStatus(expense: Expense) {
    const newStatus = expense.status === 'PAID' ? 'UNPAID' : 'PAID';
    // Optimistic update
    expense.status = newStatus;

    // Update locally for immediate visual feedback (re-sort or style update)
    // We might need to re-process groups if we want specific ordering changes, 
    // but for now just updating the object reference is enough for Angular change detection in the list.

    this.api.updateExpense(expense.id, { status: newStatus }).subscribe({
      next: () => {
        // Success
      },
      error: () => {
        // Revert on error
        expense.status = newStatus === 'PAID' ? 'UNPAID' : 'PAID';
      }
    });
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  createFutureMonth() {
    const monthName = this.monthsList.find(m => m.val === Number(this.newPlan.month))?.name;
    const fullName = `${monthName} ${this.newPlan.year}`;

    this.api.createMonth({
      name: fullName,
      totalIncome: this.newPlan.income,
      autoFillFromTemplate: true
    }).subscribe(() => {
      this.closeCreateModal();
      this.refresh();
    });
  }

  canDeleteCurrentMonth(): boolean {
    if (!this.currentMonth) return false;
    // Check if month is >= current month
    // month.name format: "MonthName YYYY" e.g., "December 2025"
    const monthDate = new Date(this.currentMonth.name);
    const now = new Date();
    // Compare YYYY-MM only
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const targetMonthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);

    return targetMonthStart > currentMonthStart;
  }

  deleteCurrentMonth() {
    if (!this.currentMonth || !this.canDeleteCurrentMonth()) return;

    Swal.fire({
      title: 'Are you sure?',
      text: `You are about to delete ${this.currentMonth.name}. This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    }).then((result: any) => {
      if (result.isConfirmed) {
        if (!this.currentMonth) return; // TS check
        this.api.deleteMonth(this.currentMonth.id).subscribe({
          next: () => {
            Swal.fire(
              'Deleted!',
              'The month has been deleted.',
              'success'
            );
            this.refresh();
            this.selectedMonthId = 0;
          },
          error: (err: any) => {
            console.error(err);
            Swal.fire(
              'Error!',
              'Failed to delete month. ' + (err.error?.error || ''),
              'error'
            );
          }
        });
      }
    });
  }

  // Category Colors (Consistent with MonthDetail)
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
