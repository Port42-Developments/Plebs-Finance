# Changelog

## [1.0.0] - 2024-12-28

### 🎉 Initial Release

**Plebs Finance** - A comprehensive personal finance and debt management application built for Cloudflare Pages.

### ✨ Features

#### 🔐 Authentication & User Management
- Multi-user support with username and PIN authentication
- User registration and login system
- Legacy account migration support
- User profile management with customizable settings

#### 💵 Cashflow Management
- Manual income and expense entry
- Bank statement upload and automatic transaction parsing (CSV/text)
- Transaction history with filtering and sorting
- Real-time income, expense, and net cashflow calculations

#### 💳 Credit Card & Debt Management
- Multiple credit card support
- Interest-free purchase plans with automatic weekly payment calculations
- Payment tracking and history
- Payment deletion support
- Auto-organization: paid-off plans move to collapsible section
- Real-time remaining balance calculations

#### 💰 Account Management
- Multiple account types (checking, savings, investment, other)
- Deposit and withdrawal tracking
- Account transaction history
- Real-time balance updates

#### 📊 Expenses & Bills
- One-time expense tracking
- Recurring expenses (weekly, monthly, yearly)
- Single bill management with due date tracking
- Bill status indicators (paid, overdue, due today, pending)
- Visual status badges

#### 🎯 Financial Goals
- Savings goals with target amounts
- Progress visualization with progress bars
- Account linking for automatic balance tracking
- Target date support
- Manual progress updates

#### 📱 Dashboard
- Comprehensive financial overview
- Monthly income and expense breakdown
- Total debt and weekly payment summary
- Account balance totals
- Goals progress overview
- Recent cashflow and upcoming bills
- Credit card plan summaries

#### ⚙️ Profile & Settings
- Profile picture upload
- Name and personalization settings
- Currency selection (NZD, AUD, USD, EUR, GBP)
- Timezone configuration (default: Pacific/Auckland)
- PIN change functionality
- **Dark mode** - Toggle between light and dark themes

#### 🎨 User Interface
- Modern, responsive design
- Dark mode support throughout the entire application
- Intuitive navigation with mobile-friendly menu
- User profile dropdown with account switching
- Professional branding with Port42 Developments

### 🛠️ Technical Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with dark mode support
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Date Handling**: date-fns + date-fns-tz
- **Backend**: Cloudflare Pages Functions
- **Storage**: Cloudflare KV with user-scoped data isolation

### 🔒 Security

- User-scoped data storage ensuring complete data isolation
- PIN-based authentication
- Secure data storage in Cloudflare KV
- No sensitive data exposed in client-side code

### 📝 Notes

- All financial data stored securely in Cloudflare KV
- Multi-user support with complete data isolation
- Legacy single-user accounts can be migrated to multi-user system
- Default currency: NZD
- Default timezone: Pacific/Auckland
- Fully responsive design for desktop and mobile devices

---

## [1.1.0] - 2024-12-29

### Added

- **Transaction Category Tagging**
  - Category field for cashflow entries and expenses
  - Category autocomplete suggestions from existing budget categories
  - Visual category badges with tag icons in cashflow table
  - Edit functionality for existing cashflow transactions
  - Category-based budget tracking (budgets with categories only track matching expenses)
  - PUT endpoint for updating cashflow entries

### Modified

- **Cashflow Component**
  - Added category column to cashflow table
  - Enhanced add/edit modal with category input field
  - Added edit button (pencil icon) for each transaction
  - Improved form to support both adding and editing transactions
  - Category suggestions from existing budgets via datalist

- **Budgets Component**
  - Updated spending calculation to filter by category when budget has a category
  - Budgets without categories continue to track all expenses (backward compatible)

- **Type Definitions**
  - Added optional `category` field to `CashflowEntry` interface
  - Added optional `category` field to `Expense` interface

- **API**
  - Added `updateCashflow` method to frontend API client
  - Added PUT endpoint for cashflow updates in backend API

### Removed

- None

---

**Developed by [Port42 Developments](https://port42.nz)**

