import React, { useState, useEffect } from 'react';
import { adminAPI, escalationAPI } from '../../services/api';
// NOTE: Ensure adminAPI has this method in ../../services/api.js:
//   checkMissedAppointments: () => api.post('/admin/check-missed-appointments')
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import ServerLogs from './ServerLogs';
import TerminalMonitor from './TerminalMonitor';
import NoShowStats from '../NoShowStats';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    users: { total: 0, by_role: [], active_sessions: 0 },
    activity: { logins_today: 0, referrals_today: 0, appointments_today: 0 },
    system: { database_size_mb: 0 }
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [checkingMissed, setCheckingMissed] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'fa-chart-line' },
    { id: 'users', label: 'Users', icon: 'fa-users' },
    { id: 'activity', label: 'Activity Logs', icon: 'fa-history' },
    { id: 'settings', label: 'Settings', icon: 'fa-cog' },
    { id: 'nostats', label: 'No-Show Analytics', icon: 'fa-chart-line' },
    { id: 'logs', label: 'Server Logs', icon: 'fa-terminal' },
    { id: 'terminal', label: 'Terminal Monitor', icon: 'fa-display' }
  ];

  useEffect(() => {
    loadStats();
    loadAlerts();
    loadRecentUsers();
    loadRecentActivity();
    
    const interval = setInterval(() => {
      loadStats();
      loadAlerts();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const res = await adminAPI.getStats();
      setStats(res.data);
    } catch (error) {
      toast.error('Failed to load stats');
      console.error(error);
    }
  };

  const loadAlerts = async () => {
    try {
      const res = await escalationAPI.getAlerts();
      setAlerts(res.data);
    } catch (error) {
      console.error('Failed to load alerts', error);
    }
  };

  const loadRecentUsers = async () => {
    try {
      const res = await adminAPI.getUsers();
      setRecentUsers(res.data.slice(0, 5));
    } catch (error) {
      console.error('Failed to load recent users', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const res = await adminAPI.getActivityLogs({ limit: 5 });
      setRecentActivity(res.data);
    } catch (error) {
      console.error('Failed to load recent activity', error);
    }
  };

  const handleCheckMissedAppointments = async () => {
    setCheckingMissed(true);
    try {
      const res = await adminAPI.checkMissedAppointments();
      toast.success(`Checked appointments. ${res.data.missed_count || 0} marked as missed.`);
      loadStats();
    } catch (error) {
      console.error('Failed to check missed appointments:', error);
      toast.error('Failed to check missed appointments');
    } finally {
      setCheckingMissed(false);
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      patient: 'bg-blue-500/20 text-blue-500',
      head_nurse: 'bg-green-500/20 text-green-500',
      specialist: 'bg-purple-500/20 text-purple-500',
      admin: 'bg-red-500/20 text-red-500'
    };
    return badges[role] || 'bg-gray-500/20 text-gray-500';
  };

  const getActionBadge = (action) => {
    const colors = {
      LOGIN: 'bg-green-500/20 text-green-500',
      CREATE: 'bg-blue-500/20 text-blue-500',
      UPDATE: 'bg-yellow-500/20 text-yellow-500',
      DELETE: 'bg-red-500/20 text-red-500',
      APPROVE: 'bg-purple-500/20 text-purple-500',
      REJECT: 'bg-red-500/20 text-red-500',
      CHECK_IN: 'bg-cyan-500/20 text-cyan-500',
      RESET_PIN: 'bg-orange-500/20 text-orange-500',
      CHANGE_PIN: 'bg-indigo-500/20 text-indigo-500'
    };
    return colors[action] || 'bg-gray-500/20 text-gray-500';
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
      <div className="flex justify-between items-center">
        <h1 className="font-serif text-2xl text-white">Admin Dashboard</h1>
        <button 
          onClick={() => { loadStats(); loadAlerts(); loadRecentUsers(); loadRecentActivity(); }}
          className="bg-sky hover:bg-sky-mid text-white px-3 py-2 rounded-lg transition-colors"
        >
          <i className="fas fa-sync-alt mr-2"></i>
          Refresh
        </button>
      </div>

      {/* Stats Cards - Only show on overview tab */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="panel">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-sm">Total Users</p>
                  <p className="text-3xl font-bold">{stats.users.total}</p>
                </div>
                <i className="fas fa-users text-3xl text-primary"></i>
              </div>
            </div>
            
            <div className="panel">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-sm">Active Sessions</p>
                  <p className="text-3xl font-bold">{stats.users.active_sessions}</p>
                </div>
                <i className="fas fa-signal text-3xl text-green-500"></i>
              </div>
            </div>
            
            <div className="panel">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-sm">Logins Today</p>
                  <p className="text-3xl font-bold">{stats.activity.logins_today}</p>
                </div>
                <i className="fas fa-sign-in-alt text-3xl text-blue-500"></i>
              </div>
            </div>
            
            <div className="panel">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-muted text-sm">DB Size</p>
                  <p className="text-3xl font-bold">{stats.system.database_size_mb} MB</p>
                </div>
                <i className="fas fa-database text-3xl text-yellow-500"></i>
              </div>
            </div>
          </div>
          
          {/* Users by Role */}
          <div className="panel">
            <h2 className="font-serif text-lg mb-4">Users by Role</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.users.by_role.map(item => (
                <div key={item.role} className="bg-sky-mid p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-primary">{item.count}</p>
                  <p className="text-sm text-text-muted capitalize">{item.role.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-gray-700">
        <nav className="flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <i className={`fas ${tab.icon} mr-2`}></i>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Overview Tab - Additional Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Users */}
            <div className="panel">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-serif text-lg">Recent Users</h2>
                <Link to="/admin/users" className="text-primary text-sm hover:underline">
                  View All <i className="fas fa-arrow-right ml-1"></i>
                </Link>
              </div>
              <div className="space-y-3">
                {recentUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-sky-mid rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <i className="fas fa-user text-primary text-sm"></i>
                      </div>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-xs text-text-muted">{user.omang}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${getRoleBadge(user.role)}`}>
                      {user.role === 'head_nurse' ? 'Head Nurse' : user.role}
                    </span>
                  </div>
                ))}
                {recentUsers.length === 0 && (
                  <p className="text-text-muted text-center py-4">No users found</p>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="panel">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-serif text-lg">Recent Activity</h2>
                <Link to="/admin/activity" className="text-primary text-sm hover:underline">
                  View All <i className="fas fa-arrow-right ml-1"></i>
                </Link>
              </div>
              <div className="space-y-3">
                {recentActivity.map(activity => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-sky-mid rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getActionBadge(activity.action_type)}`}>
                          {activity.action_type}
                        </span>
                        <span className="text-xs text-text-muted">
                          {new Date(activity.performed_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm mt-1">
                        <span className="font-medium">{activity.user_name}</span>
                        <span className="text-text-muted"> performed </span>
                        <span className="text-primary">{activity.action_type}</span>
                        <span className="text-text-muted"> on </span>
                        <span className="font-mono text-xs">{activity.resource_type}</span>
                      </p>
                    </div>
                  </div>
                ))}
                {recentActivity.length === 0 && (
                  <p className="text-text-muted text-center py-4">No recent activity</p>
                )}
              </div>
            </div>

            {/* Escalation Alerts */}
            {alerts.length > 0 && (
              <div className="panel lg:col-span-2 border border-red-500/30">
                <h2 className="font-serif text-lg mb-3 flex items-center gap-2">
                  <i className="fas fa-exclamation-triangle text-primary"></i>
                  Escalation Alerts (Waiting &gt; 6 months)
                </h2>
                <div className="space-y-2">
                  {alerts.slice(0, 5).map(a => (
                    <div key={a.id} className="p-3 bg-sky-mid rounded-lg">
                      <p className="font-medium">{a.patient_name}</p>
                      <p className="text-sm text-text-muted">Appointment: {new Date(a.appointment_date).toLocaleDateString()}</p>
                      <p className="text-xs text-primary">Created: {new Date(a.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-red-500 mt-1">Waiting: {a.waiting_days} days</p>
                    </div>
                  ))}
                  {alerts.length > 5 && (
                    <p className="text-center text-xs text-text-muted">+{alerts.length - 5} more alerts</p>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link to="/admin/users" className="panel hover:border-primary transition-colors text-center">
                <i className="fas fa-user-plus text-3xl text-primary mb-3 block"></i>
                <h3 className="font-medium">Manage Users</h3>
                <p className="text-xs text-text-muted mt-1">Add, edit, or deactivate users</p>
              </Link>
              
              <Link to="/admin/activity" className="panel hover:border-primary transition-colors text-center">
                <i className="fas fa-chart-line text-3xl text-primary mb-3 block"></i>
                <h3 className="font-medium">Activity Logs</h3>
                <p className="text-xs text-text-muted mt-1">View detailed audit trail</p>
              </Link>
              
              <Link to="/admin/settings" className="panel hover:border-primary transition-colors text-center">
                <i className="fas fa-sliders-h text-3xl text-primary mb-3 block"></i>
                <h3 className="font-medium">System Settings</h3>
                <p className="text-xs text-text-muted mt-1">Configure system parameters</p>
              </Link>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="panel">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-serif text-lg">All Users</h2>
              <Link to="/admin/users" className="btn-primary text-sm px-4 py-2">
                <i className="fas fa-user-plus mr-2"></i>
                Manage Users
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left p-2">Omang</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map(u => (
                    <tr key={u.id} className="border-b border-border hover:bg-sky-mid/50">
                      <td className="p-2 font-mono text-xs">{u.omang}</td>
                      <td className="p-2 font-medium">{u.full_name}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${getRoleBadge(u.role)}`}>
                          {u.role === 'head_nurse' ? 'Head Nurse' : u.role}
                        </span>
                      </td>
                      <td className="p-2 text-text-muted">{u.email || '—'}</td>
                      <td className="p-2 text-text-muted">{u.phone || '—'}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          u.status === 'active' 
                            ? 'bg-green-500/20 text-green-500' 
                            : 'bg-red-500/20 text-red-500'
                        }`}>
                          {u.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-center">
              <Link to="/admin/users" className="text-primary text-sm hover:underline">
                View All Users <i className="fas fa-arrow-right ml-1"></i>
              </Link>
            </div>
          </div>
        )}

        {/* Activity Logs Tab */}
        {activeTab === 'activity' && (
          <div className="panel">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-serif text-lg">Recent Activity Logs</h2>
              <Link to="/admin/activity" className="btn-primary text-sm px-4 py-2">
                <i className="fas fa-chart-line mr-2"></i>
                View Full Logs
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left p-2">Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map(log => (
                    <tr key={log.id} className="border-b border-border hover:bg-sky-mid/50">
                      <td className="p-2 text-xs">{new Date(log.performed_at).toLocaleString()}</td>
                      <td className="p-2">
                        <div>
                          <p className="font-medium">{log.user_name}</p>
                          <p className="text-xs text-text-muted">{log.user_role}</p>
                        </div>
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${getActionBadge(log.action_type)}`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className="text-xs">{log.resource_type}</span>
                        {log.resource_id && <span className="text-xs text-text-muted ml-1">#{log.resource_id}</span>}
                      </td>
                      <td className="p-2 text-xs text-text-muted max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details).substring(0, 100) : '—'}
                      </td>
                    </tr>
                  ))}
                  {recentActivity.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-text-muted">
                        No activity logs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-center">
              <Link to="/admin/activity" className="text-primary text-sm hover:underline">
                View All Activity <i className="fas fa-arrow-right ml-1"></i>
              </Link>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="panel">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-serif text-lg">System Settings</h2>
              <Link to="/admin/settings" className="btn-primary text-sm px-4 py-2">
                <i className="fas fa-cog mr-2"></i>
                Configure Settings
              </Link>
            </div>
            <div className="space-y-4">
              <div className="bg-sky-mid rounded-lg p-4">
                <p className="text-text-muted text-sm mb-2">System Configuration</p>
                <p className="text-sm">Manage system parameters, authentication settings, and operational rules.</p>
                <div className="mt-3 flex gap-4 text-xs text-text-muted">
                  <span>✓ Max Login Attempts: 5</span>
                  <span>✓ Session Timeout: 60 min</span>
                  <span>✓ PIN Lock Duration: 30 min</span>
                </div>
              </div>
              <div className="bg-sky-mid rounded-lg p-4">
                <p className="text-text-muted text-sm mb-2">Audit Log Retention</p>
                <p className="text-sm">Activity logs are retained for 90 days before automatic cleanup.</p>
              </div>
              <div className="bg-sky-mid rounded-lg p-4">
                <p className="text-text-muted text-sm mb-2">Email Notifications</p>
                <p className="text-sm">System sends email alerts for PIN resets, appointment confirmations, and referrals.</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Link to="/admin/settings" className="text-primary text-sm hover:underline">
                Configure All Settings <i className="fas fa-arrow-right ml-1"></i>
              </Link>
            </div>
          </div>
        )}

        {/* No-Show Analytics Tab */}
        {activeTab === 'nostats' && (
          <div className="panel">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-serif text-lg mb-0">No-Show Rate Analytics</h2>
              <button
                onClick={handleCheckMissedAppointments}
                disabled={checkingMissed}
                className="bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded text-sm disabled:opacity-50"
              >
                <i className="fas fa-sync-alt mr-1"></i>
                {checkingMissed ? 'Checking...' : 'Check Missed Now'}
              </button>
            </div>
            <NoShowStats />
          </div>
        )}

        {/* Server Logs Tab */}
        {activeTab === 'logs' && (
          <ServerLogs />
        )}

        {/* Terminal Monitor Tab */}
        {activeTab === 'terminal' && (
          <TerminalMonitor />
        )}
      </div>
    </div>
  );
}