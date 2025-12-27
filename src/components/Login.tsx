import { useState } from 'react';
import { Lock } from 'lucide-react';
import { api } from '../api';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // If user is creating new PIN, require confirmation
    if (isNewUser) {
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
    }

    try {
      const result = await api.verifyPin(pin);
      if (result.success) {
        onLogin();
      } else {
        setError(result.error || 'Invalid PIN');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src="/logo.svg" alt="Port42 Developments" className="h-16 w-auto" />
        </div>
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Plebs Finance
        </h1>
        <p className="text-center text-gray-600 mb-2">
          {isNewUser ? 'Welcome! Create your PIN' : 'Enter your PIN to continue'}
        </p>
        {!isNewUser && (
          <p className="text-center text-sm text-purple-600 mb-4 cursor-pointer hover:underline" onClick={() => setIsNewUser(true)}>
            New user? Create a PIN
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={isNewUser ? "Create PIN (4-6 digits)" : "Enter PIN"}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest mb-4"
            maxLength={6}
            autoFocus
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
            {loading ? (isNewUser ? 'Creating...' : 'Verifying...') : (isNewUser ? 'Create PIN' : 'Login')}
          </button>
        </form>
        {isNewUser && (
          <p className="text-sm text-gray-500 text-center mt-4">
            <button type="button" onClick={() => setIsNewUser(false)} className="text-purple-600 hover:underline">
              Already have a PIN? Login
            </button>
          </p>
        )}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-center text-gray-400">
            © {new Date().getFullYear()} Port42 Developments. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

