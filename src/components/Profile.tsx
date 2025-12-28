import { useState, useEffect } from 'react';
import { User, Lock, Globe, DollarSign, Save, Moon, Sun } from 'lucide-react';
import { api } from '../api';
import { UserProfile } from '../types';
import { useDarkMode } from '../hooks/useDarkMode';

const CURRENCIES = [
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
];

const TIMEZONES = [
  { value: 'Pacific/Auckland', label: 'Auckland, New Zealand (GMT+12)' },
  { value: 'Australia/Sydney', label: 'Sydney, Australia (GMT+10)' },
  { value: 'America/New_York', label: 'New York, USA (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles, USA (GMT-8)' },
  { value: 'Europe/London', label: 'London, UK (GMT+0)' },
  { value: 'Europe/Paris', label: 'Paris, France (GMT+1)' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Japan (GMT+9)' },
];

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    picture: '',
    currency: 'NZD',
    timezone: 'Pacific/Auckland',
    darkMode: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinForm, setPinForm] = useState({
    oldPin: '',
    newPin: '',
    confirmPin: '',
  });
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  useDarkMode(profile.darkMode);

  const loadProfile = async () => {
    try {
      const p = await api.getProfile();
      setProfile(p);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile(profile);
      alert('Profile updated successfully!');
      // Reload page to apply dark mode changes
      window.location.reload();
    } catch (error) {
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (pinForm.newPin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }

    if (pinForm.newPin !== pinForm.confirmPin) {
      setPinError('New PINs do not match');
      return;
    }

    try {
      await api.changePin(pinForm.oldPin, pinForm.newPin);
      setShowPinModal(false);
      setPinForm({ oldPin: '', newPin: '', confirmPin: '' });
      alert('PIN changed successfully!');
    } catch (error: any) {
      setPinError(error.message || 'Failed to change PIN');
    }
  };

  const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile({ ...profile, picture: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return <div className="text-center py-12 dark:text-white">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-2xl">
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Profile Picture */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Profile Picture</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {profile.picture ? (
                  <img src={profile.picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePictureChange}
                  className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF. Max size 5MB</p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Your name"
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Currency
            </label>
            <select
              value={profile.currency}
              onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              {CURRENCIES.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.code} - {curr.name}
                </option>
              ))}
            </select>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Timezone
            </label>
            <select
              value={profile.timezone}
              onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dark Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
              {profile.darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              Dark Mode
            </label>
            <button
              type="button"
              onClick={() => {
                const newDarkMode = !profile.darkMode;
                setProfile({ ...profile, darkMode: newDarkMode });
              }}
              className={`w-full px-4 py-3 rounded-lg border-2 transition-colors ${
                profile.darkMode
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-white border-gray-300 text-gray-700'
              } hover:opacity-90`}
            >
              <div className="flex items-center justify-between">
                <span>{profile.darkMode ? 'Dark mode enabled' : 'Light mode enabled'}</span>
                <div
                  className={`w-12 h-6 rounded-full transition-colors ${
                    profile.darkMode ? 'bg-purple-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                      profile.darkMode ? 'translate-x-6' : 'translate-x-0.5'
                    } mt-0.5`}
                  />
                </div>
              </div>
            </button>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change PIN Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold dark:text-white">Change PIN</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Change your PIN code to secure your account. Your PIN must be at least 4 digits.
        </p>
        <button
          onClick={() => setShowPinModal(true)}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
        >
          Change PIN
        </button>
      </div>

      {/* Change PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold dark:text-white mb-4">Change PIN</h2>
            <form onSubmit={handleChangePin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current PIN</label>
                <input
                  type="password"
                  value={pinForm.oldPin}
                  onChange={(e) => setPinForm({ ...pinForm, oldPin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 text-center text-xl tracking-widest"
                  maxLength={6}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New PIN</label>
                <input
                  type="password"
                  value={pinForm.newPin}
                  onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 text-center text-xl tracking-widest"
                  maxLength={6}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New PIN</label>
                <input
                  type="password"
                  value={pinForm.confirmPin}
                  onChange={(e) => setPinForm({ ...pinForm, confirmPin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 text-center text-xl tracking-widest"
                  maxLength={6}
                  required
                />
              </div>
              {pinError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {pinError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinForm({ oldPin: '', newPin: '', confirmPin: '' });
                    setPinError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Change PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

