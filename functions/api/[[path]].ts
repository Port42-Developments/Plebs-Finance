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

  // Helper function to get user-scoped key
  const getUserKey = (userId: string, key: string) => `user:${userId}:${key}`;

  // Helper to extract userId from request (header or body)
  const getUserId = async (request: Request): Promise<string | null> => {
    // First check header
    const headerUserId = request.headers.get('X-User-Id');
    if (headerUserId) return headerUserId;
    
    // For POST/PUT/DELETE, try to get from body
    if (method !== 'GET' && method !== 'OPTIONS') {
      try {
        const body = await request.clone().json().catch(() => ({}));
        return body.userId || null;
      } catch {
        return null;
      }
    }
    
    return null;
  };

  try {
    // User registration endpoint
    if (path === 'auth/register' && method === 'POST') {
      const { username, pin, name } = await request.json();
      
      if (!username || !pin) {
        return new Response(JSON.stringify({ success: false, error: 'Username and PIN are required' }), {
          status: 400,
          headers,
        });
      }

      // Check if username already exists
      const users = (await kv.get('users:list', 'json')) || [];
      if (users.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
        return new Response(JSON.stringify({ success: false, error: 'Username already exists' }), {
          status: 400,
          headers,
        });
      }

      // Create new user
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newUser = {
        id: userId,
        username: username.toLowerCase(),
        name: name || username,
        picture: '',
        currency: 'NZD',
        timezone: 'Pacific/Auckland',
        createdAt: new Date().toISOString(),
      };

      // Store user PIN
      await kv.put(getUserKey(userId, 'pin'), pin);
      
      // Store user profile
      await kv.put(getUserKey(userId, 'profile'), JSON.stringify({
        name: newUser.name,
        picture: '',
        currency: 'NZD',
        timezone: 'Pacific/Auckland',
        darkMode: false,
      }));

      // Add to users list
      users.push(newUser);
      await kv.put('users:list', JSON.stringify(users));

      return new Response(JSON.stringify({ success: true, user: newUser }), { headers });
    }

    // User login endpoint
    if (path === 'auth/login' && method === 'POST') {
      const { username, pin } = await request.json();
      
      if (!username || !pin) {
        return new Response(JSON.stringify({ success: false, error: 'Username and PIN are required' }), {
          status: 400,
          headers,
        });
      }

      // Find user
      const users = (await kv.get('users:list', 'json')) || [];
      const user = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
      
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid username or PIN' }), {
          status: 401,
          headers,
        });
      }

      // Verify PIN
      const storedPin = await kv.get(getUserKey(user.id, 'pin'));
      if (storedPin !== pin) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid username or PIN' }), {
          status: 401,
          headers,
        });
      }

      return new Response(JSON.stringify({ success: true, user }), { headers });
    }

    // Get all users (for user switching)
    if (path === 'users' && method === 'GET') {
      const users = (await kv.get('users:list', 'json')) || [];
      // Don't return PINs
      const safeUsers = users.map((u: any) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        picture: u.picture,
        createdAt: u.createdAt,
      }));
      return new Response(JSON.stringify(safeUsers), { headers });
    }

    // Migrate legacy user endpoint
    if (path === 'auth/migrate-legacy' && method === 'POST') {
      const { username, pin } = await request.json();
      
      // Check if legacy PIN exists
      const legacyPin = await kv.get('user:pin');
      if (!legacyPin || legacyPin !== pin) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid PIN' }), {
          status: 401,
          headers,
        });
      }

      // Check if user already exists
      const users = (await kv.get('users:list', 'json')) || [];
      const existingUser = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
      if (existingUser) {
        return new Response(JSON.stringify({ success: false, error: 'Username already exists' }), {
          status: 400,
          headers,
        });
      }

      // Create new user from legacy account
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newUser = {
        id: userId,
        username: username.toLowerCase(),
        name: username,
        picture: '',
        currency: 'NZD',
        timezone: 'Pacific/Auckland',
        createdAt: new Date().toISOString(),
      };

      // Migrate data from legacy keys to user-scoped keys
      const legacyProfile = await kv.get('user:profile', 'json') || {};
      if (legacyProfile.name) newUser.name = legacyProfile.name;
      if (legacyProfile.picture) newUser.picture = legacyProfile.picture;
      if (legacyProfile.currency) newUser.currency = legacyProfile.currency;
      if (legacyProfile.timezone) newUser.timezone = legacyProfile.timezone;

      // Store user PIN
      await kv.put(getUserKey(userId, 'pin'), pin);
      
      // Store user profile
      await kv.put(getUserKey(userId, 'profile'), JSON.stringify({
        name: newUser.name,
        picture: newUser.picture,
        currency: newUser.currency,
        timezone: newUser.timezone,
        darkMode: legacyProfile.darkMode || false,
      }));

      // Migrate all data
      const legacyCashflow = await kv.get('cashflow', 'json') || [];
      if (legacyCashflow.length > 0) {
        await kv.put(getUserKey(userId, 'cashflow'), JSON.stringify(legacyCashflow));
      }

      const legacyCreditCards = await kv.get('credit-cards', 'json') || [];
      if (legacyCreditCards.length > 0) {
        await kv.put(getUserKey(userId, 'credit-cards'), JSON.stringify(legacyCreditCards));
      }

      const legacyPlanPayments = await kv.get('plan-payments', 'json') || [];
      if (legacyPlanPayments.length > 0) {
        await kv.put(getUserKey(userId, 'plan-payments'), JSON.stringify(legacyPlanPayments));
      }

      const legacyAccounts = await kv.get('accounts', 'json') || [];
      if (legacyAccounts.length > 0) {
        await kv.put(getUserKey(userId, 'accounts'), JSON.stringify(legacyAccounts));
      }

      const legacyAccountTransactions = await kv.get('account-transactions', 'json') || [];
      if (legacyAccountTransactions.length > 0) {
        await kv.put(getUserKey(userId, 'account-transactions'), JSON.stringify(legacyAccountTransactions));
      }

      const legacyExpenses = await kv.get('expenses', 'json') || [];
      if (legacyExpenses.length > 0) {
        await kv.put(getUserKey(userId, 'expenses'), JSON.stringify(legacyExpenses));
      }

      const legacyBills = await kv.get('bills', 'json') || [];
      if (legacyBills.length > 0) {
        await kv.put(getUserKey(userId, 'bills'), JSON.stringify(legacyBills));
      }

      const legacyGoals = await kv.get('goals', 'json') || [];
      if (legacyGoals.length > 0) {
        await kv.put(getUserKey(userId, 'goals'), JSON.stringify(legacyGoals));
      }

      const legacyBudgets = await kv.get('budgets', 'json') || [];
      if (legacyBudgets.length > 0) {
        await kv.put(getUserKey(userId, 'budgets'), JSON.stringify(legacyBudgets));
      }

      // Add to users list
      users.push(newUser);
      await kv.put('users:list', JSON.stringify(users));

      // Optionally delete legacy keys (comment out if you want to keep them as backup)
      // await kv.delete('user:pin');
      // await kv.delete('user:profile');
      // etc...

      return new Response(JSON.stringify({ success: true, user: newUser }), { headers });
    }

    // Legacy auth endpoints (for backward compatibility - single user mode)
    if (path === 'auth/verify' && method === 'POST') {
      const { pin, userId } = await request.json();
      
      // If userId provided, use multi-user mode
      if (userId) {
        const storedPin = await kv.get(getUserKey(userId, 'pin'));
        if (storedPin === pin) {
          return new Response(JSON.stringify({ success: true }), { headers });
        }
        return new Response(JSON.stringify({ success: false, error: 'Invalid PIN' }), {
          status: 401,
          headers,
        });
      }

      // Legacy single-user mode - check if legacy PIN exists
      const storedPin = await kv.get('user:pin');
      
      if (!storedPin) {
        // First time setup - create PIN (but this is now handled by registration)
        await kv.put('user:pin', pin);
        return new Response(JSON.stringify({ success: true, firstTime: true, needsMigration: false }), { headers });
      }
      
      if (storedPin === pin) {
        // Legacy user exists - they need to migrate
        return new Response(JSON.stringify({ success: true, needsMigration: true }), { headers });
      }
      
      return new Response(JSON.stringify({ success: false, error: 'Invalid PIN' }), {
        status: 401,
        headers,
      });
    }

    if (path === 'auth/change-pin' && method === 'POST') {
      const { oldPin, newPin, userId } = await request.json();
      
      // If userId provided, use multi-user mode
      if (userId) {
        const storedPin = await kv.get(getUserKey(userId, 'pin'));
        if (storedPin !== oldPin) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid current PIN' }), {
            status: 401,
            headers,
          });
        }
        await kv.put(getUserKey(userId, 'pin'), newPin);
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // Legacy single-user mode
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
      const userId = await getUserId(request);
      
      if (userId) {
        // Multi-user mode
        const profile = await kv.get(getUserKey(userId, 'profile'), 'json') || {
          name: '',
          picture: '',
          currency: 'NZD',
          timezone: 'Pacific/Auckland',
          darkMode: false,
        };
        return new Response(JSON.stringify(profile), { headers });
      }

      // Legacy single-user mode
      const profile = await kv.get('user:profile', 'json') || {
        name: '',
        picture: '',
        currency: 'NZD',
        timezone: 'Pacific/Auckland',
        darkMode: false,
      };
      return new Response(JSON.stringify(profile), { headers });
    }

    if (path === 'user/profile' && method === 'POST') {
      const body = await request.json();
      const { userId, ...profile } = body;
      
      if (userId) {
        // Multi-user mode
        await kv.put(getUserKey(userId, 'profile'), JSON.stringify(profile));
        // Also update user in users list
        const users = (await kv.get('users:list', 'json')) || [];
        const userIndex = users.findIndex((u: any) => u.id === userId);
        if (userIndex !== -1) {
          users[userIndex] = { ...users[userIndex], ...profile };
          await kv.put('users:list', JSON.stringify(users));
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // Legacy single-user mode
      await kv.put('user:profile', JSON.stringify(profile));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Cashflow endpoints
    if (path === 'cashflow' && method === 'GET') {
      const userId = await getUserId(request);
      const key = userId ? getUserKey(userId, 'cashflow') : 'cashflow';
      const cashflow = await kv.get(key, 'json') || [];
      return new Response(JSON.stringify(cashflow), { headers });
    }

    if (path === 'cashflow' && method === 'POST') {
      const body = await request.json();
      const { userId, ...entry } = body;
      const key = userId ? getUserKey(userId, 'cashflow') : 'cashflow';
      const cashflow = (await kv.get(key, 'json')) || [];
      entry.id = Date.now().toString();
      entry.createdAt = new Date().toISOString();
      cashflow.push(entry);
      await kv.put(key, JSON.stringify(cashflow));
      return new Response(JSON.stringify(entry), { headers });
    }

    if (path.startsWith('cashflow/') && method === 'PUT') {
      const id = path.split('/')[1];
      const body = await request.json();
      const { userId, ...updatedEntry } = body;
      const key = userId ? getUserKey(userId, 'cashflow') : 'cashflow';
      const cashflow = (await kv.get(key, 'json')) || [];
      const index = cashflow.findIndex((e: any) => e.id === id);
      if (index !== -1) {
        cashflow[index] = { ...cashflow[index], ...updatedEntry };
        await kv.put(key, JSON.stringify(cashflow));
        return new Response(JSON.stringify(cashflow[index]), { headers });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }

    if (path.startsWith('cashflow/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const { userId } = await request.json().catch(() => ({}));
      const key = userId ? getUserKey(userId, 'cashflow') : 'cashflow';
      const cashflow = (await kv.get(key, 'json')) || [];
      const filtered = cashflow.filter((e: any) => e.id !== id);
      await kv.put(key, JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Credit card plans endpoints
    if (path === 'credit-cards' && method === 'GET') {
      const userId = await getUserId(request);
      const cardsKey = userId ? getUserKey(userId, 'credit-cards') : 'credit-cards';
      const paymentsKey = userId ? getUserKey(userId, 'plan-payments') : 'plan-payments';
      
      console.log('[API GET] Fetching credit cards...', userId ? `(user: ${userId})` : '(legacy)');
      const cardsData = await kv.get(cardsKey, 'json');
      const cards = cardsData || [];
      console.log('[API GET] Cards found:', cards.length);
      
      // Get all payments from separate storage
      console.log('[API GET] Fetching payments from plan-payments KV...');
      const allPaymentsData = await kv.get(paymentsKey, 'json');
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
      const body = await request.json();
      const { userId, ...card } = body;
      const cardsKey = userId ? getUserKey(userId, 'credit-cards') : 'credit-cards';
      const cards = (await kv.get(cardsKey, 'json')) || [];
      card.id = Date.now().toString();
      cards.push(card);
      await kv.put(cardsKey, JSON.stringify(cards));
      return new Response(JSON.stringify(card), { headers });
    }

    // Plan payment endpoints - MUST come before generic credit-cards/ endpoints
    if (path === 'credit-cards/payments' && method === 'POST') {
      const body = await request.json();
      const { cardId, planId, amount, date, userId } = body;
      const cardsKey = userId ? getUserKey(userId, 'credit-cards') : 'credit-cards';
      const paymentsKey = userId ? getUserKey(userId, 'plan-payments') : 'plan-payments';
      
      // Verify card and plan exist
      const cardsData = await kv.get(cardsKey, 'json');
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
      const paymentsData = await kv.get(paymentsKey, 'json');
      const payments = paymentsData || [];
      payments.push(payment);
      
      // Save payments to separate KV key
      await kv.put(paymentsKey, JSON.stringify(payments));

      return new Response(JSON.stringify(payment), { headers });
    }

    // Delete payment endpoint - MUST come before generic credit-cards/ endpoints
    if (path === 'credit-cards/payments' && method === 'DELETE') {
      // UNIQUE MARKER to confirm this code is running
      const body = await request.json();
      const { cardId, planId, paymentId, userId } = body;
      const paymentsKey = userId ? getUserKey(userId, 'plan-payments') : 'plan-payments';
      
      // Get payments from separate storage
      const paymentsData = await kv.get(paymentsKey, 'json');
      const payments = paymentsData || [];
      
      // Find payment to delete by ID only (IDs should be unique)
      const paymentIndex = payments.findIndex((p: any) => String(p.id) === String(paymentId));
      
      if (paymentIndex === -1) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Payment not found',
          codeVersion: 'v2-delete-endpoint',
          paymentId,
          totalPayments: payments.length,
          allPaymentIds: payments.map((p: any) => p.id)
        }), { status: 404, headers });
      }

      // Remove payment from array - create new array without the payment
      const paymentToDelete = payments[paymentIndex];
      const updatedPayments = payments.filter((p: any, idx: number) => idx !== paymentIndex);
      
      // Save updated payments back to KV
      await kv.put('plan-payments', JSON.stringify(updatedPayments));
      
      // Return success with debug info - ALWAYS include codeVersion to confirm this code path
      return new Response(JSON.stringify({ 
        success: true,
        codeVersion: 'v2-delete-endpoint-2024',
        deletedPaymentId: paymentId,
        beforeCount: payments.length,
        afterCount: updatedPayments.length,
        remainingPaymentIds: updatedPayments.map((p: any) => p.id),
        deletedPayment: paymentToDelete,
        timestamp: new Date().toISOString()
      }), { headers });
    }

    if (path.startsWith('credit-cards/') && method === 'PUT') {
      const id = path.split('/')[1];
      const body = await request.json();
      const { userId, ...updatedCard } = body;
      const cardsKey = userId ? getUserKey(userId, 'credit-cards') : 'credit-cards';
      const cardsData = await kv.get(cardsKey, 'json');
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
        await kv.put(cardsKey, JSON.stringify(cards));
        return new Response(JSON.stringify(cards[index]), { headers });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }

    // Delete credit card endpoint - must check it's NOT a payment endpoint
    if (path.startsWith('credit-cards/') && method === 'DELETE' && path !== 'credit-cards/payments') {
      const id = path.split('/')[1];
      const body = await request.json().catch(() => ({}));
      const { userId } = body;
      const cardsKey = userId ? getUserKey(userId, 'credit-cards') : 'credit-cards';
      const cards = (await kv.get(cardsKey, 'json')) || [];
      const filtered = cards.filter((c: any) => c.id !== id);
      await kv.put(cardsKey, JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Expenses endpoints
    if (path === 'expenses' && method === 'GET') {
      const userId = await getUserId(request);
      const expensesKey = userId ? getUserKey(userId, 'expenses') : 'expenses';
      const expenses = await kv.get(expensesKey, 'json') || [];
      return new Response(JSON.stringify(expenses), { headers });
    }

    if (path === 'expenses' && method === 'POST') {
      const body = await request.json();
      const { userId, ...expense } = body;
      const expensesKey = userId ? getUserKey(userId, 'expenses') : 'expenses';
      const expenses = (await kv.get(expensesKey, 'json')) || [];
      expense.id = Date.now().toString();
      expense.createdAt = new Date().toISOString();
      expenses.push(expense);
      await kv.put(expensesKey, JSON.stringify(expenses));
      return new Response(JSON.stringify(expense), { headers });
    }

    if (path.startsWith('expenses/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const body = await request.json().catch(() => ({}));
      const { userId } = body;
      const expensesKey = userId ? getUserKey(userId, 'expenses') : 'expenses';
      const expenses = (await kv.get(expensesKey, 'json')) || [];
      const filtered = expenses.filter((e: any) => e.id !== id);
      await kv.put(expensesKey, JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Bills endpoints
    if (path === 'bills' && method === 'GET') {
      const userId = await getUserId(request);
      const billsKey = userId ? getUserKey(userId, 'bills') : 'bills';
      const bills = await kv.get(billsKey, 'json') || [];
      return new Response(JSON.stringify(bills), { headers });
    }

    if (path === 'bills' && method === 'POST') {
      const body = await request.json();
      const { userId, ...bill } = body;
      const billsKey = userId ? getUserKey(userId, 'bills') : 'bills';
      const bills = (await kv.get(billsKey, 'json')) || [];
      bill.id = Date.now().toString();
      bill.createdAt = new Date().toISOString();
      bills.push(bill);
      await kv.put(billsKey, JSON.stringify(bills));
      return new Response(JSON.stringify(bill), { headers });
    }

    if (path.startsWith('bills/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const body = await request.json().catch(() => ({}));
      const { userId } = body;
      const billsKey = userId ? getUserKey(userId, 'bills') : 'bills';
      const bills = (await kv.get(billsKey, 'json')) || [];
      const filtered = bills.filter((b: any) => b.id !== id);
      await kv.put(billsKey, JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Goals endpoints
    if (path === 'goals' && method === 'GET') {
      const userId = await getUserId(request);
      const goalsKey = userId ? getUserKey(userId, 'goals') : 'goals';
      const goals = await kv.get(goalsKey, 'json') || [];
      return new Response(JSON.stringify(goals), { headers });
    }

    if (path === 'goals' && method === 'POST') {
      const body = await request.json();
      const { userId, ...goal } = body;
      const goalsKey = userId ? getUserKey(userId, 'goals') : 'goals';
      const goals = (await kv.get(goalsKey, 'json')) || [];
      goal.id = Date.now().toString();
      goal.createdAt = new Date().toISOString();
      goals.push(goal);
      await kv.put(goalsKey, JSON.stringify(goals));
      return new Response(JSON.stringify(goal), { headers });
    }

    if (path.startsWith('goals/') && method === 'PUT') {
      const id = path.split('/')[1];
      const body = await request.json();
      const { userId, ...updatedGoal } = body;
      const goalsKey = userId ? getUserKey(userId, 'goals') : 'goals';
      const goals = (await kv.get(goalsKey, 'json')) || [];
      const index = goals.findIndex((g: any) => g.id === id);
      if (index !== -1) {
        goals[index] = { ...goals[index], ...updatedGoal };
        await kv.put(goalsKey, JSON.stringify(goals));
        return new Response(JSON.stringify(goals[index]), { headers });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }

    if (path.startsWith('goals/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const body = await request.json().catch(() => ({}));
      const { userId } = body;
      const goalsKey = userId ? getUserKey(userId, 'goals') : 'goals';
      const goals = (await kv.get(goalsKey, 'json')) || [];
      const filtered = goals.filter((g: any) => g.id !== id);
      await kv.put(goalsKey, JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Budgets endpoints
    if (path === 'budgets' && method === 'GET') {
      const userId = await getUserId(request);
      const budgetsKey = userId ? getUserKey(userId, 'budgets') : 'budgets';
      const budgets = await kv.get(budgetsKey, 'json') || [];
      return new Response(JSON.stringify(budgets), { headers });
    }

    if (path === 'budgets' && method === 'POST') {
      const body = await request.json();
      const { userId, ...budget } = body;
      const budgetsKey = userId ? getUserKey(userId, 'budgets') : 'budgets';
      const budgets = (await kv.get(budgetsKey, 'json')) || [];
      budget.id = Date.now().toString();
      budget.createdAt = new Date().toISOString();
      budgets.push(budget);
      await kv.put(budgetsKey, JSON.stringify(budgets));
      return new Response(JSON.stringify(budget), { headers });
    }

    if (path.startsWith('budgets/') && method === 'PUT') {
      const id = path.split('/')[1];
      const body = await request.json();
      const { userId, ...updatedBudget } = body;
      const budgetsKey = userId ? getUserKey(userId, 'budgets') : 'budgets';
      const budgets = (await kv.get(budgetsKey, 'json')) || [];
      const index = budgets.findIndex((b: any) => b.id === id);
      if (index !== -1) {
        budgets[index] = { ...budgets[index], ...updatedBudget };
        await kv.put(budgetsKey, JSON.stringify(budgets));
        return new Response(JSON.stringify(budgets[index]), { headers });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }

    if (path.startsWith('budgets/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const body = await request.json().catch(() => ({}));
      const { userId } = body;
      const budgetsKey = userId ? getUserKey(userId, 'budgets') : 'budgets';
      const budgets = (await kv.get(budgetsKey, 'json')) || [];
      const filtered = budgets.filter((b: any) => b.id !== id);
      await kv.put(budgetsKey, JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Accounts endpoints
    if (path === 'accounts' && method === 'GET') {
      const userId = await getUserId(request);
      const accountsKey = userId ? getUserKey(userId, 'accounts') : 'accounts';
      const accounts = await kv.get(accountsKey, 'json') || [];
      return new Response(JSON.stringify(accounts), { headers });
    }

    if (path === 'accounts' && method === 'POST') {
      const body = await request.json();
      const { userId, ...account } = body;
      const accountsKey = userId ? getUserKey(userId, 'accounts') : 'accounts';
      const accounts = (await kv.get(accountsKey, 'json')) || [];
      account.id = Date.now().toString();
      account.balance = account.balance || 0;
      account.createdAt = new Date().toISOString();
      accounts.push(account);
      await kv.put(accountsKey, JSON.stringify(accounts));
      return new Response(JSON.stringify(account), { headers });
    }

    if (path.startsWith('accounts/') && method === 'PUT') {
      const id = path.split('/')[1];
      const body = await request.json();
      const { userId, ...updatedAccount } = body;
      const accountsKey = userId ? getUserKey(userId, 'accounts') : 'accounts';
      const accounts = (await kv.get(accountsKey, 'json')) || [];
      const index = accounts.findIndex((a: any) => a.id === id);
      if (index !== -1) {
        accounts[index] = { ...accounts[index], ...updatedAccount };
        await kv.put(accountsKey, JSON.stringify(accounts));
        return new Response(JSON.stringify(accounts[index]), { headers });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    }

    if (path.startsWith('accounts/') && method === 'DELETE') {
      const id = path.split('/')[1];
      const body = await request.json().catch(() => ({}));
      const { userId } = body;
      const accountsKey = userId ? getUserKey(userId, 'accounts') : 'accounts';
      const accounts = (await kv.get(accountsKey, 'json')) || [];
      const filtered = accounts.filter((a: any) => a.id !== id);
      await kv.put(accountsKey, JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Account transactions endpoints
    if (path === 'accounts/transactions' && method === 'POST') {
      const body = await request.json();
      const { userId, ...transaction } = body;
      const accountsKey = userId ? getUserKey(userId, 'accounts') : 'accounts';
      const transactionsKey = userId ? getUserKey(userId, 'account-transactions') : 'account-transactions';
      
      const accounts = (await kv.get(accountsKey, 'json')) || [];
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

      await kv.put(accountsKey, JSON.stringify(accounts));

      // Store transaction
      const transactions = (await kv.get(transactionsKey, 'json')) || [];
      transaction.id = Date.now().toString();
      transaction.createdAt = new Date().toISOString();
      transactions.push(transaction);
      await kv.put(transactionsKey, JSON.stringify(transactions));

      return new Response(JSON.stringify(transaction), { headers });
    }

    if (path.includes('/transactions') && method === 'GET') {
      const parts = path.split('/');
      if (parts.length === 3 && parts[0] === 'accounts' && parts[2] === 'transactions') {
        const accountId = parts[1];
        const userId = await getUserId(request);
        const transactionsKey = userId ? getUserKey(userId, 'account-transactions') : 'account-transactions';
        const transactions = (await kv.get(transactionsKey, 'json')) || [];
        const filtered = transactions.filter((t: any) => t.accountId === accountId);
        return new Response(JSON.stringify(filtered), { headers });
      }
    }


    // Advanced bank statement parsing endpoint
    if (path === 'bank-statement/parse' && method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return new Response(JSON.stringify({ error: 'No file provided' }), {
          status: 400,
          headers,
        });
      }

      const fileName = file.name.toLowerCase();
      const fileContent = await file.text();

      // Helper function to parse various date formats
      const parseDate = (dateStr: string): string | null => {
        if (!dateStr) return null;
        
        // Remove common separators and normalize
        const cleaned = dateStr.trim().replace(/[,\s]+/g, ' ');
        
        // Try ISO format (YYYY-MM-DD)
        const isoMatch = cleaned.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
        if (isoMatch) {
          const [, year, month, day] = isoMatch;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        // Try DD/MM/YYYY or MM/DD/YYYY
        const slashMatch = cleaned.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
        if (slashMatch) {
          let [, part1, part2, year] = slashMatch;
          // If year is 2 digits, assume 20XX
          if (year.length === 2) year = '20' + year;
          
          // Try DD/MM/YYYY first (more common internationally)
          const day = parseInt(part1);
          const month = parseInt(part2);
          if (day > 0 && day <= 31 && month > 0 && month <= 12) {
            // If day > 12, it must be DD/MM
            if (day > 12) {
              return `${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`;
            }
            // Otherwise try MM/DD (US format)
            return `${year}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`;
          }
        }
        
        // Try text dates (e.g., "Jan 15, 2024", "15 Jan 2024")
        const textDatePatterns = [
          /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
          /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i,
        ];
        
        const months: { [key: string]: string } = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        };
        
        for (const pattern of textDatePatterns) {
          const match = cleaned.match(pattern);
          if (match) {
            const monthName = match[1] || match[2];
            const monthNum = months[monthName.toLowerCase().substring(0, 3)];
            if (monthNum) {
              const day = (match[2] || match[1]).padStart(2, '0');
              const year = match[3];
              return `${year}-${monthNum}-${day}`;
            }
          }
        }
        
        return null;
      };

      // Helper function to parse amounts
      const parseAmount = (amountStr: string): number | null => {
        if (!amountStr) return null;
        
        // Remove currency symbols, commas, and whitespace
        const cleaned = amountStr.replace(/[$€£¥,\s]/g, '');
        
        // Handle parentheses as negative (accounting format)
        const isNegative = cleaned.includes('(') || cleaned.startsWith('-');
        const numericStr = cleaned.replace(/[()]/g, '');
        
        const amount = parseFloat(numericStr);
        if (isNaN(amount)) return null;
        
        return isNegative ? -Math.abs(amount) : amount;
      };

      // Helper to detect CSV delimiter
      const detectDelimiter = (line: string): string => {
        const delimiters = [',', '\t', ';', '|'];
        let maxCount = 0;
        let detectedDelimiter = ',';
        
        for (const delim of delimiters) {
          const count = (line.match(new RegExp(`\\${delim}`, 'g')) || []).length;
          if (count > maxCount) {
            maxCount = count;
            detectedDelimiter = delim;
          }
        }
        
        return detectedDelimiter;
      };

      // Helper to find column indices
      const findColumns = (headers: string[]): { date: number; description: number; amount: number; type?: number } => {
        const lowerHeaders = headers.map(h => h.toLowerCase().trim());
        
        const dateIndices = ['date', 'transaction date', 'posted date', 'value date', 'trans date'];
        const descIndices = ['description', 'memo', 'details', 'narration', 'payee', 'merchant', 'transaction', 'particulars'];
        const amountIndices = ['amount', 'value', 'balance', 'transaction amount', 'debit', 'credit'];
        const typeIndices = ['type', 'transaction type', 'debit/credit', 'dr/cr'];
        
        const findIndex = (keywords: string[]) => {
          for (const keyword of keywords) {
            const idx = lowerHeaders.findIndex(h => h.includes(keyword));
            if (idx !== -1) return idx;
          }
          return -1;
        };
        
        return {
          date: findIndex(dateIndices),
          description: findIndex(descIndices),
          amount: findIndex(amountIndices),
          type: findIndex(typeIndices),
        };
      };

      let transactions: any[] = [];

      // Detect file format and parse accordingly
      if (fileName.endsWith('.ofx') || fileName.endsWith('.qfx')) {
        // OFX/QFX format parsing
        const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
        const matches = fileContent.matchAll(stmtTrnRegex);
        
        for (const match of matches) {
          const trnContent = match[1];
          
          const getTag = (tag: string): string | null => {
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
            const match = trnContent.match(regex);
            return match ? match[1].trim() : null;
          };
          
          const dateStr = getTag('DTPOSTED') || getTag('DTUSER');
          const amountStr = getTag('TRNAMT');
          const memo = getTag('MEMO') || getTag('NAME');
          
          if (dateStr && amountStr) {
            // OFX dates are in format: YYYYMMDDHHMMSS
            const ofxDate = dateStr.substring(0, 8);
            const parsedDate = parseDate(
              `${ofxDate.substring(0, 4)}-${ofxDate.substring(4, 6)}-${ofxDate.substring(6, 8)}`
            );
            
            const amount = parseAmount(amountStr);
            
            if (parsedDate && amount !== null) {
              transactions.push({
                date: parsedDate,
                description: memo || 'Bank transaction',
                amount: amount,
              });
            }
          }
        }
      } else {
        // CSV/TSV/Text format
        const lines = fileContent.split(/\r?\n/).filter(line => line.trim());
        if (lines.length === 0) {
          return new Response(JSON.stringify({ error: 'File is empty' }), {
            status: 400,
            headers,
          });
        }
        
        // Detect if first line is headers
        const firstLine = lines[0];
        const delimiter = detectDelimiter(firstLine);
        const firstLineParts = firstLine.split(delimiter).map(p => p.trim());
        
        // Check if first line looks like headers (contains common header words)
        const headerKeywords = ['date', 'description', 'amount', 'memo', 'transaction', 'balance'];
        const hasHeaders = firstLineParts.some(part => 
          headerKeywords.some(keyword => part.toLowerCase().includes(keyword))
        );
        
        let startIndex = 0;
        let columns: { date: number; description: number; amount: number; type?: number } = {
          date: -1,
          description: -1,
          amount: -1,
        };
        
        if (hasHeaders && firstLineParts.length > 1) {
          // CSV with headers
          columns = findColumns(firstLineParts);
          startIndex = 1;
        } else {
          // Plain text or CSV without headers - use pattern matching
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(delimiter).map(p => p.trim());
            
            // Try to find date and amount in the line
            let dateFound: string | null = null;
            let amountFound: number | null = null;
            let description = '';
            
            // Check each part for date
            for (const part of parts) {
              const parsedDate = parseDate(part);
              if (parsedDate && !dateFound) {
                dateFound = parsedDate;
                continue;
              }
              
              const parsedAmount = parseAmount(part);
              if (parsedAmount !== null && amountFound === null) {
                amountFound = parsedAmount;
                continue;
              }
            }
            
            // If not found in parts, try pattern matching on whole line
            if (!dateFound || amountFound === null) {
              const datePatterns = [
                /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/,
                /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/,
                /\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i,
              ];
              
              for (const pattern of datePatterns) {
                const match = line.match(pattern);
                if (match) {
                  dateFound = parseDate(match[0]);
                  if (dateFound) break;
                }
              }
              
              const amountPattern = /[\$€£¥]?\s*\(?([\d,]+\.?\d*)\)?/g;
              const amountMatches = [...line.matchAll(amountPattern)];
              if (amountMatches.length > 0) {
                // Take the last amount match (usually the transaction amount)
                const lastMatch = amountMatches[amountMatches.length - 1];
                amountFound = parseAmount(lastMatch[0]);
              }
            }
            
            if (dateFound && amountFound !== null) {
              // Extract description by removing date and amount
              description = line
                .replace(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g, '')
                .replace(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g, '')
                .replace(/\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/gi, '')
                .replace(/[\$€£¥]?\s*\(?([\d,]+\.?\d*)\)?/g, '')
                .trim();
              
              transactions.push({
                date: dateFound,
                description: description || 'Bank transaction',
                amount: amountFound,
              });
            }
          }
        }
        
        // If we have column mappings, parse using them
        if (columns.date !== -1 || columns.amount !== -1) {
          transactions = [];
          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            
            const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
            
            let dateStr: string | null = null;
            let amountStr: string | null = null;
            let description = '';
            
            if (columns.date !== -1 && parts[columns.date]) {
              dateStr = parseDate(parts[columns.date]);
            }
            
            if (columns.amount !== -1 && parts[columns.amount]) {
              amountStr = parts[columns.amount];
            }
            
            if (columns.description !== -1 && parts[columns.description]) {
              description = parts[columns.description];
            } else {
              // Build description from non-date, non-amount columns
              description = parts
                .map((part, idx) => {
                  if (idx === columns.date || idx === columns.amount) return '';
                  return part;
                })
                .filter(p => p)
                .join(' ')
                .trim();
            }
            
            if (dateStr && amountStr) {
              const amount = parseAmount(amountStr);
              if (amount !== null) {
                transactions.push({
                  date: dateStr,
                  description: description || 'Bank transaction',
                  amount: amount,
                });
              }
            }
          }
        }
      }
      
      // Remove duplicates and sort by date
      const uniqueTransactions = transactions.filter((t, idx, self) =>
        idx === self.findIndex(tr => 
          tr.date === t.date && 
          Math.abs(tr.amount - t.amount) < 0.01 &&
          tr.description === t.description
        )
      );
      
      uniqueTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      return new Response(JSON.stringify({ 
        transactions: uniqueTransactions,
        count: uniqueTransactions.length,
        format: fileName.endsWith('.ofx') || fileName.endsWith('.qfx') ? 'OFX/QFX' : 'CSV/Text'
      }), { headers });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers,
    });
  }
}

