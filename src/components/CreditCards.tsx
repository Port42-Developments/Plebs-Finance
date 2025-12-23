import { useState, useEffect } from 'react';
import { Plus, X, CreditCard, DollarSign } from 'lucide-react';
import { api } from '../api';
import { CreditCard as CreditCardType } from '../types';
import { parseISO, differenceInWeeks, differenceInDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export default function CreditCards() {
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [profile, setProfile] = useState<any>({ currency: 'NZD', timezone: 'Pacific/Auckland' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [cardForm, setCardForm] = useState({ name: '' });
  const [planForm, setPlanForm] = useState({
    name: '',
    amount: '',
    interestFreeMonths: '',
    interestFreeEndDate: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cc, p] = await Promise.all([api.getCreditCards(), api.getProfile()]);
      setCards(cc);
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

  const calculateWeeklyPayment = (amount: number, endDate: string): number => {
    const now = new Date();
    const end = parseISO(endDate);
    const weeks = differenceInWeeks(end, now);
    if (weeks <= 0) return amount; // If past due, return full amount
    return amount / weeks;
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addCreditCard({
        name: cardForm.name,
        plans: [],
      });
      setCardForm({ name: '' });
      setShowAddModal(false);
      loadData();
    } catch (error) {
      alert('Failed to add credit card');
    }
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId) return;

    const amount = parseFloat(planForm.amount);
    const weeklyPayment = calculateWeeklyPayment(amount, planForm.interestFreeEndDate);

    try {
      const card = cards.find((c) => c.id === selectedCardId);
      if (!card) return;

      const newPlan = {
        id: Date.now().toString(),
        name: planForm.name,
        amount,
        interestFreeMonths: parseInt(planForm.interestFreeMonths),
        interestFreeEndDate: planForm.interestFreeEndDate,
        weeklyPayment,
        payments: [],
        remainingBalance: amount,
      };

      await api.updateCreditCard(selectedCardId, {
        ...card,
        plans: [...card.plans, newPlan],
      });

      setPlanForm({
        name: '',
        amount: '',
        interestFreeMonths: '',
        interestFreeEndDate: '',
      });
      setShowPlanModal(false);
      setSelectedCardId(null);
      loadData();
    } catch (error) {
      alert('Failed to add plan');
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm('Delete this credit card?')) return;
    try {
      await api.deleteCreditCard(id);
      loadData();
    } catch (error) {
      alert('Failed to delete card');
    }
  };

  const handleDeletePlan = async (cardId: string, planId: string) => {
    if (!confirm('Delete this plan?')) return;
    try {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      await api.updateCreditCard(cardId, {
        ...card,
        plans: card.plans.filter((p) => p.id !== planId),
      });
      loadData();
    } catch (error) {
      alert('Failed to delete plan');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId || !selectedPlanId) return;

    try {
      await api.addPlanPayment(
        selectedCardId,
        selectedPlanId,
        parseFloat(paymentForm.amount),
        paymentForm.date
      );
      setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0] });
      setShowPaymentModal(false);
      setSelectedCardId(null);
      setSelectedPlanId(null);
      loadData();
    } catch (error) {
      alert('Failed to add payment');
    }
  };

  const totalDebt = cards.reduce((sum, card) => {
    return sum + card.plans.reduce((planSum, plan) => {
      const remaining = plan.remainingBalance !== undefined ? plan.remainingBalance : plan.amount;
      return planSum + remaining;
    }, 0);
  }, 0);

  const totalWeeklyPayments = cards.reduce((sum, card) => {
    return sum + card.plans.reduce((planSum, plan) => planSum + (plan.weeklyPayment || 0), 0);
  }, 0);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Credit Cards</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Card
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Total Debt</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Total Weekly Payment</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalWeeklyPayments)}</p>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-4">
        {cards.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No credit cards added yet</p>
          </div>
        ) : (
          cards.map((card) => {
            const cardTotal = card.plans.reduce((sum, plan) => sum + plan.amount, 0);
            const cardWeekly = card.plans.reduce((sum, plan) => sum + (plan.weeklyPayment || 0), 0);

            return (
              <div key={card.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">{card.name}</h2>
                    <p className="text-sm text-gray-600">
                      Total: {formatCurrency(cardTotal)} | Weekly: {formatCurrency(cardWeekly)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedCardId(card.id);
                        setShowPlanModal(true);
                      }}
                      className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                    >
                      Add Plan
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {card.plans.length === 0 ? (
                  <p className="text-gray-500 text-sm">No plans added</p>
                ) : (
                  <div className="space-y-3 mt-4">
                    {card.plans.map((plan) => {
                      const weeksLeft = differenceInWeeks(parseISO(plan.interestFreeEndDate), new Date());
                      const daysLeft = differenceInDays(parseISO(plan.interestFreeEndDate), new Date());
                      const remainingBalance = plan.remainingBalance !== undefined ? plan.remainingBalance : plan.amount;
                      const totalPaid = plan.amount - remainingBalance;
                      const payments = plan.payments || [];

                      return (
                        <div key={plan.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-semibold">{plan.name}</h3>
                              <p className="text-sm text-gray-600">
                                Original: {formatCurrency(plan.amount)} | Remaining: <span className="font-semibold text-red-600">{formatCurrency(remainingBalance)}</span>
                              </p>
                              {totalPaid > 0 && (
                                <p className="text-sm text-green-600">
                                  Paid: {formatCurrency(totalPaid)}
                                </p>
                              )}
                              <p className="text-sm text-gray-600">
                                Interest-free until: {formatDate(plan.interestFreeEndDate)}
                              </p>
                              <p className="text-sm text-gray-600">
                                {weeksLeft > 0 ? `${weeksLeft} weeks` : `${daysLeft} days`} remaining
                              </p>
                              {payments.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <p className="text-xs font-semibold text-gray-500 mb-1">Payment History:</p>
                                  {payments.slice(-3).map((payment) => (
                                    <p key={payment.id} className="text-xs text-gray-600">
                                      {formatDate(payment.date)}: {formatCurrency(payment.amount)}
                                    </p>
                                  ))}
                                  {payments.length > 3 && (
                                    <p className="text-xs text-gray-500">+{payments.length - 3} more</p>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-orange-600">
                                {formatCurrency(plan.weeklyPayment || 0)}/week
                              </p>
                              <button
                                onClick={() => {
                                  setSelectedCardId(card.id);
                                  setSelectedPlanId(plan.id);
                                  setShowPaymentModal(true);
                                }}
                                className="mt-2 bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 flex items-center gap-1"
                              >
                                <DollarSign className="w-3 h-3" />
                                Pay
                              </button>
                              <button
                                onClick={() => handleDeletePlan(card.id, plan.id)}
                                className="text-red-600 hover:text-red-800 mt-2"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Add Credit Card</h2>
            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Name</label>
                <input
                  type="text"
                  value={cardForm.name}
                  onChange={(e) => setCardForm({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., ASB Visa"
                  required
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

      {/* Add Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Add Plan</h2>
            <form onSubmit={handleAddPlan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Laptop Purchase"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={planForm.amount}
                  onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interest-Free Months</label>
                <input
                  type="number"
                  value={planForm.interestFreeMonths}
                  onChange={(e) => setPlanForm({ ...planForm, interestFreeMonths: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interest-Free End Date</label>
                <input
                  type="date"
                  value={planForm.interestFreeEndDate}
                  onChange={(e) => setPlanForm({ ...planForm, interestFreeEndDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPlanModal(false);
                    setSelectedCardId(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  Add Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedCardId && selectedPlanId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Make Payment</h2>
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedCardId(null);
                    setSelectedPlanId(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Make Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

