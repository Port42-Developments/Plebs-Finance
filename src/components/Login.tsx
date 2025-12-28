import { useState } from 'react';
import { api } from '../api';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Handle legacy user migration
    if (needsMigration) {
      if (!username.trim()) {
        setError('Username is required to migrate your account');
        setLoading(false);
        return;
      }
      if (pin.length < 4) {
        setError('PIN must be at least 4 digits');
        setLoading(false);
        return;
      }
      
      setMigrating(true);
      try {
        const result = await api.migrateLegacyUser(username.trim(), pin);
        if (result.success && result.user) {
          localStorage.setItem('currentUserId', result.user.id);
          onLogin(result.user);
        } else {
          setError(result.error || 'Migration failed');
          setMigrating(false);
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to migrate account');
        setMigrating(false);
        setLoading(false);
      }
      return;
    }

    // If user is creating new account, require confirmation
    if (isNewUser) {
      if (!username.trim()) {
        setError('Username is required');
        setLoading(false);
        return;
      }
      if (pin.length < 4) {
        setError('PIN must be at least 4 digits');
        setLoading(false);
        return;
      }
      if (pin !== confirmPin) {
        setError('PINs do not match');
        setLoading(false);
        return;
      }

      try {
        const result = await api.registerUser(username.trim(), pin, name.trim() || username.trim());
        if (result.success && result.user) {
          localStorage.setItem('currentUserId', result.user.id);
          onLogin(result.user);
        } else {
          setError(result.error || 'Registration failed');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to register');
      } finally {
        setLoading(false);
      }
    } else {
      // Login existing user - check for legacy account if no username provided
      if (!username.trim() && pin) {
        try {
          const verifyResult = await api.verifyPin(pin);
          if (verifyResult.success && verifyResult.needsMigration) {
            // Legacy user needs to migrate
            setNeedsMigration(true);
            setLoading(false);
            return;
          }
          setError('Please enter your username');
        } catch (err: any) {
          setError('Please enter your username and PIN');
        } finally {
          setLoading(false);
        }
        return;
      }

      // Normal login with username
      if (!username.trim()) {
        setError('Username is required');
        setLoading(false);
        return;
      }

      try {
        const result = await api.loginUser(username.trim(), pin);
        if (result.success && result.user) {
          localStorage.setItem('currentUserId', result.user.id);
          onLogin(result.user);
        } else {
          setError(result.error || 'Invalid username or PIN');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to login');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src="/logo_black_small.png" alt="Port42 Developments" className="h-16 w-auto" />
        </div>
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Plebs Finance
        </h1>
        <p className="text-center text-gray-600 mb-2">
          {needsMigration 
            ? 'Migrate your account - Choose a username' 
            : isNewUser 
              ? 'Create a new account' 
              : 'Login to your account'}
        </p>
        {!isNewUser && !needsMigration && (
          <p className="text-center text-sm text-purple-600 mb-4 cursor-pointer hover:underline" onClick={() => setIsNewUser(true)}>
            New user? Create an account
          </p>
        )}
        {needsMigration && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-4">
            <p className="text-sm font-medium mb-1">Account Migration Required</p>
            <p className="text-xs">Your account needs a username to work with the new system. Please choose a username below.</p>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {needsMigration ? (
            <>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                autoFocus
                required
              />
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter your PIN"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest mb-4"
                maxLength={6}
                required
              />
            </>
          ) : (
            <>
              {!isNewUser && (
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username (or enter PIN only for legacy accounts)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                  autoFocus
                />
              )}
              {isNewUser && (
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                  autoFocus
                  required
                />
              )}
              {isNewUser && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                />
              )}
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={isNewUser ? "Create PIN (4-6 digits)" : "Enter PIN"}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest mb-4"
                maxLength={6}
                required
              />
            </>
          )}
          {isNewUser && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
            />
          )}
          {!needsMigration && (
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={isNewUser ? "Create PIN (4-6 digits)" : "Enter PIN"}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest mb-4"
              maxLength={6}
            />
          )}
          {needsMigration && (
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your PIN"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest mb-4"
              maxLength={6}
            />
          )}
          {isNewUser && !needsMigration && (
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="Confirm PIN"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest mb-4"
              maxLength={6}
            />
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || pin.length < 4 || (isNewUser && confirmPin.length < 4)}
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || migrating 
              ? (migrating ? 'Migrating...' : isNewUser ? 'Creating...' : 'Logging in...') 
              : (needsMigration ? 'Migrate Account' : isNewUser ? 'Create Account' : 'Login')}
          </button>
        </form>
        {isNewUser && (
          <p className="text-sm text-gray-500 text-center mt-4">
            <button type="button" onClick={() => setIsNewUser(false)} className="text-purple-600 hover:underline">
              Already have an account? Login
            </button>
          </p>
        )}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-col items-center gap-3">
            <img src="/logo.svg" alt="Port42 Developments" className="h-8 w-auto opacity-80" />
            <p className="text-xs text-center text-gray-500">
              © {new Date().getFullYear()} Port42 Developments. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

