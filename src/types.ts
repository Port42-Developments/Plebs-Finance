export interface User {
  id: string;
  username: string;
  name: string;
  picture: string;
  currency: string;
  timezone: string;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  picture: string;
  currency: string;
  timezone: string;
  darkMode?: boolean;
}

export interface CashflowEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  createdAt: string;
}

export interface PlanPayment {
  id: string;
  amount: number;
  date: string;
  createdAt: string;
}

export interface CreditCardPlan {
  id: string;
  name: string;
  amount: number;
  interestFreeMonths: number;
  interestFreeEndDate: string;
  weeklyPayment?: number;
  payments: PlanPayment[];
  remainingBalance: number;
}

export interface CreditCard {
  id: string;
  name: string;
  plans: CreditCardPlan[];
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  recurring?: {
    frequency: 'weekly' | 'monthly' | 'yearly';
    endDate?: string;
  };
  createdAt: string;
}

export interface Bill {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  type: 'checking' | 'savings' | 'investment' | 'other';
  createdAt: string;
}

export interface AccountTransaction {
  id: string;
  accountId: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  description: string;
  date: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  accountId?: string; // Linked account ID
  createdAt: string;
}

