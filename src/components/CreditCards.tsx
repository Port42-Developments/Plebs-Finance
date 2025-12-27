import { useState, useEffect } from 'react';
import { Plus, X, CreditCard, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [showPaidOffPlans, setShowPaidOffPlans] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);

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
      console.log('[LOAD DATA] Fetching credit cards and profile...');
      const [cc, p] = await Promise.all([api.getCreditCards(), api.getProfile()]);
      console.log('[LOAD DATA] Credit cards received:', cc.length);
      
      // Log payments for each plan
      cc.forEach((card: any) => {
        card.plans.forEach((plan: any) => {
          if (plan.payments && plan.payments.length > 0) {
            console.log(`[LOAD DATA] Card ${card.id}, Plan ${plan.id} has ${plan.payments.length} payments:`, plan.payments.map((p: any) => p.id));
          }
        });
      });
      
      // API now handles all normalization and payment calculation
      setCards(cc);
      setProfile(p);
      console.log('[LOAD DATA] State updated');
    } catch (error) {
      console.error('[LOAD DATA] Failed to load data:', error);
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
    if (!selectedCardId || !selectedPlanId || !paymentForm.amount) return;
    if (isAddingPayment) return; // Prevent double-clicks
    setIsAddingPayment(true);

    const paymentAmount = parseFloat(paymentForm.amount);
    const paymentDate = paymentForm.date;

    // Store original state for potential revert
    const originalCards = JSON.parse(JSON.stringify(cards));

    // Find the plan
    const card = cards.find((c) => c.id === selectedCardId);
    if (!card) {
      setIsAddingPayment(false);
      return;
    }
    const plan = card.plans.find((p) => p.id === selectedPlanId);
    if (!plan) {
      setIsAddingPayment(false);
      return;
    }

    // Create new payment object for optimistic update
    const newPayment = {
      id: `temp_${Date.now()}`,
      amount: paymentAmount,
      date: paymentDate,
      createdAt: new Date().toISOString(),
    };

    // Optimistically update UI - add payment and recalculate
    const updatedCards = cards.map((card) => {
      if (card.id !== selectedCardId) return card;
      return {
        ...card,
        plans: card.plans.map((plan) => {
          if (plan.id !== selectedPlanId) return plan;
          
          const currentPayments = plan.payments || [];
          const updatedPayments = [...currentPayments, newPayment];
          const currentRemaining = plan.remainingBalance !== undefined ? plan.remainingBalance : plan.amount;
          const newRemaining = Math.max(0, currentRemaining - paymentAmount);
          
          // Recalculate weekly payment
          const now = new Date();
          const endDate = parseISO(plan.interestFreeEndDate);
          const weeksLeft = differenceInWeeks(endDate, now);
          let newWeeklyPayment = 0;
          if (weeksLeft > 0 && newRemaining > 0) {
            newWeeklyPayment = newRemaining / weeksLeft;
          } else if (newRemaining > 0) {
            newWeeklyPayment = newRemaining;
          }
          
          return {
            ...plan,
            payments: updatedPayments,
            remainingBalance: newRemaining,
            weeklyPayment: newWeeklyPayment,
          };
        }),
      };
    });

    setCards(updatedCards);
    setPaymentForm({ amount: '', date: new Date().toISOString().split('T')[0] });
    setShowPaymentModal(false);
    setSelectedCardId(null);
    setSelectedPlanId(null);

    // Update on server - reload to get correct data from API
    try {
      await api.addPlanPayment(selectedCardId, selectedPlanId, paymentAmount, paymentDate);
      // Reload to get the correct payment ID and calculated values from API
      await loadData();
    } catch (error) {
      // If API call fails, revert the optimistic update
      setCards(originalCards);
      alert('Failed to add payment. Please try again.');
    } finally {
      setIsAddingPayment(false);
    }
  };

  const handleDeletePayment = async (cardId: string, planId: string, paymentId: string, e?: React.MouseEvent) => {
    console.log('[DELETE PAYMENT] Starting delete payment flow', { cardId, planId, paymentId });
    
    // Stop event propagation to prevent any parent handlers
    if (e) {
      e.stopPropagation();
      e.preventDefault();
      console.log('[DELETE PAYMENT] Event propagation stopped');
    }
    
    if (!confirm('Delete this payment? This will restore the amount to the remaining balance.')) {
      console.log('[DELETE PAYMENT] User cancelled deletion');
      return;
    }
    
    if (isDeletingPayment) {
      console.log('[DELETE PAYMENT] Already deleting, ignoring duplicate call');
      return; // Prevent double-clicks
    }
    
    console.log('[DELETE PAYMENT] Setting isDeletingPayment to true');
    setIsDeletingPayment(true);
    
    try {
      console.log('[DELETE PAYMENT] Calling API deletePlanPayment...');
      // Call API immediately - wait for it to complete and save to KV
      const result = await api.deletePlanPayment(cardId, planId, paymentId);
      console.log('[DELETE PAYMENT] API response received:', result);
      console.log('[DELETE PAYMENT] Full response:', JSON.stringify(result, null, 2));
      console.log('[DELETE PAYMENT] Deleted payment ID:', result?.deletedPaymentId);
      console.log('[DELETE PAYMENT] Remaining payments count:', result?.remainingPaymentsCount);
      console.log('[DELETE PAYMENT] Remaining payment IDs:', result?.remainingPaymentIds);
      console.log('[DELETE PAYMENT] Verification - still exists?', result?.verification?.stillExists);
      console.log('[DELETE PAYMENT] Verification - saved count:', result?.verification?.savedCount);
      
      if (result && result.success) {
        console.log('[DELETE PAYMENT] API call successful, waiting 100ms before reload...');
        // Small delay to ensure KV consistency
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('[DELETE PAYMENT] Reloading data...');
        // After successful API call, reload data to get updated state from KV
        await loadData();
        console.log('[DELETE PAYMENT] Data reloaded successfully');
        
        // Verify by checking the fresh data from the API
        setTimeout(async () => {
          console.log('[DELETE PAYMENT] Verifying deletion by fetching fresh data...');
          try {
            const freshCards = await api.getCreditCards();
            const card = freshCards.find((c: any) => c.id === cardId);
            if (card) {
              const plan = card.plans.find((p: any) => p.id === planId);
              if (plan) {
                const paymentStillExists = plan.payments?.some((p: any) => p.id === paymentId);
                console.log('[DELETE PAYMENT] Payment still exists in fresh data?', paymentStillExists);
                console.log('[DELETE PAYMENT] Plan payments in fresh data:', plan.payments?.map((p: any) => p.id));
                if (paymentStillExists) {
                  console.error('[DELETE PAYMENT] ERROR: Payment still exists after deletion!');
                  console.error('[DELETE PAYMENT] This suggests the DELETE endpoint did not properly save to KV');
                } else {
                  console.log('[DELETE PAYMENT] SUCCESS: Payment successfully deleted and verified!');
                  // Update state with fresh data
                  setCards(freshCards);
                }
              }
            }
          } catch (error) {
            console.error('[DELETE PAYMENT] Error verifying deletion:', error);
          }
        }, 300);
      } else {
        console.error('[DELETE PAYMENT] API returned unsuccessful result:', result);
        throw new Error('Delete failed - API returned unsuccessful result');
      }
    } catch (error) {
      console.error('[DELETE PAYMENT] Error caught:', error);
      console.error('[DELETE PAYMENT] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error
      });
      alert('Failed to delete payment. Please try again. Check console for details.');
    } finally {
      console.log('[DELETE PAYMENT] Setting isDeletingPayment to false');
      setIsDeletingPayment(false);
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
            const cardTotal = card.plans.reduce((sum, plan) => {
              const remaining = plan.remainingBalance !== undefined ? plan.remainingBalance : plan.amount;
              return sum + remaining;
            }, 0);
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
                  <>
                    {/* Active Plans */}
                    <div className="space-y-3 mt-4">
                      {card.plans
                        .filter((plan) => {
                          const remainingBalance = plan.remainingBalance !== undefined ? plan.remainingBalance : plan.amount;
                          return remainingBalance > 0;
                        })
                        .map((plan) => {
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
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <p className="text-xs font-semibold text-gray-700 mb-2">Payment History ({payments.length}):</p>
                                      <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {payments
                                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                          .map((payment) => (
                                            <div key={payment.id} className="flex justify-between items-center text-xs group hover:bg-gray-50 px-1 py-0.5 rounded">
                                              <span className="text-gray-600">{formatDate(payment.date)}</span>
                                              <div className="flex items-center gap-2">
                                                <span className="font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    handleDeletePayment(card.id, plan.id, payment.id, e);
                                                  }}
                                                  className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded transition-colors"
                                                  title="Delete payment"
                                                  type="button"
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
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

                    {/* Paid Off Plans (Collapsible) */}
                    {card.plans.filter((plan) => {
                      const remainingBalance = plan.remainingBalance !== undefined ? plan.remainingBalance : plan.amount;
                      return remainingBalance === 0;
                    }).length > 0 && (
                      <div className="mt-4">
                        <button
                          onClick={() => setShowPaidOffPlans({ ...showPaidOffPlans, [card.id]: !showPaidOffPlans[card.id] })}
                          className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-800 w-full"
                        >
                          {showPaidOffPlans[card.id] ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                          <span>
                            Paid Off Plans ({card.plans.filter((plan) => {
                              const remainingBalance = plan.remainingBalance !== undefined ? plan.remainingBalance : plan.amount;
                              return remainingBalance === 0;
                            }).length})
                          </span>
                        </button>
                        {showPaidOffPlans[card.id] && (
                          <div className="space-y-3 mt-3">
                            {card.plans
                              .filter((plan) => {
                                const remainingBalance = plan.remainingBalance !== undefined ? plan.remainingBalance : plan.amount;
                                return remainingBalance === 0;
                              })
                              .map((plan) => {
                                const payments = plan.payments || [];
                                return (
                                  <div key={plan.id} className="border border-green-200 bg-green-50 rounded-lg p-4 opacity-75">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <h3 className="font-semibold text-green-800">{plan.name}</h3>
                                          <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full font-semibold">
                                            PAID OFF
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">
                                          Original: {formatCurrency(plan.amount)} | Paid: <span className="font-semibold text-green-600">{formatCurrency(plan.amount)}</span>
                                        </p>
                                        {payments.length > 0 && (
                                          <div className="mt-3 pt-3 border-t border-green-200">
                                            <p className="text-xs font-semibold text-gray-700 mb-2">Payment History ({payments.length}):</p>
                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                              {payments
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map((payment) => (
                                                  <div key={payment.id} className="flex justify-between items-center text-xs group hover:bg-green-100 px-1 py-0.5 rounded">
                                                    <span className="text-gray-600">{formatDate(payment.date)}</span>
                                                    <div className="flex items-center gap-2">
                                                      <span className="font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          e.preventDefault();
                                                          handleDeletePayment(card.id, plan.id, payment.id, e);
                                                        }}
                                                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded transition-colors"
                                                        title="Delete payment"
                                                        type="button"
                                                      >
                                                        <X className="w-3 h-3" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleDeletePlan(card.id, plan.id)}
                                        className="text-red-600 hover:text-red-800"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
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

