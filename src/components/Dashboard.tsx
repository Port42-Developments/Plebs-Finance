import { useState, useEffect } from 'react';
import { CreditCard as CreditCardIcon, Target, TrendingUp, TrendingDown, Wallet, Receipt, FileText, Calendar } from 'lucide-react';
import { api } from '../api';
import { CashflowEntry, CreditCard, Bill, Goal, Account, Expense } from '../types';
import { parseISO, isPast, isToday, startOfMonth, endOfMonth } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export default function Dashboard() {
  const [cashflow, setCashflow] = useState<CashflowEntry[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profile, setProfile] = useState<any>({ currency: 'NZD', timezone: 'Pacific/Auckland' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cf, cc, b, g, a, exp, p] = await Promise.all([
        api.getCashflow(),
        api.getCreditCards(),
        api.getBills(),
        api.getGoals(),
        api.getAccounts(),
        api.getExpenses(),
        api.getProfile(),
      ]);
      setCashflow(cf);
      setCreditCards(cc);
      setBills(b);
      setGoals(g);
      setAccounts(a);
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

  const formatDate = (dateStr: string) => {
    try {
      return formatInTimeZone(parseISO(dateStr), profile.timezone || 'Pacific/Auckland', 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return <div className="text-center py-12 dark:text-white">Loading...</div>;
  }

  // Calculate totals
  const totalIncome = cashflow
    .filter((c) => c.type === 'income')
    .reduce((sum, c) => sum + c.amount, 0);
  const totalExpenses = cashflow
    .filter((c) => c.type === 'expense')
    .reduce((sum, c) => sum + c.amount, 0);
  const netCashflow = totalIncome - totalExpenses;

  // Calculate remaining debt (not original)
  const totalDebt = creditCards.reduce((sum, card) => {
    return sum + card.plans.reduce((planSum, plan) => {
      const remaining = plan.remainingBalance !== undefined ? plan.remainingBalance : plan.amount;
      return planSum + remaining;
    }, 0);
  }, 0);

  const totalWeeklyPayments = creditCards.reduce((sum, card) => {
    return sum + card.plans.reduce((planSum, plan) => planSum + (plan.weeklyPayment || 0), 0);
  }, 0);

  // Accounts
  const totalAccountBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  // Monthly calculations
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthIncome = cashflow
    .filter((c) => {
      if (c.type !== 'income') return false;
      const entryDate = parseISO(c.date);
      return entryDate >= monthStart && entryDate <= monthEnd;
    })
    .reduce((sum, c) => sum + c.amount, 0);
  const monthExpenses = cashflow
    .filter((c) => {
      if (c.type !== 'expense') return false;
      const entryDate = parseISO(c.date);
      return entryDate >= monthStart && entryDate <= monthEnd;
    })
    .reduce((sum, c) => sum + c.amount, 0);

  // Expenses
  const totalExpensesAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const recurringExpenses = expenses.filter((e) => e.recurring);

  // Bills
  const unpaidBills = bills.filter((b) => !b.paid);
  const totalUnpaidBills = unpaidBills.reduce((sum, b) => sum + b.amount, 0);
  const overdueBills = unpaidBills.filter((b) => {
    const dueDate = parseISO(b.dueDate);
    return isPast(dueDate) && !isToday(dueDate);
  });

  // Goals
  const totalGoalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalGoalProgress = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const goalsProgress = goals.length > 0 ? (totalGoalProgress / totalGoalTarget) * 100 : 0;

  const upcomingBills = bills
    .filter((b) => !b.paid)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const recentCashflow = cashflow
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Net Cashflow</p>
              <p className={`text-2xl font-bold ${netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netCashflow)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total: {formatCurrency(totalIncome)} income, {formatCurrency(totalExpenses)} expenses</p>
            </div>
            {netCashflow >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-600" />
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Debt</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Weekly: {formatCurrency(totalWeeklyPayments)}</p>
            </div>
            <CreditCardIcon className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Account Balance</p>
              <p className={`text-2xl font-bold ${totalAccountBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalAccountBalance)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
            </div>
            <Wallet className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Goals Progress</p>
              <p className="text-2xl font-bold text-blue-600">{goalsProgress.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{goals.length} goal{goals.length !== 1 ? 's' : ''}</p>
            </div>
            <Target className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Monthly Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">This Month</p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Income</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(monthIncome)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Expenses</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(monthExpenses)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Net</p>
          <p className={`text-lg font-bold ${monthIncome - monthExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(monthIncome - monthExpenses)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-orange-600" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bills</p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Unpaid</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalUnpaidBills)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{unpaidBills.length} bill{unpaidBills.length !== 1 ? 's' : ''} due</p>
          {overdueBills.length > 0 && (
            <p className="text-xs text-red-600 mt-1 font-semibold">{overdueBills.length} overdue</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Expenses</p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Tracked</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpensesAmount)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{recurringExpenses.length} recurring expense{recurringExpenses.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cashflow */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold dark:text-white mb-4">Recent Cashflow</h2>
          {recentCashflow.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No cashflow entries yet</p>
          ) : (
            <div className="space-y-3">
              {recentCashflow.map((entry) => (
                <div key={entry.id} className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                  <div>
                    <p className="font-medium dark:text-white">{entry.description}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(entry.date)}</p>
                  </div>
                  <p className={`font-semibold ${entry.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Bills */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold dark:text-white mb-4">Upcoming Bills</h2>
          {upcomingBills.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No upcoming bills</p>
          ) : (
            <div className="space-y-3">
              {upcomingBills.map((bill) => {
                const dueDate = parseISO(bill.dueDate);
                const isOverdue = !bill.paid && isPast(dueDate) && !isToday(dueDate);
                return (
                  <div key={bill.id} className="flex justify-between items-center border-b dark:border-gray-700 pb-2">
                    <div>
                      <p className="font-medium dark:text-white">{bill.description}</p>
                      <p className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                        Due: {formatDate(bill.dueDate)} {isOverdue && '(Overdue)'}
                      </p>
                    </div>
                    <p className="font-semibold text-red-600">{formatCurrency(bill.amount)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Credit Cards Summary */}
      {creditCards.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold dark:text-white mb-4">Credit Card Plans</h2>
          <div className="space-y-3">
            {creditCards.map((card) => {
              const cardRemaining = card.plans.reduce((sum, plan) => {
                const remaining = plan.remainingBalance !== undefined ? plan.remainingBalance : plan.amount;
                return sum + remaining;
              }, 0);
              const cardWeekly = card.plans.reduce((sum, plan) => sum + (plan.weeklyPayment || 0), 0);
              
              return (
                <div key={card.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold dark:text-white">{card.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {card.plans.length} plan{card.plans.length !== 1 ? 's' : ''} | Remaining: {formatCurrency(cardRemaining)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Weekly Payment</p>
                      <p className="text-lg font-bold text-orange-600">{formatCurrency(cardWeekly)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Goals Summary */}
      {goals.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold dark:text-white mb-4">Goals Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.slice(0, 4).map((goal) => {
              const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
              return (
                <div key={goal.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold dark:text-white">{goal.name}</h3>
                    <p className="text-sm font-bold text-blue-600">{progress.toFixed(1)}%</p>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

