import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, DollarSign, CreditCard, Receipt, FileText, Target, User, Wallet, LogOut } from 'lucide-react';
import { User as UserType } from '../types';
import { api } from '../api';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  currentUser: UserType | null;
}

export default function Layout({ children, onLogout, currentUser }: LayoutProps) {
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

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

  const handleProfileMenuClick = () => {
    if (!showProfileMenu) {
      loadUsers();
    }
    setShowProfileMenu(!showProfileMenu);
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
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow-lg">
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
                          ? 'border-purple-500 text-gray-900 dark:text-white'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200'
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
                <div className="relative" ref={profileMenuRef}>
                  <button
                    onClick={handleProfileMenuClick}
                    className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">{currentUser.name || currentUser.username}</span>
                  </button>
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                      {/* User Info */}
                      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{currentUser.name || currentUser.username}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">@{currentUser.username}</div>
                      </div>
                      
                      {/* Profile Link */}
                      <Link
                        to="/profile"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700"
                      >
                        <User className="w-4 h-4" />
                        Profile
                      </Link>

                      {/* Switch User Section */}
                      <div className="max-h-48 overflow-y-auto">
                        {loadingUsers ? (
                          <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">Loading users...</div>
                        ) : users.length > 1 ? (
                          <>
                            <div className="p-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">Switch User</div>
                            {users.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => {
                                  handleSwitchUser(user);
                                  setShowProfileMenu(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                  user.id === currentUser.id ? 'bg-purple-50 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <div className="font-medium">{user.name || user.username}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</div>
                              </button>
                            ))}
                          </>
                        ) : null}
                      </div>

                      {/* Logout */}
                      <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => {
                            onLogout();
                            setShowProfileMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Mobile menu */}
        <div className="sm:hidden border-t border-gray-200 dark:border-gray-700">
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
                      ? 'bg-purple-50 dark:bg-purple-900 border-purple-500 text-purple-700 dark:text-purple-300 border-l-4'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-800 dark:hover:text-gray-200 border-l-4'
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
                <img src="/pleb_finance_logo.png" alt="Plebs Finance" className="h-6" style={{ objectFit: 'contain', maxWidth: '200px', width: 'auto' }} />
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

