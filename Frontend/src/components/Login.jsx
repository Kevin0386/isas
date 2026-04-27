import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateOmang, formatOmang } from '../utils/omangValidator';
import toast from 'react-hot-toast';
import api from '../services/api';
import ThemeToggle from './ThemeToggle';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [omang, setOmang] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState({ valid: null, gender: null, message: '' });
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [loadingDemo, setLoadingDemo] = useState(true);

  useEffect(() => {
    const fetchDemo = async () => {
      try {
        const res = await api.get('/demo-accounts');
        setDemoAccounts(res.data);
      } catch (err) {
        console.error('Failed to fetch demo accounts', err);
      } finally {
        setLoadingDemo(false);
      }
    };
    fetchDemo();
  }, []);

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
      toast.error(validation.message || 'Please enter a valid Omang number');
      return;
    }
    if (!pin || pin.length !== 4) {
      toast.error('PIN must be 4 digits');
      return;
    }
    setLoading(true);
    try {
      const response = await login(omang, pin);
      toast.success(`Welcome back, ${response.user.full_name}!`);
      switch (response.user.role) {
        case 'patient': navigate('/patient', { replace: true }); break;
        case 'head_nurse': navigate('/nurse', { replace: true }); break;
        case 'specialist': navigate('/specialist', { replace: true }); break;
        case 'admin': navigate('/dashboard', { replace: true }); break;
        default: navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      toast.error(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoOmang) => {
    setOmang(demoOmang);
    const result = validateOmang(demoOmang);
    setValidation(result);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="bg-bg-card backdrop-blur-md border border-border rounded-xl p-8 w-full max-w-md relative">
        {/* Theme toggle placed in the top‑right corner of the card */}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-light to-primary-dark rounded-2xl flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-notes-medical text-3xl text-white"></i>
          </div>
          <h1 className="font-serif text-3xl font-bold bg-gradient-to-r from-white to-red-200 bg-clip-text text-transparent">
            Integrated Specialist<br />Appointment & Referral System
          </h1>
          <p className="text-text-muted text-sm mt-2">Botswana Public Healthcare</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-text-muted text-sm mb-2">Omang Number</label>
            <div className="relative">
              <input
                type="text"
                value={omang}
                onChange={handleOmangChange}
                className={`w-full input ${validation.valid === false ? 'input-error' : ''}`}
                placeholder="Enter 9-digit Omang"
                maxLength="9"
                required
                autoFocus
              />
              {validation.valid === true && <i className="fas fa-check-circle absolute right-3 top-1/2 -translate-y-1/2 text-green-500"></i>}
              {validation.valid === false && <i className="fas fa-exclamation-circle absolute right-3 top-1/2 -translate-y-1/2 text-primary"></i>}
            </div>
            {validation.gender && (
              <p className="text-xs text-text-muted mt-1">
                <i className={`fas fa-${validation.gender === 'male' ? 'mars' : 'venus'} mr-1`}></i>
                {validation.gender === 'male' ? 'Male' : 'Female'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-text-muted text-sm mb-2">PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full input"
              placeholder="4-digit PIN"
              maxLength="4"
              required
            />
          </div>

          <button type="submit" disabled={loading || !validation.valid} className="w-full btn-primary py-3 text-lg">
            {loading ? <><i className="fas fa-spinner fa-spin mr-2"></i>Logging in...</> : 'Login'}
          </button>

          <p className="text-center mt-4">
            <Link to="/forgot-pin" className="text-primary hover:underline text-sm">Forgot PIN?</Link>
          </p>
        </form>

        {!loadingDemo && demoAccounts.length > 0 && (
          <div className="mt-6 p-4 bg-sky-mid rounded-lg">
            <p className="text-xs text-text-muted mb-3">Demo Accounts (PIN: 1234 for all):</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.omang}
                  onClick={() => fillDemo(acc.omang)}
                  className="bg-sky-deep p-2 rounded text-left hover:bg-sky-mid transition-colors"
                >
                  <span className="text-primary">
                    {acc.role === 'patient' && '👤'}
                    {acc.role === 'head_nurse' && '👩‍⚕️'}
                    {acc.role === 'specialist' && '👨‍⚕️'}
                    {acc.role === 'admin' && '🛠️'}
                  </span>{' '}
                  {acc.omang} ({acc.role_display})
                  {acc.department && <span className="block text-xs text-text-muted">📁 {acc.department}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-text-muted text-xs mt-4">
          © {new Date().getFullYear()} Integrated Specialist Appointment and Referral System
        </p>
      </div>
    </div>
  );
}