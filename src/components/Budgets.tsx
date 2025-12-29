import { useState, useEffect } from 'react';
import { Plus, X, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { api } from '../api';
import { Budget, CashflowEntry, Expense } from '../types';
import { parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';

export default function Budgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [cashflow, setCashflow] = useState<CashflowEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profile, setProfile] = useState<any>({ currency: 'NZD', timezone: 'Pacific/Auckland' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    amount: '',
    period: 'monthly' as 'weekly' | 'monthly' | 'yearly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [b, cf, exp, p] = await Promise.all([
        api.getBudgets(),
        api.getCashflow(),
        api.getExpenses(),
        api.getProfile(),
      ]);
      setBudgets(b);
      setCashflow(cf);
      setExpenses(exp);
      setProfile(p);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: profile.currency || 'NZD',
    }).format(amount);
  };

  const calculateSpent = (budget: Budget): number => {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    // Determine current period based on budget period type
    if (budget.period === 'weekly') {
      periodStart = startOfWeek(now);
      periodEnd = endOfWeek(now);
    } else if (budget.period === 'monthly') {
      periodStart = startOfMonth(now);
      periodEnd = endOfMonth(now);
    } else {
      periodStart = startOfYear(now);
      periodEnd = endOfYear(now);
    }

    // Calculate spent from cashflow expenses
    // If budget has a category, only count expenses with matching category
    // If budget has no category, count all expenses
    const cashflowSpent = cashflow
      .filter((entry) => {
        if (entry.type !== 'expense') return false;
        const entryDate = parseISO(entry.date);
        if (!isWithinInterval(entryDate, { start: periodStart, end: periodEnd })) return false;
        
        // If budget has a category, only match expenses with that category
        if (budget.category) {
          return entry.category === budget.category;
        }
        // If budget has no category, count all expenses
        return true;
      })
      .reduce((sum, entry) => sum + entry.amount, 0);

    // Calculate spent from expenses
    const expensesSpent = expenses
      .filter((expense) => {
        const expenseDate = parseISO(expense.date);
        if (!isWithinInterval(expenseDate, { start: periodStart, end: periodEnd })) return false;
        
        // If budget has a category, only match expenses with that category
        if (budget.category) {
          return expense.category === budget.category;
        }
        // If budget has no category, count all expenses
        return true;
      })
      .reduce((sum, exp) => sum + exp.amount, 0);

    return cashflowSpent + expensesSpent;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addBudget({
        name: formData.name,
        category: formData.category || undefined,
        amount: parseFloat(formData.amount),
        period: formData.period,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
      });
      setShowAddModal(false);
      setFormData({
        name: '',
        category: '',
        amount: '',
        period: 'monthly',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
      });
      loadData();
    } catch (error) {
      alert('Failed to add budget');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return;
    try {
      await api.deleteBudget(id);
      loadData();
    } catch (error) {
      alert('Failed to delete budget');
    }
  };

  if (loading) {
    return <div className="text-center py-12 dark:text-white">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Budgets</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Budget
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Budgets</p>
          <p className="text-2xl font-bold text-blue-600">{budgets.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Budgeted</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(budgets.reduce((sum, b) => sum + b.amount, 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(budgets.reduce((sum, b) => sum + calculateSpent(b), 0))}
          </p>
        </div>
      </div>

      {/* Budgets List */}
      {budgets.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No budgets created yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {budgets.map((budget) => {
            const spent = calculateSpent(budget);
            const remaining = budget.amount - spent;
            const percentage = (spent / budget.amount) * 100;
            const isOverBudget = spent > budget.amount;

            return (
              <div key={budget.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold dark:text-white mb-1">{budget.name}</h2>
                    {budget.category && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{budget.category}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {budget.period.charAt(0).toUpperCase() + budget.period.slice(1)} budget
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Budget Amount */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Budgeted Amount</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(budget.amount)}</p>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium dark:text-white">Spent</span>
                    <span className={`text-sm font-bold ${isOverBudget ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
                      {formatCurrency(spent)} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        isOverBudget
                          ? 'bg-red-600'
                          : percentage > 80
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Remaining */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Remaining</p>
                  <p className={`text-xl font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(remaining)}
                  </p>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                  {isOverBudget ? (
                    <>
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-red-600 font-semibold">Over Budget</span>
                    </>
                  ) : remaining > 0 ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-semibold">On Track</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4 text-orange-600" />
                      <span className="text-sm text-orange-600 font-semibold">At Limit</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold dark:text-white mb-4">Add Budget</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budget Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Groceries, Entertainment"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category (Optional)</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Food, Transport"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budget Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period</label>
                <select
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date (Optional)</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  Add Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

