import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { statsAPI, appointmentAPI, referralAPI } from '../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    referrals_today: 0,
    pending_appointments: 0,
    no_show_rate: 0,
    role_specific: {}
  });
  const [recentReferrals, setRecentReferrals] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const statsResponse = await statsAPI.getDashboard();
      setStats(statsResponse.data);

      const appointmentsResponse = await appointmentAPI.getTodayAppointments();
      setTodayAppointments(appointmentsResponse.data);

      if (user?.role === 'patient') {
        const patientId = user?.profile?.id;
        if (patientId) {
          const referralsResponse = await referralAPI.getPatientReferrals(patientId);
          setRecentReferrals(referralsResponse.data.slice(0, 5));
        }
      } else if (user?.role === 'specialist') {
        const specialistId = user?.profile?.id;
        if (specialistId) {
          const referralsResponse = await referralAPI.getSpecialistReferrals(specialistId, 'pending');
          setRecentReferrals(referralsResponse.data.slice(0, 5));
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getRoleSpecificContent = () => {
    if (!user) return null;

    switch (user.role) {
      case 'patient':
        return (
          <div className="bg-sky-mid rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <i className="fas fa-calendar-check text-2xl text-green-500"></i>
              <div>
                <p className="font-medium">Your Appointments</p>
                <p className="text-sm text-text-muted">
                  {stats.role_specific?.my_appointments || 0} upcoming
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/patient" className="text-sm text-primary hover:underline">
                View All <i className="fas fa-arrow-right ml-1"></i>
              </Link>
            </div>
          </div>
        );

      case 'nurse':
        return (
          <div className="bg-sky-mid rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-bold text-primary">{stats.role_specific?.pending_scans || 0}</p>
                <p className="text-xs text-text-muted">Pending Scans</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-500">{stats.role_specific?.reschedule_requests || 0}</p>
                <p className="text-xs text-text-muted">Reschedule Requests</p>
              </div>
            </div>
          </div>
        );

      case 'specialist':
        return (
          <div className="bg-sky-mid rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-bold text-green-500">{stats.role_specific?.today_appointments || 0}</p>
                <p className="text-xs text-text-muted">Today's Patients</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-500">{stats.role_specific?.pending_referrals || 0}</p>
                <p className="text-xs text-text-muted">Pending Referrals</p>
              </div>
            </div>
          </div>
        );

      case 'admin':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-sky-mid p-4 rounded-lg">
              <p className="text-2xl font-bold text-primary">{stats.role_specific?.total_users || 0}</p>
              <p className="text-xs text-text-muted">Total Users</p>
            </div>
            <div className="bg-sky-mid p-4 rounded-lg">
              <p className="text-2xl font-bold text-green-500">{stats.role_specific?.active_sessions || 0}</p>
              <p className="text-xs text-text-muted">Active Sessions</p>
            </div>
            <div className="bg-sky-mid p-4 rounded-lg">
              <p className="text-2xl font-bold text-yellow-500">{stats.role_specific?.referrals_today || 0}</p>
              <p className="text-xs text-text-muted">Referrals Today</p>
            </div>
            <div className="bg-sky-mid p-4 rounded-lg">
              <p className="text-2xl font-bold text-blue-500">{stats.role_specific?.appointments_today || 0}</p>
              <p className="text-xs text-text-muted">Appointments Today</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-4xl text-primary"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-serif text-2xl text-white">
            Welcome back, <span className="text-primary">{user?.full_name}</span>
          </h1>
          <p className="text-text-muted text-sm">
            {new Date().toLocaleDateString('en-BW', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="panel">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-text-muted text-sm">Referrals Today</p>
              <p className="text-3xl font-bold mt-1">{stats.referrals_today}</p>
              <p className="text-green-500 text-xs mt-2">
                <i className="fas fa-arrow-up mr-1"></i> from database
              </p>
            </div>
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <i className="fas fa-file-medical text-primary text-xl"></i>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-text-muted text-sm">Pending Appointments</p>
              <p className="text-3xl font-bold mt-1">{stats.pending_appointments}</p>
              <p className="text-yellow-500 text-xs mt-2">
                <i className="fas fa-clock mr-1"></i> awaiting confirmation
              </p>
            </div>
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <i className="fas fa-calendar-check text-yellow-500 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-text-muted text-sm">No-Show Rate</p>
              <p className="text-3xl font-bold mt-1">{stats.no_show_rate}%</p>
              <p className="text-primary text-xs mt-2">
                <i className="fas fa-exclamation-triangle mr-1"></i> target &lt;8%
              </p>
            </div>
            <div className="w-10 h-10 bg-red-bg rounded-lg flex items-center justify-center">
              <i className="fas fa-user-slash text-primary text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Role-specific Content */}
      <div className="panel">
        <h2 className="font-serif text-lg mb-4">Your Overview</h2>
        {getRoleSpecificContent()}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Referrals */}
        <div className="panel">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-serif text-lg">Recent Referrals</h2>
            <Link to={user?.role === 'patient' ? '/patient' : '/referrals'} className="text-primary text-sm hover:underline">
              View All <i className="fas fa-arrow-right ml-1"></i>
            </Link>
          </div>

          <div className="space-y-3">
            {recentReferrals.length === 0 ? (
              <p className="text-text-muted text-center py-4">No recent referrals</p>
            ) : (
              recentReferrals.map((ref, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-sky-mid rounded-lg">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-file-prescription text-primary"></i>
                    <div>
                      <p className="font-medium">{ref.patient?.name || `Referral #${ref.referral_number}`}</p>
                      <p className="text-xs text-text-muted">{ref.referral_number}</p>
                    </div>
                  </div>
                  <span className={`badge ${
                    ref.priority === 'emergency' ? 'badge-missed' :
                    ref.priority === 'urgent' ? 'badge-pending' : 'badge-confirmed'
                  }`}>
                    {ref.priority || 'routine'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="panel">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-serif text-lg">Today's Schedule</h2>
            <Link to="/schedule" className="text-primary text-sm hover:underline">
              Full Schedule <i className="fas fa-arrow-right ml-1"></i>
            </Link>
          </div>

          <div className="space-y-3">
            {todayAppointments.length === 0 ? (
              <p className="text-text-muted text-center py-4">No appointments today</p>
            ) : (
              todayAppointments.map((apt, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-sky-mid rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <i className="fas fa-user text-primary"></i>
                    </div>
                    <div>
                      <p className="font-medium">{apt.patient_name}</p>
                      <p className="text-xs text-text-muted">{apt.time}</p>
                    </div>
                  </div>
                  <span className={`badge ${
                    apt.checked_in ? 'badge-confirmed' :
                    apt.status === 'scheduled' ? 'badge-pending' : 'badge-missed'
                  }`}>
                    {apt.checked_in ? 'Checked In' : apt.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}