const API_BASE = '/api';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}

export const api = {
  // Auth
  verifyPin: (pin: string) => fetchAPI('auth/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  changePin: (oldPin: string, newPin: string) => fetchAPI('auth/change-pin', { method: 'POST', body: JSON.stringify({ oldPin, newPin }) }),
  
  // Profile
  getProfile: () => fetchAPI('user/profile'),
  updateProfile: (profile: any) => fetchAPI('user/profile', { method: 'POST', body: JSON.stringify(profile) }),
  
  // Cashflow
  getCashflow: () => fetchAPI('cashflow'),
  addCashflow: (entry: any) => fetchAPI('cashflow', { method: 'POST', body: JSON.stringify(entry) }),
  deleteCashflow: (id: string) => fetchAPI(`cashflow/${id}`, { method: 'DELETE' }),
  
  // Credit Cards
  getCreditCards: () => fetchAPI('credit-cards'),
  addCreditCard: (card: any) => fetchAPI('credit-cards', { method: 'POST', body: JSON.stringify(card) }),
  updateCreditCard: (id: string, card: any) => fetchAPI(`credit-cards/${id}`, { method: 'PUT', body: JSON.stringify(card) }),
  deleteCreditCard: (id: string) => fetchAPI(`credit-cards/${id}`, { method: 'DELETE' }),
  
  // Expenses
  getExpenses: () => fetchAPI('expenses'),
  addExpense: (expense: any) => fetchAPI('expenses', { method: 'POST', body: JSON.stringify(expense) }),
  deleteExpense: (id: string) => fetchAPI(`expenses/${id}`, { method: 'DELETE' }),
  
  // Bills
  getBills: () => fetchAPI('bills'),
  addBill: (bill: any) => fetchAPI('bills', { method: 'POST', body: JSON.stringify(bill) }),
  deleteBill: (id: string) => fetchAPI(`bills/${id}`, { method: 'DELETE' }),
  
  // Goals
  getGoals: () => fetchAPI('goals'),
  addGoal: (goal: any) => fetchAPI('goals', { method: 'POST', body: JSON.stringify(goal) }),
  updateGoal: (id: string, goal: any) => fetchAPI(`goals/${id}`, { method: 'PUT', body: JSON.stringify(goal) }),
  deleteGoal: (id: string) => fetchAPI(`goals/${id}`, { method: 'DELETE' }),
  
  // Bank Statement
  parseBankStatement: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/bank-statement/parse`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to parse statement');
    return response.json();
  },
  
  // Accounts
  getAccounts: () => fetchAPI('accounts'),
  addAccount: (account: any) => fetchAPI('accounts', { method: 'POST', body: JSON.stringify(account) }),
  updateAccount: (id: string, account: any) => fetchAPI(`accounts/${id}`, { method: 'PUT', body: JSON.stringify(account) }),
  deleteAccount: (id: string) => fetchAPI(`accounts/${id}`, { method: 'DELETE' }),
  
  // Account Transactions
  addAccountTransaction: (transaction: any) => fetchAPI('accounts/transactions', { method: 'POST', body: JSON.stringify(transaction) }),
  getAccountTransactions: (accountId: string) => fetchAPI(`accounts/${accountId}/transactions`),
  
  // Plan Payments
  addPlanPayment: (cardId: string, planId: string, amount: number, date?: string) => 
    fetchAPI('credit-cards/payments', { method: 'POST', body: JSON.stringify({ cardId, planId, amount, date }) }),
  deletePlanPayment: (cardId: string, planId: string, paymentId: string) =>
    fetchAPI('credit-cards/payments', { method: 'DELETE', body: JSON.stringify({ cardId, planId, paymentId }) }),
};

