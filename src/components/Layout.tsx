import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, DollarSign, CreditCard, Receipt, FileText, Target, User, Wallet, Users } from 'lucide-react';
import { User as UserType } from '../types';
import { api } from '../api';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  currentUser: UserType | null;
}

export default function Layout({ children, onLogout, currentUser }: LayoutProps) {
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const allUsers = await api.getUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSwitchUser = async (user: UserType) => {
    localStorage.setItem('currentUserId', user.id);
    window.location.reload(); // Reload to refresh all data
  };

  const handleUserMenuClick = () => {
    if (!showUserMenu) {
      loadUsers();
    }
    setShowUserMenu(!showUserMenu);
  };

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/cashflow', icon: DollarSign, label: 'Cashflow' },
    { path: '/accounts', icon: Wallet, label: 'Accounts' },
    { path: '/credit-cards', icon: CreditCard, label: 'Credit Cards' },
    { path: '/expenses', icon: Receipt, label: 'Expenses' },
    { path: '/bills', icon: FileText, label: 'Bills' },
    { path: '/goals', icon: Target, label: 'Goals' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <img src="/pleb_finance_logo.png" alt="Plebs Finance" className="h-10 w-auto" />
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? 'border-purple-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentUser && (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={handleUserMenuClick}
                    className="flex items-center gap-2 text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium rounded-lg hover:bg-gray-100"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">{currentUser.name || currentUser.username}</span>
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="p-3 border-b border-gray-200">
                        <div className="text-sm font-semibold text-gray-900">Current User</div>
                        <div className="text-xs text-gray-600">{currentUser.username}</div>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {loadingUsers ? (
                          <div className="p-3 text-sm text-gray-500 text-center">Loading users...</div>
                        ) : users.length > 0 ? (
                          <>
                            <div className="p-2 text-xs font-semibold text-gray-500 uppercase">Switch User</div>
                            {users.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => handleSwitchUser(user)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                                  user.id === currentUser.id ? 'bg-purple-50 text-purple-700' : 'text-gray-700'
                                }`}
                              >
                                <div className="font-medium">{user.name || user.username}</div>
                                <div className="text-xs text-gray-500">@{user.username}</div>
                              </button>
                            ))}
                          </>
                        ) : (
                          <div className="p-3 text-sm text-gray-500 text-center">No other users</div>
                        )}
                      </div>
                      <div className="p-2 border-t border-gray-200">
                        <button
                          onClick={onLogout}
                          className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={onLogout}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
        {/* Mobile menu */}
        <div className="sm:hidden border-t border-gray-200">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3 py-2 text-base font-medium ${
                    isActive
                      ? 'bg-purple-50 border-purple-500 text-purple-700 border-l-4'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 border-l-4'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <footer className="bg-[#0F1216] border-t border-[#1a1f26] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Logo and Branding */}
            <div className="flex items-center gap-4">
              <img src="/logo_white_small.png" alt="Port42 Developments" className="h-12 w-auto" />
              <div className="h-12 w-px bg-[#8A94A6] opacity-30"></div>
              <div className="flex flex-col">
                <img src="/pleb_finance_logo.png" alt="Plebs Finance" className="h-6 w-auto" />
                <span className="text-xs text-[#8A94A6]">Developed by Port42 Developments</span>
              </div>
            </div>
            
            {/* Copyright */}
            <div className="flex flex-col items-center md:items-end gap-1">
              <span className="text-sm text-[#8A94A6]">
                © {new Date().getFullYear()} Port42 Developments
              </span>
              <span className="text-xs text-[#8A94A6] opacity-70">
                All rights reserved.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

