<div align="center">

![Plebs Finance Banner](https://raw.githubusercontent.com/Port42-Developments/Plebs-Finance/main/public/pleb_finance_banner.png)

**A personal finance and debt management application built for Cloudflare Pages**

[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Port42](https://img.shields.io/badge/Port42-Developments-3FA9F5?style=flat&labelColor=0F1216)](https://port42.nz)

*Take control of your finances with a simple, secure, and powerful personal finance manager*

[Features](#-features) • [Quick Start](#-quick-start) • [Usage Guide](#-usage-guide) • [Deployment](#-deployment)

</div>

---

## ✨ Features

### 🔐 **Secure Authentication & Multi-User Support**
- Username and PIN-based authentication (4-6 digit PIN)
- Multi-user support with complete data isolation
- User registration and login system
- Legacy account migration support
- Change PIN from profile settings
- All data stored securely in Cloudflare KV with user-scoped keys

### 💵 **Cashflow Management**
- **Manual Entry**: Add income and expenses with dates and descriptions
- **Transaction Tagging**: Tag transactions with categories for budget tracking
- **Edit Transactions**: Update existing cashflow entries including categories
- **Bank Statement Upload**: Upload CSV/text files and automatically parse transactions
- **Transaction History**: View all cashflow entries with filtering and sorting
- **Summary Statistics**: Real-time totals for income, expenses, and net cashflow

### 💳 **Credit Card & Debt Management**
- **Multiple Cards**: Manage multiple credit cards in one place
- **Interest-Free Plans**: Create purchase plans with interest-free periods
- **Auto-Calculated Payments**: Automatically calculates weekly payment needed to pay off before interest kicks in
- **Payment Tracking**: Record payments and track remaining balance
- **Payment History**: View and delete payment history
- **Smart Organization**: Paid-off plans automatically move to a collapsible section

### 💰 **Account Management**
- **Multiple Accounts**: Create checking, savings, investment, or other account types
- **Deposit/Withdraw**: Easily add or remove money from accounts
- **Balance Tracking**: Real-time balance updates across all accounts
- **Transaction History**: Track all account transactions

### 📊 **Expenses & Bills**
- **One-Time Expenses**: Track individual expenses
- **Recurring Expenses**: Set up weekly, monthly, or yearly recurring expenses
- **Single Bills**: Add one-time bills (e.g., car mechanic, medical bills)
- **Due Date Tracking**: Never miss a payment with visual indicators
- **Status Management**: Mark bills as paid/unpaid with status indicators

### 💰 **Budget Planning & Tracking**
- **Budget Creation**: Create budgets with weekly, monthly, or yearly periods
- **Category-Based Tracking**: Tag transactions with categories and track spending against category-specific budgets
- **Flexible Budgets**: Create budgets with or without categories (category-less budgets track all expenses)
- **Spending Calculation**: Automatically calculates spent amount from cashflow and expenses
- **Visual Progress**: Progress bars and status indicators showing budget utilization
- **Period Management**: Set start and optional end dates for budgets

### 🎯 **Financial Goals**
- **Savings Goals**: Set target amounts and track progress
- **Account Linking**: Link goals to accounts for automatic balance tracking
- **Progress Visualization**: Visual progress bars showing completion percentage
- **Target Dates**: Optional target dates for goals
- **Progress Updates**: Easily add money to your goals

### 📱 **Comprehensive Dashboard**
- **Financial Overview**: Quick summary of your financial status
- **Monthly Breakdown**: This month's income, expenses, and net
- **Debt Summary**: Total debt and weekly payment requirements
- **Account Balances**: Total balance across all accounts
- **Goals Progress**: Overall progress across all goals
- **Recent Activity**: Latest transactions and upcoming bills
- **Credit Card Summary**: Overview of all credit card plans

### ⚙️ **Profile & Settings**
- **Profile Picture**: Upload and customize your profile picture
- **Personalization**: Set your name and preferences
- **Currency Selection**: Choose from multiple currencies (default: NZD)
- **Timezone Settings**: Set your timezone for accurate date/time display (default: Pacific/Auckland)
- **Dark Mode**: Toggle between light and dark themes with preference persistence
- **PIN Management**: Change your PIN anytime from the profile page

---

## 🚀 Quick Start

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works!)
- A [GitHub account](https://github.com)
- Node.js 18+ (for local development)

### Deploy to Cloudflare Pages (5 minutes)

1. **Fork this repository** on GitHub

2. **Create a KV Namespace**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → KV
   - Click "Create a namespace"
   - Name it `FINANCE_KV`
   - Copy the **Namespace ID**

3. **Update Configuration**:
   - Edit `wrangler.toml` in your repository
   - Replace `your-kv-namespace-id` with your actual namespace ID:
   ```toml
   [[kv_namespaces]]
   binding = "FINANCE_KV"
   id = "your-actual-namespace-id-here"
   preview_id = "your-actual-namespace-id-here"
   ```

4. **Connect to Cloudflare Pages**:
   - Go to Cloudflare Dashboard → Workers & Pages
   - Click "Create a project" → "Connect to Git"
   - Select your GitHub account and this repository
   - Click "Begin setup"

5. **Configure Build Settings**:
   - **Framework preset**: `Vite` (or None)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (leave empty)

6. **Add KV Binding**:
   - In your Pages project → Settings → Environment variables
   - Add variable:
     - **Variable name**: `FINANCE_KV`
     - **Type**: KV Namespace
     - **Value**: Select your `FINANCE_KV` namespace

7. **Deploy**:
   - Click "Save and Deploy"
   - Your app will be live at `https://your-project-name.pages.dev` 🎉

### First Time Setup

1. Visit your deployed app
2. Click "New user? Register"
3. Enter a username, 4-6 digit PIN, and your name (optional)
4. Click "Register"
5. You're in! Start managing your finances

**Note**: If you have an existing legacy account (PIN-only), you can migrate it by logging in with your PIN and following the migration prompt.

---

## 📖 Usage Guide

### Getting Started

#### **Cashflow**
- Click "Cashflow" in the navigation
- Click "Add Entry" to manually add income or expenses
- Tag transactions with categories for budget tracking (optional)
- Click the edit icon to update existing transactions and add categories
- Click "Upload Statement" to parse bank statements (CSV/text format)
- View your net cashflow in the summary cards

#### **Accounts**
- Click "Accounts" in the navigation
- Click "Add Account" to create a new account
- Use "Deposit" or "Withdraw" buttons to manage account balance
- View total balance across all accounts

#### **Credit Cards**
- Click "Credit Cards" in the navigation
- Click "Add Card" to add a credit card
- Click "Add Plan" on a card to create an interest-free purchase plan
- The app automatically calculates weekly payment needed
- Click "Pay" on any plan to record a payment
- View payment history and delete payments if needed
- Paid-off plans automatically move to the bottom in a collapsible section

#### **Expenses**
- Click "Expenses" in the navigation
- Click "Add Expense" to track expenses
- Toggle "Recurring Expense" to set up weekly/monthly/yearly recurring expenses
- View total expenses and recurring expense count

#### **Bills**
- Click "Bills" in the navigation
- Click "Add Bill" to add one-time bills
- Set due dates and amounts
- Mark bills as paid using the checkmark button
- View overdue and upcoming bills

#### **Budgets**
- Click "Budgets" in the navigation
- Click "Add Budget" to create a new budget
- Set budget amount, period (weekly/monthly/yearly), and optional category
- Budgets with categories only track expenses tagged with that category
- Budgets without categories track all expenses
- View spending progress with visual indicators and remaining amounts

#### **Goals**
- Click "Goals" in the navigation
- Click "Add Goal" to create a savings goal
- Optionally link a goal to an account for automatic tracking
- Add money to goals using the input field
- View progress bars and completion percentages

#### **Profile**
- Click "Profile" in the navigation
- Update your name and profile picture
- Change currency and timezone settings
- Toggle dark mode on/off (preference is saved)
- Click "Change PIN" to update your PIN code

---

## 🏗️ Architecture

### Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Date Handling**: date-fns + date-fns-tz
- **Backend**: Cloudflare Pages Functions
- **Storage**: Cloudflare KV

### Project Structure

```
Plebs-Finance/
├── functions/
│   └── api/
│       └── [[path]].ts          # Cloudflare Pages Functions API
├── src/
│   ├── components/
│   │   ├── Login.tsx            # PIN authentication
│   │   ├── Layout.tsx           # Navigation layout
│   │   ├── Dashboard.tsx        # Main dashboard
│   │   ├── Cashflow.tsx         # Cashflow management
│   │   ├── Accounts.tsx         # Account management
│   │   ├── CreditCards.tsx      # Credit card plans
│   │   ├── Expenses.tsx         # Expenses tracking
│   │   ├── Bills.tsx            # Bills management
│   │   ├── Budgets.tsx          # Budget planning and tracking
│   │   ├── Goals.tsx            # Financial goals
│   │   └── Profile.tsx          # Profile settings
│   ├── api.ts                   # API client functions
│   ├── types.ts                 # TypeScript type definitions
│   ├── App.tsx                  # Main app component
│   └── main.tsx                 # Entry point
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── wrangler.toml                # Cloudflare Workers config
└── README.md
```

### Data Storage

All data is stored in Cloudflare KV with user-scoped keys for complete data isolation:

- `user:{userId}:profile` - User profile data (JSON)
- `user:{userId}:cashflow` - Cashflow entries array (JSON)
- `user:{userId}:credit-cards` - Credit cards array (JSON)
- `user:{userId}:accounts` - Accounts array (JSON)
- `user:{userId}:account-transactions` - Account transactions array (JSON)
- `user:{userId}:expenses` - Expenses array (JSON)
- `user:{userId}:bills` - Bills array (JSON)
- `user:{userId}:budgets` - Budgets array (JSON)
- `user:{userId}:goals` - Goals array (JSON)
- `users` - All registered users array (JSON)

**Note**: Legacy single-user accounts use non-prefixed keys and can be migrated to the new multi-user structure.

---

## 🔧 Local Development

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/Plebs-Finance.git
cd Plebs-Finance

# Install dependencies
npm install

# Update wrangler.toml with your KV namespace ID
# Edit wrangler.toml and replace the namespace IDs

# Run development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Testing with Cloudflare Functions

To test Cloudflare Functions locally:

```bash
# Install Wrangler globally
npm install -g wrangler

# Build the project
npm run build

# Run Pages dev server with KV
wrangler pages dev dist --kv FINANCE_KV=your-namespace-id
```

---

## 📚 API Endpoints

All API endpoints are handled by Cloudflare Pages Functions at `/api/*`:

### Authentication
- `POST /api/auth/register` - Register new user (username, PIN, name)
- `POST /api/auth/login` - Login with username and PIN
- `POST /api/auth/verify` - Verify PIN (legacy support)
- `POST /api/auth/change-pin` - Change PIN
- `POST /api/auth/migrate-legacy` - Migrate legacy single-user account to multi-user
- `GET /api/users` - Get all registered users

### Profile
- `GET /api/user/profile` - Get user profile
- `POST /api/user/profile` - Update user profile

### Cashflow
- `GET /api/cashflow` - Get all cashflow entries
- `POST /api/cashflow` - Add cashflow entry (supports category field)
- `PUT /api/cashflow/:id` - Update cashflow entry
- `DELETE /api/cashflow/:id` - Delete cashflow entry

### Accounts
- `GET /api/accounts` - Get all accounts
- `POST /api/accounts` - Add account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account
- `POST /api/accounts/transactions` - Add account transaction
- `GET /api/accounts/:id/transactions` - Get account transactions

### Credit Cards
- `GET /api/credit-cards` - Get all credit cards
- `POST /api/credit-cards` - Add credit card
- `PUT /api/credit-cards/:id` - Update credit card
- `DELETE /api/credit-cards/:id` - Delete credit card
- `POST /api/credit-cards/payments` - Add plan payment
- `DELETE /api/credit-cards/payments` - Delete plan payment

### Expenses
- `GET /api/expenses` - Get all expenses
- `POST /api/expenses` - Add expense
- `DELETE /api/expenses/:id` - Delete expense

### Bills
- `GET /api/bills` - Get all bills
- `POST /api/bills` - Add bill
- `DELETE /api/bills/:id` - Delete bill

### Budgets
- `GET /api/budgets` - Get all budgets
- `POST /api/budgets` - Add budget
- `PUT /api/budgets/:id` - Update budget
- `DELETE /api/budgets/:id` - Delete budget

### Goals
- `GET /api/goals` - Get all goals
- `POST /api/goals` - Add goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal

### Bank Statements
- `POST /api/bank-statement/parse` - Parse uploaded bank statement file

---

## 🎨 Features in Detail

### Credit Card Payment Calculator

The app automatically calculates how much you need to pay per week to clear your debt before interest kicks in:

- Enter the purchase amount
- Set the interest-free period (months)
- Set the interest-free end date
- The app calculates: `Weekly Payment = Remaining Balance / Weeks Remaining`
- As you make payments, the weekly payment automatically recalculates
- When fully paid, plans move to the "Paid Off Plans" section

### Account-Goal Linking

- Link goals to accounts for automatic tracking
- When money is added to a linked account, the goal progress updates automatically
- Manual goals are also supported (without account linking)

### Bank Statement Parsing

- Upload CSV or text files
- The app attempts to parse dates, amounts, and descriptions
- Parsed transactions are automatically added to cashflow
- **Note**: Parsing is basic and may require manual adjustment for different bank formats

### Budget & Category Tracking

- Create budgets with optional categories (e.g., "Groceries", "Entertainment")
- Tag cashflow transactions with categories when adding or editing
- Budgets with categories only track expenses matching that category
- Budgets without categories track all expenses
- Spending is automatically calculated from both cashflow entries and expenses
- Visual progress bars show how much of your budget has been used

---

## 🔒 Security Considerations

⚠️ **Important**: This app uses PIN-based authentication stored in Cloudflare KV. For production use, consider:

1. **Encrypting PINs**: Hash PINs using bcrypt or similar before storage
2. **Session Management**: Implement proper session tokens instead of localStorage
3. **HTTPS**: Always use HTTPS in production (Cloudflare Pages provides this automatically)
4. **Rate Limiting**: Add rate limiting to API endpoints
5. **Input Validation**: Enhance input validation and sanitization

---

## 🌍 Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## 📝 Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🗺️ Roadmap

Potential future features:

- [x] ~~Budget planning and tracking~~
- [x] ~~Category-based expense tracking~~
- [x] ~~Transaction tagging for budgets~~
- [x] ~~Multi-user support~~
- [x] ~~Dark mode~~
- [ ] Financial reports and analytics (PDF/CSV export)
- [ ] Mobile app (React Native)
- [ ] Bank account integration (Open Banking API)
- [ ] Investment tracking
- [ ] Bill reminders and notifications
- [ ] Data backup and restore
- [ ] Advanced bank statement parsing

---

## 💬 Support

For issues, questions, or contributions, please [open an issue](https://github.com/your-username/Plebs-Finance/issues) on GitHub.

---

<div align="center">

---

<div style="margin: 2rem 0; padding: 2rem; background: #0F1216; border-radius: 8px; border: 1px solid #1a1f26;">

<div style="color: #8A94A6; font-size: 14px; margin-bottom: 1.5rem;">
  **Built with precision for personal finance management**
</div>

<div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1.5rem;">
  <a href="https://github.com/Port42-Developments/Plebs-Finance" style="color: #3FA9F5; text-decoration: none; font-size: 14px;">⭐ Star this repo</a>
  <span style="color: #8A94A6;">•</span>
  <a href="https://port42.nz" style="color: #3FA9F5; text-decoration: none; font-size: 14px;">Port42 Developments</a>
</div>

<div style="color: #8A94A6; font-size: 12px; padding-top: 1rem; border-top: 1px solid #1a1f26;">
  © 2024 Port42 Developments. All rights reserved.
</div>

</div>

</div>
