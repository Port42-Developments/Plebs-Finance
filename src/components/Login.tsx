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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

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
      // Login existing user
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
          <img src="/pleb_finance_logo.png" alt="Plebs Finance" className="h-20 w-auto" />
        </div>
        <p className="text-center text-gray-600 mb-2">
          {isNewUser ? 'Create a new account' : 'Login to your account'}
        </p>
        {!isNewUser && (
          <p className="text-center text-sm text-purple-600 mb-4 cursor-pointer hover:underline" onClick={() => setIsNewUser(true)}>
            New user? Create an account
          </p>
        )}
        <form onSubmit={handleSubmit}>
          {!isNewUser && (
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
              autoFocus
              required
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
          {isNewUser && (
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
            {loading ? (isNewUser ? 'Creating...' : 'Logging in...') : (isNewUser ? 'Create Account' : 'Login')}
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
            <img src="/logo_black_small.png" alt="Port42 Developments" className="h-8 w-auto opacity-80" />
            <p className="text-xs text-center text-gray-500">
              © {new Date().getFullYear()} Port42 Developments. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
