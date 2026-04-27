import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './components/Login';
import ForgotPin from './components/ForgotPin';
import ResetPin from './components/ResetPin';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import NurseView from './components/NurseView';
import PatientView from './components/PatientView';
import SpecialistView from './components/SpecialistView';
import ScanReferral from './components/ScanReferral';
import Schedules from './components/Schedules';
import RegisterNonCitizen from './components/RegisterNonCitizen';
import RescheduleRequest from './components/RescheduleRequest';
import Reports from './components/Reports';
import Notifications from './components/Notifications';
import ReferralTracker from './components/ReferralTracker';
// Admin components
import AdminDashboard from './components/admin/AdminDashboard';
import UserManagement from './components/admin/UserManagement';
import AuditLogs from './components/admin/AuditLogs';
import SystemSettings from './components/admin/SystemSettings';

// Wrapper for authenticated layout (sidebar + topbar)
function AuthenticatedLayout({ children }) {
  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 ml-[260px] overflow-auto">
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

function App() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
          <p className="text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-pin" element={<ForgotPin />} />
        <Route path="/reset-pin" element={<ResetPin />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const getHomePath = () => {
    switch (user?.role) {
      case 'patient': return '/patient';
      case 'head_nurse': return '/nurse';
      case 'specialist': return '/specialist';
      case 'admin': return '/admin';
      default: return '/dashboard';
    }
  };

  return (
    <AuthenticatedLayout>
      <Routes>
        <Route path="/" element={<Navigate to={getHomePath()} replace />} />
        
        {/* Common routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/schedule" element={<Schedules />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/forgot-pin" element={<ForgotPin />} />
        <Route path="/reset-pin" element={<ResetPin />} />
        
        {/* Patient routes */}
        <Route path="/patient" element={user?.role === 'patient' ? <PatientView /> : <Navigate to={getHomePath()} replace />} />
        <Route path="/reschedule/:id" element={user?.role === 'patient' ? <RescheduleRequest /> : <Navigate to={getHomePath()} replace />} />
        
        {/* Head Nurse routes */}
        <Route path="/nurse" element={user?.role === 'head_nurse' ? <NurseView /> : <Navigate to={getHomePath()} replace />} />
        <Route path="/scan" element={user?.role === 'head_nurse' ? <ScanReferral /> : <Navigate to={getHomePath()} replace />} />
        <Route path="/register-non-citizen" element={user?.role === 'head_nurse' ? <RegisterNonCitizen /> : <Navigate to={getHomePath()} replace />} />
        {/* Reports - accessible by head_nurse AND admin */}
        <Route path="/reports" element={user?.role === 'head_nurse' || user?.role === 'admin' ? <Reports /> : <Navigate to={getHomePath()} replace />} />
        <Route path="/referral-tracker" element={user?.role === 'head_nurse' ? <ReferralTracker /> : <Navigate to={getHomePath()} replace />} />
        
        {/* Specialist routes */}
        <Route path="/specialist" element={user?.role === 'specialist' ? <SpecialistView /> : <Navigate to={getHomePath()} replace />} />
        
        {/* Admin routes */}
        <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to={getHomePath()} replace />} />
        <Route path="/admin/users" element={user?.role === 'admin' ? <UserManagement /> : <Navigate to={getHomePath()} replace />} />
        <Route path="/admin/activity" element={user?.role === 'admin' ? <AuditLogs /> : <Navigate to={getHomePath()} replace />} />
        <Route path="/admin/settings" element={user?.role === 'admin' ? <SystemSettings /> : <Navigate to={getHomePath()} replace />} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to={getHomePath()} replace />} />
      </Routes>
    </AuthenticatedLayout>
  );
}

// Wrap the entire App with ThemeProvider so it's available everywhere
export default function Root() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}