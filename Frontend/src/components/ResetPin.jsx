import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ResetPin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialToken = searchParams.get('token') || '';

  const [token, setToken] = useState(initialToken);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token.trim()) {
      toast.error('Token is required');
      return;
    }
    if (!newPin || !confirmPin) {
      toast.error('Please enter and confirm your new PIN');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }
    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      toast.error('PIN must be 4 digits');
      return;
    }

    setLoading(true);
    console.log('🔐 Submitting reset with token:', token, 'newPin:', newPin);
    try {
      // The backend expects { token, new_pin }
      const response = await authAPI.confirmResetPin(token, newPin);
      console.log('✅ Reset successful:', response.data);
      toast.success('PIN reset successful! Please login with your new PIN.');
      navigate('/login');
    } catch (error) {
      console.error('❌ Reset error:', error.response || error);
      // Show the exact error message from backend
      const msg = error.response?.data?.message || error.message || 'Failed to reset PIN';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="bg-bg-card backdrop-blur-md border border-border rounded-xl p-8 w-full max-w-md">
        <h1 className="font-serif text-2xl text-white mb-6 text-center">Set New PIN</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">Reset Token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full input"
              placeholder="Enter the token from SMS/email"
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
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3"
          >
            {loading ? 'Resetting...' : 'Reset PIN'}
          </button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">
              Back to Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}