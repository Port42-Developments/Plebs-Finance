export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');
  const method = request.method;

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  const kv = env.FINANCE_KV;
  if (!kv) {
    return new Response(JSON.stringify({ error: 'KV not configured' }), {
      status: 500,
      headers,
    });
  }

  try {
    // Auth endpoints
    if (path === 'auth/verify' && method === 'POST') {
      const { pin } = await request.json();
      const storedPin = await kv.get('user:pin');
      
      if (!storedPin) {
        // First time setup - create PIN
        await kv.put('user:pin', pin);
        return new Response(JSON.stringify({ success: true, firstTime: true }), { headers });
      }
      
      if (storedPin === pin) {
        return new Response(JSON.stringify({ success: true }), { headers });
      }
      
      return new Response(JSON.stringify({ success: false, error: 'Invalid PIN' }), {
        status: 401,
        headers,
      });
    }

    if (path === 'auth/change-pin' && method === 'POST') {
      const { oldPin, newPin } = await request.json();
      const storedPin = await kv.get('user:pin');
      
      if (storedPin !== oldPin) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid current PIN' }), {
          status: 401,
          headers,
        });
      }
      
      await kv.put('user:pin', newPin);
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // User profile endpoints
    if (path === 'user/profile' && method === 'GET') {
      const profile = await kv.get('user:profile', 'json') || {
        name: '',
        picture: '',
        currency: 'NZD',
        timezone: 'Pacific/Auckland',
      };
      return new Response(JSON.stringify(profile), { headers });
    }

    if (path === 'user/profile' && method === 'POST') {
      const profile = await request.json();
      await kv.put('user:profile', JSON.stringify(profile));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Cashflow endpoints
    if (path === 'cashflow' && method === 'GET') {
      const cashflow = await kv.get('cashflow', 'json') || [];
      return new Response(JSON.stringify(cashflow), { headers });
    }

    if (path === 'cashflow' && method === 'POST') {
      const entry = await request.json();
      const cashflow = (await kv.get('cashflow', 'json')) || [];
      entry.id = Date.now().toString();
      entry.createdAt = new Date().toISOString();
      cashflow.push(entry);
      await kv.put('cashflow', JSON.stringify(cashflow));
      return new Response(JSON.stringify(entry), { headers });
    }

    if (path.startsWith('cashflow/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const cashflow = (await kv.get('cashflow', 'json')) || [];
      const filtered = cashflow.filter((e: any) => e.id !== id);
      await kv.put('cashflow', JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Credit card plans endpoints
    if (path === 'credit-cards' && method === 'GET') {
      console.log('[API GET] Fetching credit cards...');
      const cardsData = await kv.get('credit-cards', 'json');
      const cards = cardsData || [];
      console.log('[API GET] Cards found:', cards.length);
      
      // Get all payments from separate storage
      console.log('[API GET] Fetching payments from plan-payments KV...');
      const allPaymentsData = await kv.get('plan-payments', 'json');
      const allPayments = allPaymentsData || [];
      console.log('[API GET] Total payments in KV:', allPayments.length);
      console.log('[API GET] Payment IDs:', allPayments.map((p: any) => p.id));
      
      // Normalize data - attach payments from separate storage and calculate balances
      const normalizedCards = cards.map((card: any) => ({
        ...card,
        plans: (card.plans || []).map((plan: any) => {
          // Get payments for this plan
          const planPayments = allPayments.filter((p: any) => p.planId === plan.id && p.cardId === card.id);
          console.log(`[API GET] Plan ${plan.id} (card ${card.id}) has ${planPayments.length} payments:`, planPayments.map((p: any) => p.id));
          
          // Calculate remaining balance from payments
          const totalPaid = planPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
          const remainingBalance = Math.max(0, plan.amount - totalPaid);
          
          // Calculate weekly payment
          const now = new Date();
          const endDate = new Date(plan.interestFreeEndDate);
          const timeDiff = endDate.getTime() - now.getTime();
          const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
          const weeksLeft = Math.ceil(daysLeft / 7);
          
          let weeklyPayment = 0;
          if (weeksLeft > 0 && remainingBalance > 0) {
            weeklyPayment = remainingBalance / weeksLeft;
          } else if (remainingBalance > 0) {
            weeklyPayment = remainingBalance;
          }
          
          return {
            ...plan,
            payments: planPayments,
            remainingBalance,
            weeklyPayment,
          };
        }),
      }));
      
      console.log('[API GET] Returning normalized cards');
      return new Response(JSON.stringify(normalizedCards), { headers });
    }

    if (path === 'credit-cards' && method === 'POST') {
      const card = await request.json();
      const cards = (await kv.get('credit-cards', 'json')) || [];
      card.id = Date.now().toString();
      cards.push(card);
      await kv.put('credit-cards', JSON.stringify(cards));
      return new Response(JSON.stringify(card), { headers });
    }

    if (path.startsWith('credit-cards/') && method === 'PUT') {
      const id = path.split('/')[1];
      const updatedCard = await request.json();
      const cardsData = await kv.get('credit-cards', 'json');
      const cards = cardsData ? JSON.parse(JSON.stringify(cardsData)) : []; // Deep clone
      
      const index = cards.findIndex((c: any) => c.id === id);
      if (index !== -1) {
        // Ensure plans have payments arrays
        const normalizedCard = {
          ...updatedCard,
          plans: (updatedCard.plans || []).map((plan: any) => ({
            ...plan,
            payments: plan.payments || [],
            remainingBalance: plan.remainingBalance !== undefined ? plan.remainingBalance : plan.amount,
          })),
        };
        
        cards[index] = normalizedCard;
        await kv.put('credit-cards', JSON.stringify(cards));
        return new Response(JSON.stringify(cards[index]), { headers });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }

    if (path.startsWith('credit-cards/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const cards = (await kv.get('credit-cards', 'json')) || [];
      const filtered = cards.filter((c: any) => c.id !== id);
      await kv.put('credit-cards', JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Expenses endpoints
    if (path === 'expenses' && method === 'GET') {
      const expenses = await kv.get('expenses', 'json') || [];
      return new Response(JSON.stringify(expenses), { headers });
    }

    if (path === 'expenses' && method === 'POST') {
      const expense = await request.json();
      const expenses = (await kv.get('expenses', 'json')) || [];
      expense.id = Date.now().toString();
      expense.createdAt = new Date().toISOString();
      expenses.push(expense);
      await kv.put('expenses', JSON.stringify(expenses));
      return new Response(JSON.stringify(expense), { headers });
    }

    if (path.startsWith('expenses/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const expenses = (await kv.get('expenses', 'json')) || [];
      const filtered = expenses.filter((e: any) => e.id !== id);
      await kv.put('expenses', JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Bills endpoints
    if (path === 'bills' && method === 'GET') {
      const bills = await kv.get('bills', 'json') || [];
      return new Response(JSON.stringify(bills), { headers });
    }

    if (path === 'bills' && method === 'POST') {
      const bill = await request.json();
      const bills = (await kv.get('bills', 'json')) || [];
      bill.id = Date.now().toString();
      bill.createdAt = new Date().toISOString();
      bills.push(bill);
      await kv.put('bills', JSON.stringify(bills));
      return new Response(JSON.stringify(bill), { headers });
    }

    if (path.startsWith('bills/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const bills = (await kv.get('bills', 'json')) || [];
      const filtered = bills.filter((b: any) => b.id !== id);
      await kv.put('bills', JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Goals endpoints
    if (path === 'goals' && method === 'GET') {
      const goals = await kv.get('goals', 'json') || [];
      return new Response(JSON.stringify(goals), { headers });
    }

    if (path === 'goals' && method === 'POST') {
      const goal = await request.json();
      const goals = (await kv.get('goals', 'json')) || [];
      goal.id = Date.now().toString();
      goal.createdAt = new Date().toISOString();
      goals.push(goal);
      await kv.put('goals', JSON.stringify(goals));
      return new Response(JSON.stringify(goal), { headers });
    }

    if (path.startsWith('goals/') && method === 'PUT') {
      const id = path.split('/')[1];
      const updatedGoal = await request.json();
      const goals = (await kv.get('goals', 'json')) || [];
      const index = goals.findIndex((g: any) => g.id === id);
      if (index !== -1) {
        goals[index] = { ...goals[index], ...updatedGoal };
        await kv.put('goals', JSON.stringify(goals));
        return new Response(JSON.stringify(goals[index]), { headers });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }

    if (path.startsWith('goals/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const goals = (await kv.get('goals', 'json')) || [];
      const filtered = goals.filter((g: any) => g.id !== id);
      await kv.put('goals', JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Accounts endpoints
    if (path === 'accounts' && method === 'GET') {
      const accounts = await kv.get('accounts', 'json') || [];
      return new Response(JSON.stringify(accounts), { headers });
    }

    if (path === 'accounts' && method === 'POST') {
      const account = await request.json();
      const accounts = (await kv.get('accounts', 'json')) || [];
      account.id = Date.now().toString();
      account.balance = account.balance || 0;
      account.createdAt = new Date().toISOString();
      accounts.push(account);
      await kv.put('accounts', JSON.stringify(accounts));
      return new Response(JSON.stringify(account), { headers });
    }

    if (path.startsWith('accounts/') && method === 'PUT') {
      const id = path.split('/')[1];
      const updatedAccount = await request.json();
      const accounts = (await kv.get('accounts', 'json')) || [];
      const index = accounts.findIndex((a: any) => a.id === id);
      if (index !== -1) {
        accounts[index] = { ...accounts[index], ...updatedAccount };
        await kv.put('accounts', JSON.stringify(accounts));
        return new Response(JSON.stringify(accounts[index]), { headers });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }

    if (path.startsWith('accounts/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const accounts = (await kv.get('accounts', 'json')) || [];
      const filtered = accounts.filter((a: any) => a.id !== id);
      await kv.put('accounts', JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Account transactions endpoints
    if (path === 'accounts/transactions' && method === 'POST') {
      const transaction = await request.json();
      const accounts = (await kv.get('accounts', 'json')) || [];
      const accountIndex = accounts.findIndex((a: any) => a.id === transaction.accountId);
      
      if (accountIndex === -1) {
        return new Response(JSON.stringify({ error: 'Account not found' }), { status: 404, headers });
      }

      // Update account balance
      if (transaction.type === 'deposit') {
        accounts[accountIndex].balance += transaction.amount;
      } else if (transaction.type === 'withdrawal') {
        accounts[accountIndex].balance -= transaction.amount;
      }

      await kv.put('accounts', JSON.stringify(accounts));

      // Store transaction
      const transactions = (await kv.get('account-transactions', 'json')) || [];
      transaction.id = Date.now().toString();
      transaction.createdAt = new Date().toISOString();
      transactions.push(transaction);
      await kv.put('account-transactions', JSON.stringify(transactions));

      return new Response(JSON.stringify(transaction), { headers });
    }

    if (path.includes('/transactions') && method === 'GET') {
      const parts = path.split('/');
      if (parts.length === 3 && parts[0] === 'accounts' && parts[2] === 'transactions') {
        const accountId = parts[1];
        const transactions = (await kv.get('account-transactions', 'json')) || [];
        const filtered = transactions.filter((t: any) => t.accountId === accountId);
        return new Response(JSON.stringify(filtered), { headers });
      }
    }

    // Plan payment endpoints
    if (path === 'credit-cards/payments' && method === 'POST') {
      const { cardId, planId, amount, date } = await request.json();
      
      // Verify card and plan exist
      const cardsData = await kv.get('credit-cards', 'json');
      const cards = cardsData || [];
      const card = cards.find((c: any) => c.id === cardId);
      if (!card) {
        return new Response(JSON.stringify({ error: 'Card not found' }), { status: 404, headers });
      }
      const plan = card.plans.find((p: any) => p.id === planId);
      if (!plan) {
        return new Response(JSON.stringify({ error: 'Plan not found' }), { status: 404, headers });
      }

      // Create payment and store separately
      const payment = {
        id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        cardId,
        planId,
        amount: parseFloat(amount),
        date: date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };

      // Get existing payments and add new one
      const paymentsData = await kv.get('plan-payments', 'json');
      const payments = paymentsData || [];
      payments.push(payment);
      
      // Save payments to separate KV key
      await kv.put('plan-payments', JSON.stringify(payments));

      return new Response(JSON.stringify(payment), { headers });
    }

    // Delete payment endpoint
    if (path === 'credit-cards/payments' && method === 'DELETE') {
      const body = await request.json();
      const { cardId, planId, paymentId } = body;
      
      // Get payments from separate storage
      const paymentsData = await kv.get('plan-payments', 'json');
      const payments = paymentsData || [];
      
      // Debug: Log what we're looking for and what we have
      const debugInfo = {
        lookingFor: { paymentId, cardId, planId },
        totalPayments: payments.length,
        paymentIds: payments.map((p: any) => p.id),
        matchingPayments: payments.filter((p: any) => 
          p.id === paymentId || p.cardId === cardId || p.planId === planId
        ).map((p: any) => ({ id: p.id, cardId: p.cardId, planId: p.planId }))
      };
      
      // Find payment to delete - must match ALL three: id, cardId, planId
      const paymentIndex = payments.findIndex((p: any) => 
        p.id === paymentId && String(p.cardId) === String(cardId) && String(p.planId) === String(planId)
      );
      
      if (paymentIndex === -1) {
        // Try to find by ID only to see if it exists
        const byIdOnly = payments.findIndex((p: any) => p.id === paymentId);
        return new Response(JSON.stringify({ 
          error: 'Payment not found',
          debug: {
            ...debugInfo,
            foundByIdOnly: byIdOnly !== -1,
            paymentById: byIdOnly !== -1 ? payments[byIdOnly] : null
          }
        }), { status: 404, headers });
      }

      // Remove payment from array
      const paymentToDelete = payments[paymentIndex];
      const updatedPayments = payments.filter((p: any, index: number) => index !== paymentIndex);
      
      // Save updated payments back to KV
      await kv.put('plan-payments', JSON.stringify(updatedPayments));
      
      // Verify it was saved by reading it back immediately
      const verifyData = await kv.get('plan-payments', 'json');
      const verifyPayments = verifyData || [];
      const stillExists = verifyPayments.some((p: any) => p.id === paymentId);
      
      // Return success with debug info
      return new Response(JSON.stringify({ 
        success: true,
        deletedPaymentId: paymentId,
        deletedPayment: paymentToDelete,
        remainingPaymentsCount: updatedPayments.length,
        remainingPaymentIds: updatedPayments.map((p: any) => p.id),
        verification: {
          savedCount: verifyPayments.length,
          stillExists: stillExists,
          verifyPaymentIds: verifyPayments.map((p: any) => p.id)
        },
        debug: debugInfo
      }), { headers });
    }

    // Bank statement parsing endpoint
    if (path === 'bank-statement/parse' && method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers,
        });
      }

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Simple CSV/TSV parser - looks for date, description, amount patterns
      const transactions: any[] = [];
      const datePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/;
      const amountPattern = /[\$]?([\d,]+\.?\d*)/;
      
      for (const line of lines) {
        if (datePattern.test(line)) {
          const dateMatch = line.match(datePattern);
          const amountMatch = line.match(amountPattern);
          
          if (dateMatch && amountMatch) {
            const dateStr = dateMatch[0];
            const amountStr = amountMatch[1].replace(/,/g, '');
            const amount = parseFloat(amountStr);
            
            if (!isNaN(amount)) {
              transactions.push({
                date: dateStr,
                description: line.replace(datePattern, '').replace(amountPattern, '').trim(),
                amount: amount,
              });
            }
          }
        }
      }
      
      return new Response(JSON.stringify({ transactions }), { headers });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }
}

