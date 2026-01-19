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
          return b.id - a.id;
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

  // Food Stats Feature
  showFoodStatsModal = false;
  foodStats: { weeks: { range: string, days: number, budget: number, balanceEnd: number, isCurrent: boolean, isPast: boolean, startDay: number, endDay: number }[], totalBudget: number, dailyBudget: number, progressPercentage: number } | null = null;
  foodStatsStartDay: number | null = null; // null = Default (Month view)
  foodStatsStartMonthOffset: number = 0; // 0 = Current, -1 = Previous
  availableStartDays: number[] = Array.from({ length: 31 }, (_, i) => i + 1);
  private readonly FOOD_SETTINGS_KEY = 'finance_plan_food_settings';

  openFoodStats() {
    // Find Food Group
    const foodGroup = this.groupedExpenses.find(g => g.category?.name.toLowerCase() === 'food');

    if (!this.month || !foodGroup) {
      Swal.fire('Error', 'Food category not found or has no expenses', 'error');
      return;
    }

    const budget = foodGroup.total;

    if (budget <= 0) {
      Swal.fire({
        title: 'No Expenses',
        text: 'The Monthly Budget is calculated from the sum of all Food expenses. Please add expenses to see the breakdown.',
        icon: 'info'
      });
      return;
    }

    this.loadFoodStatsSettings();
    this.processFoodStats(budget);
    this.showFoodStatsModal = true;
  }

  closeFoodStats() {
    this.showFoodStatsModal = false;
  }

  onFoodStatsStartDayChange() {
    this.saveFoodStatsSettings();
    const foodGroup = this.groupedExpenses.find(g => g.category?.name.toLowerCase() === 'food');
    if (foodGroup) {
      this.processFoodStats(foodGroup.total);
    }
  }

  private saveFoodStatsSettings() {
    const settings = {
      startDay: this.foodStatsStartDay,
      monthOffset: this.foodStatsStartMonthOffset
    };
    localStorage.setItem(this.FOOD_SETTINGS_KEY, JSON.stringify(settings));
  }

  private loadFoodStatsSettings() {
    const saved = localStorage.getItem(this.FOOD_SETTINGS_KEY);
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        this.foodStatsStartDay = settings.startDay;
        this.foodStatsStartMonthOffset = settings.monthOffset || 0;
      } catch (e) {
        console.error('Failed to parse food stats settings', e);
      }
    }
  }

  processFoodStats(totalBudget: number) {
    if (!this.month) return;

    const date = new Date(this.month.name);
    if (isNaN(date.getTime())) return;

    const year = date.getFullYear();
    const monthIndex = date.getMonth();

    // Determine Timeline Range
    let startDate: Date;
    let endDate: Date;
    let totalDays: number;

    if (this.foodStatsStartDay) {
      // Custom: Start Day -> +30 Days WITH Month Offset
      startDate = new Date(year, monthIndex + this.foodStatsStartMonthOffset, this.foodStatsStartDay);

      // Handle edge case: e.g., Feb 30 -> Mar 2. 
      // JS Date auto-handles overflow. If user intended "Last day of Feb" but clicked 30, they get start of Mar.
      // This is generally acceptable for a "cycle". 

      const duration = 30;
      totalDays = duration;

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + duration - 1); // Inclusive
    } else {
      // Default: Full Month
      startDate = new Date(year, monthIndex, 1);
      endDate = new Date(year, monthIndex + 1, 0);
      totalDays = endDate.getDate();
    }

    const dailyBudget = totalBudget / totalDays;
    const weeks: { range: string, days: number, budget: number, balanceEnd: number, isCurrent: boolean, isPast: boolean, startDay: number, endDay: number }[] = [];

    let currentWeekDays = 0;
    let accumulatedBudget = 0;

    const today = new Date();
    // Reset time for strict day comparison
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Iterate day by day from startDate to endDate
    const itr = new Date(startDate);

    // We need to loop exactly 'totalDays' times
    for (let i = 0; i < totalDays; i++) {
      // Current iteration date
      const currentItrDate = new Date(startDate);
      currentItrDate.setDate(startDate.getDate() + i);

      const dayOfWeek = currentItrDate.getDay(); // 0 (Sun)

      currentWeekDays++;

      // Break on Sunday (0) OR Last Day of Range
      const isLastDayOfRange = i === totalDays - 1;
      const isWeekEnd = dayOfWeek === 0;

      if (isWeekEnd || isLastDayOfRange) {
        // End of this visual block
        // Start date of this block:
        const blockEndDate = new Date(currentItrDate);
        const blockStartDate = new Date(currentItrDate);
        blockStartDate.setDate(blockEndDate.getDate() - currentWeekDays + 1);

        const rangeStr = `${blockStartDate.getDate()} ${blockStartDate.toLocaleString('default', { month: 'short' })} - ${blockEndDate.getDate()} ${blockEndDate.toLocaleString('default', { month: 'short' })}`;

        // Check if Today is in this range
        // currentItrDate is End, blockStartDate is Start
        // We compare timestamps
        const blkStartTs = new Date(blockStartDate.getFullYear(), blockStartDate.getMonth(), blockStartDate.getDate()).getTime();
        const blkEndTs = new Date(blockEndDate.getFullYear(), blockEndDate.getMonth(), blockEndDate.getDate()).getTime();
        const todayTs = todayStart.getTime();

        const isCurrent = (todayTs >= blkStartTs && todayTs <= blkEndTs);
        const isPast = (blkEndTs < todayTs);

        const weekBudget = dailyBudget * currentWeekDays;
        accumulatedBudget += weekBudget;

        weeks.push({
          range: rangeStr,
          days: currentWeekDays,
          budget: weekBudget,
          balanceEnd: totalBudget - accumulatedBudget,
          isCurrent,
          isPast,
          startDay: blockStartDate.getDate(), // Note: simple date might not be enough if crossing months, but for visual list index calc it's separate
          endDay: blockEndDate.getDate()
        });

        currentWeekDays = 0;
      }
    }

    // Calculate Visual Progress Percentage
    let progressPercentage = 0;

    // Check if Today is BEFORE the entire range
    const startRangeTs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const endRangeTs = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
    const todayTs = todayStart.getTime();

    if (todayTs < startRangeTs) {
      progressPercentage = 0;
    } else if (todayTs > endRangeTs) {
      progressPercentage = 100;
    } else {
      // Today is INSIDE the range
      // Find which visual week block we are in
      const totalWeeks = weeks.length;
      const currentWeekIndex = weeks.findIndex(w => w.isCurrent);

      if (currentWeekIndex !== -1) {
        const currentWeek = weeks[currentWeekIndex];

        // Need to calculate how many days into this specific week block we are.
        // Since weeks can span months, we can't just subtract dates simply if we only stored 'date'.
        // Let's re-calculate block start date object from the iteration logic or just diff timestamps.
        // Easier: Diff Today vs Week's End Date (which we know is 'currentWeek.endDay'.. wait we stored simple int).
        // Let's improve the stored data in weeks to help accuracy? 
        // Actually, we can just assume the "days" count is correct.
        // If currentWeek has 5 days, and today matches.
        // We need to know if today is Day 1, 2, 3, 4, or 5 of that block.
        // We know the block ends on 'currentWeek.isCurrent = true'.
        // We don't easily know the block start date object again without reconstructing.
        // FIX: Let's simpler - 
        // We are 'daysIntoRange' total.
        // Total Visual Height = totalWeeks. visualIndex = currentWeekIndex + (daysIntoWeek / weekLength).

        // How to get daysIntoWeek?
        // We can iterate again or just store full Date objects in 'weeks'. 
        // Or simpler: We know today is in this range.
        // Let's calculate 'daysSinceStartOfRange' for today.
        const daysSinceStart = Math.floor((todayTs - startRangeTs) / (1000 * 60 * 60 * 24)); // 0-based index from start
        // No that's global progress. We want visual block progress.

        // Let's stick to the visual index idea from before:
        // logic: we need (days passed in THIS week / total days in THIS week)
        // We can get the block's end date? We checked `blkEndTs`.
        // Let's store `blockEndTime` in the week object for easier diff?
        // No, TS interface change needed.

        // Workaround: Re-construct start date of the week.
        // We found currentWeekIndex.
        // We can use the fact that `currentWeek` was pushed when `isCurrent` was true.
        // But we don't have the exact date obj there.

        // Let's just USE GLOBAL PROGRESS for simplicity? 
        // The user specifically praised the visual alignment.
        // Global (Linear) Progress vs Visual (Block) Progress.
        // If all blocks were 7 days, they would be same. But blocks vary (1-7 days).
        // Linear progress: 50% of time might be 30% of visual height if detailed weeks are at end.
        // We MUST use visual progress.

        // Let's upgrade 'weeks' to hold real date objects for start/end to be safe?
        // Or just store timestamps.

        // Re-calc:
        // We need: (Today - BlockStart) / (BlockEnd - BlockStart + 1)
        // But we don't have BlockStart easily.
        // Wait, we generate weeks sequentially.
        // We can sum up 'days' of previous weeks to know the Start Day Index of current week?
        const daysInPreviousWeeks = weeks.slice(0, currentWeekIndex).reduce((sum, w) => sum + w.days, 0);

        // So current week starts at `startDate + daysInPreviousWeeks`.
        // Today is at `startDate + daysInTotal`?
        const daysSinceRangeStart = Math.floor((todayTs - startRangeTs) / (1000 * 60 * 60 * 24));

        // Days into THIS week = daysSinceRangeStart - daysInPreviousWeeks
        const daysIntoWeek = daysSinceRangeStart - daysInPreviousWeeks; // 0-based. 0 = 1st day.

        // Progress = (daysIntoWeek + 1) / currentWeek.days
        const weekProgress = (daysIntoWeek + 1) / currentWeek.days;

        const visualIndex = currentWeekIndex + weekProgress;
        progressPercentage = (visualIndex / totalWeeks) * 100;
      }
    }

    this.foodStats = {
      weeks,
      totalBudget,
      dailyBudget,
      progressPercentage
    };
  }
}
