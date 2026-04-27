import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({
    action_type: '',
    resource_type: '',
    limit: 100
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
    fetchSummary();
  }, [filters]);

  const fetchLogs = async () => {
    try {
      const res = await adminAPI.getActivityLogs(filters);
      setLogs(res.data);
    } catch (error) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await adminAPI.getActivitySummary();
      setSummary(res.data);
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
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
      <h1 className="font-serif text-2xl text-white">Activity Logs</h1>
      
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="panel">
            <p className="text-text-muted text-sm">Total Activities Today</p>
            <p className="text-3xl font-bold">{summary.total_today}</p>
          </div>
          <div className="panel">
            <p className="text-text-muted text-sm">Most Active User</p>
            <p className="text-lg font-bold">{summary.top_users[0]?.name || 'N/A'}</p>
            <p className="text-xs text-text-muted">{summary.top_users[0]?.count || 0} actions</p>
          </div>
          <div className="panel">
            <p className="text-text-muted text-sm">Top Action Today</p>
            <p className="text-lg font-bold">{summary.by_type[0]?.type || 'N/A'}</p>
            <p className="text-xs text-text-muted">{summary.by_type[0]?.count || 0} times</p>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="panel">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">Action Type</label>
            <select className="select w-full" value={filters.action_type} onChange={e => setFilters({...filters, action_type: e.target.value})}>
              <option value="">All Actions</option>
              <option value="LOGIN">Login</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="APPROVE">Approve</option>
              <option value="REJECT">Reject</option>
              <option value="CHECK_IN">Check In</option>
              <option value="RESET_PIN">Reset PIN</option>
              <option value="CHANGE_PIN">Change PIN</option>
            </select>
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Resource Type</label>
            <select className="select w-full" value={filters.resource_type} onChange={e => setFilters({...filters, resource_type: e.target.value})}>
              <option value="">All Resources</option>
              <option value="user">User</option>
              <option value="patient">Patient</option>
              <option value="referral">Referral</option>
              <option value="appointment">Appointment</option>
              <option value="reschedule">Reschedule</option>
            </select>
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Limit</label>
            <select className="select w-full" value={filters.limit} onChange={e => setFilters({...filters, limit: parseInt(e.target.value)})}>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Logs Table */}
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-left p-2">Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Details</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
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
                <td className="p-2 text-xs font-mono">{log.ip_address || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-8 text-text-muted">
                  No activity logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}