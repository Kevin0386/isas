import React, { useState } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ChangePin({ onClose, onSuccess }) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentPin || !newPin || !confirmPin) {
      toast.error('Please fill in all fields');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('New PINs do not match');
      return;
    }
    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      toast.error('PIN must be 4 digits');
      return;
    }
    if (currentPin === newPin) {
      toast.error('New PIN must be different from current PIN');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePin(currentPin, newPin);
      toast.success('PIN changed successfully! Please login again.');
      setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card rounded-xl border border-border w-full max-w-md">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="font-serif text-xl text-white">Change PIN</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">Current PIN</label>
            <input
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full input"
              placeholder="••••"
              maxLength="4"
              required
            />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">New PIN (4 digits)</label>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full input"
              placeholder="••••"
              maxLength="4"
              required
            />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Confirm New PIN</label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full input"
              placeholder="••••"
              maxLength="4"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="bg-sky hover:bg-sky-mid text-white px-4 py-2 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg disabled:opacity-50">
              {loading ? <><i className="fas fa-spinner fa-spin mr-2"></i>Changing...</> : 'Change PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}