import { useState, useEffect } from 'react';
import { Plus, X, Target, Wallet } from 'lucide-react';
import { api } from '../api';
import { Goal, Account } from '../types';
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [profile, setProfile] = useState<any>({ currency: 'NZD', timezone: 'Pacific/Auckland' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '0',
    targetDate: '',
    accountId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [g, a, p] = await Promise.all([api.getGoals(), api.getAccounts(), api.getProfile()]);
      setAccounts(a);
      setProfile(p);
      
      // Sync goal amounts with linked accounts
      const updatedGoals = await Promise.all(
        g.map(async (goal: Goal) => {
          if (goal.accountId) {
            const account = a.find((acc: Account) => acc.id === goal.accountId);
            if (account && goal.currentAmount !== account.balance) {
              // Update goal to match account balance
              const updated = { ...goal, currentAmount: account.balance };
              try {
                await api.updateGoal(goal.id, updated);
                return updated;
              } catch {
                return goal;
              }
            }
          }
          return goal;
        })
      );
      
      setGoals(updatedGoals);
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

  const formatDate = (dateStr: string) => {
    try {
      return formatInTimeZone(parseISO(dateStr), profile.timezone || 'Pacific/Auckland', 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let currentAmount = parseFloat(formData.currentAmount);
      
      // If account is linked, use account balance
      if (formData.accountId) {
        const account = accounts.find((a) => a.id === formData.accountId);
        if (account) {
          currentAmount = account.balance;
        }
      }
      
      await api.addGoal({
        name: formData.name,
        targetAmount: parseFloat(formData.targetAmount),
        currentAmount,
        targetDate: formData.targetDate || undefined,
        accountId: formData.accountId || undefined,
      });
      setShowAddModal(false);
      setFormData({
        name: '',
        targetAmount: '',
        currentAmount: '0',
        targetDate: '',
        accountId: '',
      });
      loadData();
    } catch (error) {
      alert('Failed to add goal');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this goal?')) return;
    try {
      await api.deleteGoal(id);
      loadData();
    } catch (error) {
      alert('Failed to delete goal');
    }
  };

  const handleUpdateProgress = async (goal: Goal, newAmount: number) => {
    try {
      // If goal is linked to account, update account balance instead
      if (goal.accountId) {
        const account = accounts.find((a) => a.id === goal.accountId);
        if (account) {
          const difference = newAmount - goal.currentAmount;
          if (difference !== 0) {
            await api.addAccountTransaction({
              accountId: goal.accountId,
              amount: Math.abs(difference),
              type: difference > 0 ? 'deposit' : 'withdrawal',
              description: `Goal: ${goal.name}`,
              date: new Date().toISOString().split('T')[0],
            });
          }
        }
      } else {
        // Update goal directly if not linked
        await api.updateGoal(goal.id, {
          ...goal,
          currentAmount: newAmount,
        });
      }
      loadData();
    } catch (error) {
      alert('Failed to update goal');
    }
  };

  const getProgressPercentage = (goal: Goal) => {
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Goals</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No goals set yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const progress = getProgressPercentage(goal);
            const remaining = goal.targetAmount - goal.currentAmount;

            return (
              <div key={goal.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold mb-2">{goal.name}</h2>
                    <p className="text-sm text-gray-600">
                      {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                    </p>
                    {goal.accountId && (
                      <div className="flex items-center gap-1 mt-1">
                        <Wallet className="w-3 h-3 text-blue-600" />
                        <p className="text-xs text-blue-600">
                          Linked: {accounts.find((a) => a.id === goal.accountId)?.name || 'Unknown'}
                        </p>
                      </div>
                    )}
                    {goal.targetDate && (
                      <p className="text-sm text-gray-500 mt-1">
                        Target: {formatDate(goal.targetDate)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-indigo-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{progress.toFixed(1)}% complete</p>
                </div>

                {/* Remaining */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600">Remaining</p>
                  <p className="text-lg font-semibold text-orange-600">{formatCurrency(remaining)}</p>
                </div>

                {/* Update Progress */}
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Add amount"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        const amount = parseFloat(input.value);
                        if (!isNaN(amount) && amount > 0) {
                          handleUpdateProgress(goal, goal.currentAmount + amount);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.querySelector(`input[placeholder="Add amount"]`) as HTMLInputElement;
                      const amount = parseFloat(input?.value || '0');
                      if (!isNaN(amount) && amount > 0) {
                        handleUpdateProgress(goal, goal.currentAmount + amount);
                        if (input) input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Add Goal</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Emergency Fund"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link to Account (Optional)</label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No account (manual tracking)</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({formatCurrency(account.balance)})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  If linked, goal will automatically track the account balance
                </p>
              </div>
              {!formData.accountId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.currentAmount}
                    onChange={(e) => setFormData({ ...formData, currentAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Date (Optional)</label>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

