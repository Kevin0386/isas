import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { validateOmang, formatOmang } from '../utils/omangValidator';
import toast from 'react-hot-toast';

export default function ForgotPin() {
  const [omang, setOmang] = useState('');
  const [validation, setValidation] = useState({ valid: null, gender: null, message: '' });
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleOmangChange = (e) => {
    const formatted = formatOmang(e.target.value);
    setOmang(formatted);
    if (formatted.length === 9) {
      const result = validateOmang(formatted);
      setValidation(result);
    } else {
      setValidation({ valid: null, gender: null, message: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validation.valid) {
      toast.error(validation.message || 'Invalid Omang');
      return;
    }
    setLoading(true);
    try {
      const response = await authAPI.resetPin(omang);
      toast.success(response.data.message || 'Reset email sent!');
      setEmailSent(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to request reset');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="bg-bg-card backdrop-blur-md border border-border rounded-xl p-8 w-full max-w-md text-center">
          <i className="fas fa-envelope-open-text text-5xl text-primary mb-4"></i>
          <h2 className="font-serif text-2xl mb-2">Check Your Email</h2>
          <p className="text-text-muted mb-4">
            We've sent a password reset link to the email address associated with this Omang number.
          </p>
          <Link to="/login" className="btn-primary inline-block px-6 py-3">
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="bg-bg-card backdrop-blur-md border border-border rounded-xl p-8 w-full max-w-md">
        <h1 className="font-serif text-2xl text-white mb-6 text-center">Reset PIN</h1>
        <p className="text-text-muted text-sm mb-6 text-center">
          Enter your Omang number. We'll send a reset link to your registered email.
        </p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-text-muted text-sm mb-2">Omang Number</label>
            <input
              type="text"
              value={omang}
              onChange={handleOmangChange}
              className={`w-full input ${validation.valid === false ? 'input-error' : ''}`}
              placeholder="9-digit Omang"
              maxLength="9"
              required
            />
            {validation.gender && (
              <p className="text-xs text-text-muted mt-1">
                <i className={`fas fa-${validation.gender === 'male' ? 'mars' : 'venus'} mr-1`}></i>
                {validation.gender === 'male' ? 'Male' : 'Female'}
              </p>
            )}
          </div>
          <button type="submit" disabled={loading || !validation.valid} className="w-full btn-primary py-3">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
          <p className="text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">Back to Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}