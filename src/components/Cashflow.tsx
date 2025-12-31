import { useState, useEffect, useMemo } from 'react';
import { Plus, Upload, X, Tag, Edit2, Check, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { CashflowEntry, Account } from '../types';
import { parseISO, startOfMonth, endOfMonth, format, isWithinInterval, getYear, getMonth } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type?: 'income' | 'expense';
  category?: string;
}

export default function Cashflow() {
  const [cashflow, setCashflow] = useState<CashflowEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>({ currency: 'NZD', timezone: 'Pacific/Auckland' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [parsingFormat, setParsingFormat] = useState<string>('');
  const [detectedBalance, setDetectedBalance] = useState<number | null>(null);
  const [editingEntry, setEditingEntry] = useState<CashflowEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all'); // 'all' or account ID
  const [importAccountId, setImportAccountId] = useState<string>(''); // Account for import
  const [updateAccountBalance, setUpdateAccountBalance] = useState(false); // Whether to update account balance
  const [currentMonthYear, setCurrentMonthYear] = useState<{ month: number; year: number } | null>(null); // Current month/year being viewed

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'income' as 'income' | 'expense',
    category: '',
    accountId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cf, a, b, p] = await Promise.all([api.getCashflow(), api.getAccounts(), api.getBudgets(), api.getProfile()]);
      setCashflow(cf);
      setAccounts(a);
      setBudgets(b);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const entryData = {
        ...formData,
        amount: parseFloat(formData.amount),
        category: formData.category || undefined,
        accountId: formData.accountId || undefined,
      };
      
      if (editingEntry) {
        await api.updateCashflow(editingEntry.id, entryData);
        setEditingEntry(null);
      } else {
        await api.addCashflow(entryData);
      }
      
      setShowAddModal(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        type: 'income',
        category: '',
        accountId: '',
      });
      loadData();
    } catch (error) {
      alert('Failed to save cashflow entry');
    }
  };

  const handleEdit = (entry: CashflowEntry) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date.split('T')[0],
      description: entry.description,
      amount: entry.amount.toString(),
      type: entry.type,
      category: entry.category || '',
      accountId: entry.accountId || '',
    });
    setShowAddModal(true);
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setShowAddModal(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      type: 'income',
      category: '',
      accountId: '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await api.deleteCashflow(id);
      loadData();
    } catch (error) {
      alert('Failed to delete entry');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const result = await api.parseBankStatement(file);
      if (result.transactions && result.transactions.length > 0) {
        // Prepare transactions for preview
        const previewTransactions: ParsedTransaction[] = result.transactions.map((t: any) => ({
          date: t.date,
          description: t.description || 'Bank transaction',
          amount: Math.abs(t.amount),
          type: t.amount >= 0 ? 'income' : 'expense',
          category: '',
        }));
        
        setParsedTransactions(previewTransactions);
        setParsingFormat(result.format || 'CSV/Text');
        setDetectedBalance(result.balance !== undefined ? result.balance : null);
        setUpdateAccountBalance(false); // Reset checkbox
        setShowUploadModal(false);
        setShowPreviewModal(true);
      } else {
        alert('No transactions found in statement. Please check the file format.');
      }
    } catch (error: any) {
      alert(`Failed to parse bank statement: ${error.message || 'Unknown error'}`);
    } finally {
      setParsing(false);
    }
  };

  const handleUpdatePreviewTransaction = (index: number, field: keyof ParsedTransaction, value: any) => {
    const updated = [...parsedTransactions];
    updated[index] = { ...updated[index], [field]: value };
    setParsedTransactions(updated);
  };

  const handleRemovePreviewTransaction = (index: number) => {
    setParsedTransactions(parsedTransactions.filter((_, i) => i !== index));
  };

  const handleImportTransactions = async () => {
    console.log('[Cashflow] handleImportTransactions called with', parsedTransactions.length, 'transactions');
    
    if (parsedTransactions.length === 0) {
      console.warn('[Cashflow] No transactions to import');
      alert('No transactions to import');
      return;
    }
    
    setImporting(true);
    setImportProgress({ current: 0, total: parsedTransactions.length });
    
    try {
      let imported = 0;
      let failed = 0;
      const errors: string[] = [];
      
      for (let i = 0; i < parsedTransactions.length; i++) {
        const transaction = parsedTransactions[i];
        console.log(`[Cashflow] Importing transaction ${i + 1}/${parsedTransactions.length}:`, transaction);
        
        // Update progress
        setImportProgress({ current: i + 1, total: parsedTransactions.length });
        
        try {
          // Validate transaction data
          if (!transaction.date) {
            throw new Error('Missing date');
          }
          if (!transaction.description) {
            throw new Error('Missing description');
          }
          if (transaction.amount === undefined || transaction.amount === null || isNaN(transaction.amount)) {
            throw new Error('Invalid amount');
          }
          
          // Ensure date is in ISO format (YYYY-MM-DD)
          let formattedDate = transaction.date;
          if (formattedDate.includes('T')) {
            formattedDate = formattedDate.split('T')[0];
          }
          // Validate date format
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(formattedDate)) {
            console.warn(`[Cashflow] Invalid date format: ${formattedDate}, attempting to fix...`);
            // Try to parse and reformat
            const parsedDate = new Date(formattedDate);
            if (!isNaN(parsedDate.getTime())) {
              formattedDate = parsedDate.toISOString().split('T')[0];
            } else {
              throw new Error(`Invalid date format: ${formattedDate}`);
            }
          }
          
          const entryData = {
            date: formattedDate,
            description: transaction.description.trim() || 'Bank transaction',
            amount: Math.abs(transaction.amount), // Ensure positive amount
            type: transaction.type || (transaction.amount >= 0 ? 'income' : 'expense'),
            category: transaction.category?.trim() || undefined,
            accountId: importAccountId || undefined,
          };
          
          console.log(`[Cashflow] Sending entry data:`, entryData);
          const result = await api.addCashflow(entryData);
          console.log(`[Cashflow] Import result for transaction ${i + 1}:`, result);
          imported++;
        } catch (error: any) {
          failed++;
          const errorMsg = `Transaction ${i + 1} failed: ${error.message || 'Unknown error'}`;
          console.error(`[Cashflow] ${errorMsg}`, error);
          errors.push(errorMsg);
        }
      }
      
      console.log(`[Cashflow] Import complete: ${imported} imported, ${failed} failed`);
      
      // Update account balance if requested and balance was detected
      if (updateAccountBalance && importAccountId && detectedBalance !== null) {
        try {
          const account = accounts.find(a => a.id === importAccountId);
          if (account) {
            console.log(`[Cashflow] Updating account balance for ${account.name} to ${detectedBalance}`);
            await api.updateAccount(importAccountId, {
              ...account,
              balance: detectedBalance,
            });
            console.log(`[Cashflow] Account balance updated successfully`);
          }
        } catch (error: any) {
          console.error('[Cashflow] Failed to update account balance:', error);
          // Don't fail the import if balance update fails
        }
      }
      
      setShowPreviewModal(false);
      setParsedTransactions([]);
      setImportAccountId('');
      setDetectedBalance(null);
      setUpdateAccountBalance(false);
      await loadData();
      
      if (failed > 0) {
        alert(`Imported ${imported} transaction${imported !== 1 ? 's' : ''}, but ${failed} failed:\n${errors.join('\n')}`);
      } else {
        const balanceMsg = updateAccountBalance && detectedBalance !== null 
          ? `\nAccount balance updated to ${formatCurrency(detectedBalance)}.`
          : '';
        alert(`Successfully imported ${imported} transaction${imported !== 1 ? 's' : ''}.${balanceMsg}`);
      }
    } catch (error: any) {
      console.error('[Cashflow] Import error:', error);
      alert(`Failed to import transactions: ${error.message || 'Unknown error'}`);
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  // Filter cashflow by selected account
  const filteredCashflow = selectedAccountId === 'all' 
    ? cashflow 
    : cashflow.filter(entry => entry.accountId === selectedAccountId);
  
  // Get all available months/years from cashflow data
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    filteredCashflow.forEach(entry => {
      try {
        const date = parseISO(entry.date);
        const monthKey = `${getYear(date)}-${getMonth(date)}`;
        monthSet.add(monthKey);
      } catch (e) {
        // Skip invalid dates
      }
    });
    return Array.from(monthSet)
      .map(key => {
        const [year, month] = key.split('-').map(Number);
        return { year, month };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  }, [filteredCashflow]);
  
  // Initialize current month/year to the most recent month with data
  useEffect(() => {
    if (availableMonths.length > 0 && currentMonthYear === null) {
      setCurrentMonthYear(availableMonths[0]);
    }
  }, [availableMonths, currentMonthYear]);
  
  // Filter cashflow by selected month/year
  const monthFilteredCashflow = useMemo(() => {
    if (!currentMonthYear) return filteredCashflow;
    
    const monthStart = startOfMonth(new Date(currentMonthYear.year, currentMonthYear.month));
    const monthEnd = endOfMonth(new Date(currentMonthYear.year, currentMonthYear.month));
    
    return filteredCashflow.filter(entry => {
      try {
        const entryDate = parseISO(entry.date);
        return isWithinInterval(entryDate, { start: monthStart, end: monthEnd });
      } catch (e) {
        return false;
      }
    });
  }, [filteredCashflow, currentMonthYear]);
  
  const sortedCashflow = [...monthFilteredCashflow].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  // Get account name helper
  const getAccountName = (accountId?: string) => {
    if (!accountId) return null;
    const account = accounts.find(a => a.id === accountId);
    return account?.name || null;
  };
  
  // Navigation functions
  // Previous = go to older month (higher index in sorted array)
  const goToPreviousMonth = () => {
    if (!currentMonthYear) return;
    const currentIndex = availableMonths.findIndex(
      m => m.year === currentMonthYear.year && m.month === currentMonthYear.month
    );
    if (currentIndex < availableMonths.length - 1) {
      setCurrentMonthYear(availableMonths[currentIndex + 1]);
    }
  };
  
  // Next = go to newer month (lower index in sorted array)
  const goToNextMonth = () => {
    if (!currentMonthYear) return;
    const currentIndex = availableMonths.findIndex(
      m => m.year === currentMonthYear.year && m.month === currentMonthYear.month
    );
    if (currentIndex > 0) {
      setCurrentMonthYear(availableMonths[currentIndex - 1]);
    }
  };
  
  const totalIncome = monthFilteredCashflow.filter((c) => c.type === 'income').reduce((sum, c) => sum + c.amount, 0);
  const totalExpenses = monthFilteredCashflow.filter((c) => c.type === 'expense').reduce((sum, c) => sum + c.amount, 0);

  if (loading) {
    return <div className="text-center py-12 dark:text-white">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cashflow</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Statement
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Account Filter */}
      {accounts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Account:</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Month Navigation */}
      {availableMonths.length > 0 && currentMonthYear && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPreviousMonth}
              disabled={availableMonths.findIndex(m => m.year === currentMonthYear.year && m.month === currentMonthYear.month) >= availableMonths.length - 1}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {format(new Date(currentMonthYear.year, currentMonthYear.month), 'MMMM yyyy')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {availableMonths.length} month{availableMonths.length !== 1 ? 's' : ''} with data
              </p>
            </div>
            
            <button
              onClick={goToNextMonth}
              disabled={availableMonths.findIndex(m => m.year === currentMonthYear.year && m.month === currentMonthYear.month) === 0}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentMonthYear ? `Income (${format(new Date(currentMonthYear.year, currentMonthYear.month), 'MMM yyyy')})` : 'Total Income'}
          </p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentMonthYear ? `Expenses (${format(new Date(currentMonthYear.year, currentMonthYear.month), 'MMM yyyy')})` : 'Total Expenses'}
          </p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentMonthYear ? `Net (${format(new Date(currentMonthYear.year, currentMonthYear.month), 'MMM yyyy')})` : 'Net Cashflow'}
          </p>
          <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalIncome - totalExpenses)}
          </p>
        </div>
      </div>

      {/* Cashflow List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedCashflow.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    {currentMonthYear 
                      ? `No cashflow entries for ${format(new Date(currentMonthYear.year, currentMonthYear.month), 'MMMM yyyy')}`
                      : 'No cashflow entries yet'}
                  </td>
                </tr>
              ) : (
                sortedCashflow.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(entry.date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{entry.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getAccountName(entry.accountId) ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {getAccountName(entry.accountId)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {entry.category ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {entry.category}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          entry.type === 'income'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${
                      entry.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          title="Delete"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold dark:text-white mb-4">
              {editingEntry ? 'Edit Cashflow Entry' : 'Add Cashflow Entry'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              {accounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Account <span className="text-xs text-gray-500">(optional)</span>
                  </label>
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">No Account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Associate this transaction with a specific account
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category <span className="text-xs text-gray-500">(for budget tracking)</span>
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Groceries, Entertainment, Transport"
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  {budgets
                    .filter((b) => b.category)
                    .map((b) => b.category)
                    .filter((cat, index, self) => self.indexOf(cat) === index)
                    .map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                </datalist>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Tag this transaction to match it with a budget category
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'income' | 'expense' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  {editingEntry ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold dark:text-white mb-4">Upload Bank Statement</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Upload a bank statement file. Supported formats:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 mb-4 list-disc list-inside space-y-1">
              <li>CSV files (with or without headers)</li>
              <li>TSV files (tab-separated)</li>
              <li>OFX/QFX files (Quicken/QuickBooks format)</li>
              <li>Plain text files</li>
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
              The parser will automatically detect the format and extract transactions. You'll be able to review and edit them before importing.
            </p>
            <input
              type="file"
              accept=".csv,.txt,.ofx,.qfx"
              onChange={handleFileUpload}
              disabled={parsing}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg mb-4 disabled:opacity-50"
            />
            {parsing && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">Parsing file...</p>
            )}
            <button
              onClick={() => setShowUploadModal(false)}
              disabled={parsing}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl my-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-bold dark:text-white">Review Parsed Transactions</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Found {parsedTransactions.length} transaction{parsedTransactions.length !== 1 ? 's' : ''} 
                  {parsingFormat && ` (${parsingFormat} format)`}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setParsedTransactions([]);
                  setImportAccountId('');
                  setDetectedBalance(null);
                  setUpdateAccountBalance(false);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Review and edit transactions before importing:</strong> You can modify dates, descriptions, amounts, types, and add categories. 
                Remove any transactions you don't want to import.
              </p>
            </div>

            {/* Account Selection for Import */}
            {accounts.length > 0 && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Assign all transactions to account: <span className="text-xs text-gray-500">(optional)</span>
                  </label>
                  <select
                    value={importAccountId}
                    onChange={(e) => setImportAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">No Account (General)</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    All transactions in this import will be assigned to the selected account
                  </p>
                </div>
                
                {/* Balance Update Option */}
                {detectedBalance !== null && importAccountId && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id="update-balance"
                        checked={updateAccountBalance}
                        onChange={(e) => setUpdateAccountBalance(e.target.checked)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <label htmlFor="update-balance" className="block text-sm font-medium text-blue-800 dark:text-blue-300 cursor-pointer">
                          Update account balance
                        </label>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Detected balance: <strong>{formatCurrency(detectedBalance)}</strong>
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          {updateAccountBalance 
                            ? `The account balance will be set to ${formatCurrency(detectedBalance)} after import.`
                            : 'Check this to update the account balance to the detected value from the CSV.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="max-h-96 overflow-y-auto mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Category</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {parsedTransactions.map((transaction, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={transaction.date}
                          onChange={(e) => handleUpdatePreviewTransaction(index, 'date', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-xs"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={transaction.description}
                          onChange={(e) => handleUpdatePreviewTransaction(index, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-xs"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={transaction.type}
                          onChange={(e) => handleUpdatePreviewTransaction(index, 'type', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-xs"
                        >
                          <option value="income">Income</option>
                          <option value="expense">Expense</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={transaction.amount}
                          onChange={(e) => handleUpdatePreviewTransaction(index, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-xs"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={transaction.category || ''}
                          onChange={(e) => handleUpdatePreviewTransaction(index, 'category', e.target.value)}
                          placeholder="Optional"
                          list={`category-preview-${index}`}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-xs"
                        />
                        <datalist id={`category-preview-${index}`}>
                          {budgets
                            .filter((b) => b.category)
                            .map((b) => b.category)
                            .filter((cat, idx, self) => self.indexOf(cat) === idx)
                            .map((cat) => (
                              <option key={cat} value={cat} />
                            ))}
                        </datalist>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleRemovePreviewTransaction(index)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsedTransactions.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No transactions to import. All transactions have been removed.
              </p>
            )}

            {/* Import Progress Bar */}
            {importing && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Importing transactions...
                  </span>
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {importProgress.current} / {importProgress.total}
                  </span>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-500 dark:bg-blue-500 h-full transition-all duration-300 ease-out rounded-full"
                    style={{
                      width: `${(importProgress.current / importProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Please wait while transactions are being imported...
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setParsedTransactions([]);
                  setImportAccountId('');
                  setDetectedBalance(null);
                  setUpdateAccountBalance(false);
                }}
                disabled={importing}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleImportTransactions}
                disabled={parsedTransactions.length === 0 || importing}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Import {parsedTransactions.length} Transaction{parsedTransactions.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

