import { useState, useEffect } from 'react';
import { DollarSign, CreditCard as CreditCardIcon, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../api';
import { CashflowEntry, CreditCard, Bill, Goal } from '../types';
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export default function Dashboard() {
  const [cashflow, setCashflow] = useState<CashflowEntry[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [profile, setProfile] = useState<any>({ currency: 'NZD', timezone: 'Pacific/Auckland' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cf, cc, b, g, p] = await Promise.all([
        api.getCashflow(),
        api.getCreditCards(),
        api.getBills(),
        api.getGoals(),
        api.getProfile(),
      ]);
      setCashflow(cf);
      setCreditCards(cc);
      setBills(b);
      setGoals(g);
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
    return <div className="text-center py-12">Loading...</div>;
  }

  // Calculate totals
  const totalIncome = cashflow
    .filter((c) => c.type === 'income')
    .reduce((sum, c) => sum + c.amount, 0);
  const totalExpenses = cashflow
    .filter((c) => c.type === 'expense')
    .reduce((sum, c) => sum + c.amount, 0);
  const netCashflow = totalIncome - totalExpenses;

  const totalDebt = creditCards.reduce((sum, card) => {
    return sum + card.plans.reduce((planSum, plan) => planSum + plan.amount, 0);
  }, 0);

  const totalWeeklyPayments = creditCards.reduce((sum, card) => {
    return sum + card.plans.reduce((planSum, plan) => planSum + (plan.weeklyPayment || 0), 0);
  }, 0);

  const upcomingBills = bills
    .filter((b) => !b.paid)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const recentCashflow = cashflow
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Net Cashflow</p>
              <p className={`text-2xl font-bold ${netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netCashflow)}
              </p>
            </div>
            {netCashflow >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-600" />
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Debt</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
            </div>
            <CreditCardIcon className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Weekly Payments</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalWeeklyPayments)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Goals</p>
              <p className="text-2xl font-bold text-blue-600">{goals.length}</p>
            </div>
            <Target className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cashflow */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Cashflow</h2>
          {recentCashflow.length === 0 ? (
            <p className="text-gray-500">No cashflow entries yet</p>
          ) : (
            <div className="space-y-3">
              {recentCashflow.map((entry) => (
                <div key={entry.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{entry.description}</p>
                    <p className="text-sm text-gray-500">{formatDate(entry.date)}</p>
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
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Upcoming Bills</h2>
          {upcomingBills.length === 0 ? (
            <p className="text-gray-500">No upcoming bills</p>
          ) : (
            <div className="space-y-3">
              {upcomingBills.map((bill) => (
                <div key={bill.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{bill.description}</p>
                    <p className="text-sm text-gray-500">Due: {formatDate(bill.dueDate)}</p>
                  </div>
                  <p className="font-semibold text-red-600">{formatCurrency(bill.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

