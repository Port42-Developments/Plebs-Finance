import { useState, useEffect } from 'react';
import { Plus, X, ArrowDown, ArrowUp, Wallet } from 'lucide-react';
import { api } from '../api';
import { Account, AccountTransaction } from '../types';
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [profile, setProfile] = useState<any>({ currency: 'NZD', timezone: 'Pacific/Auckland' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'checking' as 'checking' | 'savings' | 'investment' | 'other',
    balance: '0',
  });

  const [transactionForm, setTransactionForm] = useState({
    type: 'deposit' as 'deposit' | 'withdrawal',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [acc, p] = await Promise.all([api.getAccounts(), api.getProfile()]);
      setAccounts(acc);
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

  const formatDate = (dateStr: string) => {
    try {
      return formatInTimeZone(parseISO(dateStr), profile.timezone || 'Pacific/Auckland', 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addAccount({
        name: accountForm.name,
        type: accountForm.type,
        balance: parseFloat(accountForm.balance) || 0,
      });
      setAccountForm({ name: '', type: 'checking', balance: '0' });
      setShowAddModal(false);
      loadData();
    } catch (error) {
      alert('Failed to add account');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Delete this account? This will also delete all transactions.')) return;
    try {
      await api.deleteAccount(id);
      loadData();
    } catch (error) {
      alert('Failed to delete account');
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    try {
      await api.addAccountTransaction({
        accountId: selectedAccount.id,
        amount: parseFloat(transactionForm.amount),
        type: transactionForm.type,
        description: transactionForm.description,
        date: transactionForm.date,
      });
      setTransactionForm({
        type: 'deposit',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
      setShowTransactionModal(false);
      setSelectedAccount(null);
      loadData();
    } catch (error) {
      alert('Failed to add transaction');
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Accounts</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-gray-600">Total Balance Across All Accounts</p>
        <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(totalBalance)}
        </p>
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No accounts added yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div key={account.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-1">{account.name}</h2>
                  <p className="text-sm text-gray-500 capitalize">{account.type}</p>
                </div>
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600">Balance</p>
                <p className={`text-2xl font-bold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(account.balance)}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedAccount(account);
                    setTransactionForm({
                      type: 'deposit',
                      amount: '',
                      description: '',
                      date: new Date().toISOString().split('T')[0],
                    });
                    setShowTransactionModal(true);
                  }}
                  className="flex-1 bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 text-sm"
                >
                  <ArrowDown className="w-4 h-4" />
                  Deposit
                </button>
                <button
                  onClick={() => {
                    setSelectedAccount(account);
                    setTransactionForm({
                      type: 'withdrawal',
                      amount: '',
                      description: '',
                      date: new Date().toISOString().split('T')[0],
                    });
                    setShowTransactionModal(true);
                  }}
                  className="flex-1 bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 flex items-center justify-center gap-2 text-sm"
                >
                  <ArrowUp className="w-4 h-4" />
                  Withdraw
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Add Account</h2>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Main Savings"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={accountForm.type}
                  onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="investment">Investment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={accountForm.balance}
                  onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })}
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

      {/* Transaction Modal */}
      {showTransactionModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">
              {transactionForm.type === 'deposit' ? 'Deposit' : 'Withdraw'} - {selectedAccount.name}
            </h2>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={transactionForm.amount}
                  onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Salary deposit"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={transactionForm.date}
                  onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTransactionModal(false);
                    setSelectedAccount(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-2 rounded-lg text-white ${
                    transactionForm.type === 'deposit'
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {transactionForm.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

