import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsOpen(true);
      else setIsOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

 const getNavItems = () => {
  const roleSpecific = {
    patient: [
      { path: '/patient', icon: 'fa-user-injured', label: 'My Appointments' },
    ],
    head_nurse: [
      { path: '/nurse', icon: 'fa-user-nurse', label: 'Head Nurse Station' },
      { path: '/scan', icon: 'fa-camera', label: 'Scan Referral' },
      { path: '/schedule', icon: 'fa-calendar-check', label: 'Schedules' },
      { path: '/register-non-citizen', icon: 'fa-passport', label: 'Register Non-Citizen' },
      { path: '/referral-tracker', icon: 'fa-chart-line', label: 'Referral Tracker' },
      // Reports removed from here - now admin only
    ],
    specialist: [
      { path: '/specialist', icon: 'fa-stethoscope', label: 'My Patients' },
      { path: '/schedule', icon: 'fa-calendar-alt', label: 'My Schedule' },
    ],
    admin: [
      { path: '/admin', icon: 'fa-tachometer-alt', label: 'Admin Dashboard' },
      { path: '/admin/users', icon: 'fa-users', label: 'User Management' },
      { path: '/admin/activity', icon: 'fa-history', label: 'Activity Logs' },
      { path: '/admin/settings', icon: 'fa-cog', label: 'System Settings' },
      { path: '/schedule', icon: 'fa-calendar', label: 'Schedules' },
      { path: '/reports', icon: 'fa-chart-bar', label: 'Reports' },  // Reports only for admin
    ],
  };
  
  // Add dashboard for all roles except admin (admin has its own dashboard)
  if (user?.role !== 'admin') {
    roleSpecific[user?.role]?.unshift({ path: '/dashboard', icon: 'fa-columns', label: 'Dashboard' });
  }
  
  return roleSpecific[user?.role] || [{ path: '/dashboard', icon: 'fa-columns', label: 'Dashboard' }];
};
 
  const navItems = getNavItems();

  const handleNavClick = () => { if (isMobile) setIsOpen(false); };

  return (
    <>
      {isMobile && (
        <button onClick={() => setIsOpen(!isOpen)} className="fixed top-4 left-4 z-50 w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg">
          <i className={`fas ${isOpen ? 'fa-times' : 'fa-bars'}`}></i>
        </button>
      )}
      {isMobile && isOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />}
      <aside className={`${isMobile ? 'fixed z-50 transition-transform duration-300' : 'fixed'} ${isOpen || !isMobile ? 'translate-x-0' : '-translate-x-full'} w-[260px] bg-bg-sidebar backdrop-blur-lg border-r border-border h-full`}>
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-light to-primary-dark rounded-xl flex items-center justify-center">
              <i className="fas fa-notes-medical text-white"></i>
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold text-white">ISAS</h1>
              <p className="text-xs text-text-muted">Referral System</p>
            </div>
          </div>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} onClick={handleNavClick} className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}>
              <i className={`fas ${item.icon} w-6`}></i>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-light to-primary-dark flex items-center justify-center text-white font-bold">
              {user?.full_name?.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.full_name}</p>
              <p className="text-xs text-text-muted capitalize">
                {user?.role === 'head_nurse' ? 'Head Nurse' : user?.role}
              </p>
              {user?.role === 'head_nurse' && user?.profile?.department && (
                <p className="text-xs text-primary truncate">{user.profile.department}</p>
              )}
              {user?.role === 'specialist' && user?.profile?.specialty && (
                <p className="text-xs text-primary truncate">{user.profile.specialty}</p>
              )}
            </div>
            <button onClick={logout} className="w-8 h-8 rounded-lg hover:bg-red-bg text-text-muted hover:text-primary transition-colors" title="Logout">
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </aside>
      {!isMobile && <div className="w-[260px] flex-shrink-0" />}
    </>
  );
}