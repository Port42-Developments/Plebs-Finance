const API_BASE = '/api';

// Get current userId from localStorage
const getUserId = (): string | null => {
  return localStorage.getItem('currentUserId');
};

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const userId = getUserId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  // Add userId to headers if available
  if (userId) {
    headers['X-User-Id'] = userId;
  }
  
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}

export const api = {
  // User Management
  registerUser: (username: string, pin: string, name?: string) => 
    fetchAPI('auth/register', { method: 'POST', body: JSON.stringify({ username, pin, name }) }),
  loginUser: (username: string, pin: string) => 
    fetchAPI('auth/login', { method: 'POST', body: JSON.stringify({ username, pin }) }),
  getUsers: () => fetchAPI('users'),
  
  // Auth (legacy support)
  verifyPin: (pin: string) => fetchAPI('auth/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  changePin: (oldPin: string, newPin: string) => {
    const userId = getUserId();
    return fetchAPI('auth/change-pin', { method: 'POST', body: JSON.stringify({ oldPin, newPin, userId }) });
  },
  
  // Profile
  getProfile: () => fetchAPI('user/profile'),
  updateProfile: (profile: any) => {
    const userId = getUserId();
    return fetchAPI('user/profile', { method: 'POST', body: JSON.stringify({ ...profile, userId }) });
  },
  
  // Cashflow
  getCashflow: () => fetchAPI('cashflow'),
  addCashflow: (entry: any) => {
    const userId = getUserId();
    return fetchAPI('cashflow', { method: 'POST', body: JSON.stringify({ ...entry, userId }) });
  },
  deleteCashflow: (id: string) => {
    const userId = getUserId();
    return fetchAPI(`cashflow/${id}`, { method: 'DELETE', body: JSON.stringify({ userId }) });
  },
  
  // Credit Cards
  getCreditCards: async () => {
    console.log('[API] getCreditCards called');
    const result = await fetchAPI('credit-cards');
    console.log('[API] getCreditCards result:', result.length, 'cards');
    return result;
  },
  addCreditCard: (card: any) => {
    const userId = getUserId();
    return fetchAPI('credit-cards', { method: 'POST', body: JSON.stringify({ ...card, userId }) });
  },
  updateCreditCard: (id: string, card: any) => {
    const userId = getUserId();
    return fetchAPI(`credit-cards/${id}`, { method: 'PUT', body: JSON.stringify({ ...card, userId }) });
  },
  deleteCreditCard: (id: string) => {
    const userId = getUserId();
    return fetchAPI(`credit-cards/${id}`, { method: 'DELETE', body: JSON.stringify({ userId }) });
  },
  
  // Expenses
  getExpenses: () => fetchAPI('expenses'),
  addExpense: (expense: any) => {
    const userId = getUserId();
    return fetchAPI('expenses', { method: 'POST', body: JSON.stringify({ ...expense, userId }) });
  },
  deleteExpense: (id: string) => {
    const userId = getUserId();
    return fetchAPI(`expenses/${id}`, { method: 'DELETE', body: JSON.stringify({ userId }) });
  },
  
  // Bills
  getBills: () => fetchAPI('bills'),
  addBill: (bill: any) => {
    const userId = getUserId();
    return fetchAPI('bills', { method: 'POST', body: JSON.stringify({ ...bill, userId }) });
  },
  deleteBill: (id: string) => {
    const userId = getUserId();
    return fetchAPI(`bills/${id}`, { method: 'DELETE', body: JSON.stringify({ userId }) });
  },
  
  // Goals
  getGoals: () => fetchAPI('goals'),
  addGoal: (goal: any) => {
    const userId = getUserId();
    return fetchAPI('goals', { method: 'POST', body: JSON.stringify({ ...goal, userId }) });
  },
  updateGoal: (id: string, goal: any) => {
    const userId = getUserId();
    return fetchAPI(`goals/${id}`, { method: 'PUT', body: JSON.stringify({ ...goal, userId }) });
  },
  deleteGoal: (id: string) => {
    const userId = getUserId();
    return fetchAPI(`goals/${id}`, { method: 'DELETE', body: JSON.stringify({ userId }) });
  },
  
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
  addAccount: (account: any) => {
    const userId = getUserId();
    return fetchAPI('accounts', { method: 'POST', body: JSON.stringify({ ...account, userId }) });
  },
  updateAccount: (id: string, account: any) => {
    const userId = getUserId();
    return fetchAPI(`accounts/${id}`, { method: 'PUT', body: JSON.stringify({ ...account, userId }) });
  },
  deleteAccount: (id: string) => {
    const userId = getUserId();
    return fetchAPI(`accounts/${id}`, { method: 'DELETE', body: JSON.stringify({ userId }) });
  },
  
  // Account Transactions
  addAccountTransaction: (transaction: any) => {
    const userId = getUserId();
    return fetchAPI('accounts/transactions', { method: 'POST', body: JSON.stringify({ ...transaction, userId }) });
  },
  getAccountTransactions: (accountId: string) => fetchAPI(`accounts/${accountId}/transactions`),
  
  // Plan Payments
  addPlanPayment: (cardId: string, planId: string, amount: number, date?: string) => {
    const userId = getUserId();
    return fetchAPI('credit-cards/payments', { method: 'POST', body: JSON.stringify({ cardId, planId, amount, date, userId }) });
  },
  deletePlanPayment: async (cardId: string, planId: string, paymentId: string) => {
    const userId = getUserId();
    console.log('[API] deletePlanPayment called with:', { cardId, planId, paymentId });
    console.log('[API] Making DELETE request to:', `${API_BASE}/credit-cards/payments`);
    
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (userId) headers['X-User-Id'] = userId;
      
      const response = await fetch(`${API_BASE}/credit-cards/payments`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ cardId, planId, paymentId, userId }),
      });
      
      console.log('[API] Response status:', response.status, response.statusText);
      console.log('[API] Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Response not OK, error text:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || 'Request failed' };
        }
        console.error('[API] Parsed error:', error);
        throw new Error(error.error || 'Request failed');
      }
      
      const result = await response.json();
      console.log('[API] Response JSON:', result);
      return result;
    } catch (error) {
      console.error('[API] Exception in deletePlanPayment:', error);
      throw error;
    }
  },
};

