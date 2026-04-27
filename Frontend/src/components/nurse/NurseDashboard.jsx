import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import NationalRegistrySearch from './NationalRegistrySearch';
import NonCitizenRegistration from './NonCitizenRegistration';
import AIPriorityReferral from './AIPriorityReferral';
import PatientCheckIn from './PatientCheckIn';

const NurseDashboard = () => {
  const [activeTab, setActiveTab] = useState('search');
  const [stats, setStats] = useState({
    pendingReferrals: 0,
    todayAppointments: 0,
    waitingPatients: 0,
    rescheduleRequests: 0
  });
  const [rescheduleRequests, setRescheduleRequests] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, requestsRes, appointmentsRes] = await Promise.all([
        axios.get('/api/nurse/stats'),
        axios.get('/api/nurse/reschedule-requests'),
        axios.get('/api/nurse/appointments/today')
      ]);
      
      setStats(statsRes.data);
      setRescheduleRequests(requestsRes.data);
      setTodayAppointments(appointmentsRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReschedule = async (requestId, newDate) => {
    try {
      await axios.post(`/api/nurse/reschedule-requests/${requestId}/approve`, { new_date: newDate });
      toast.success('Reschedule request approved');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to approve request');
    }
  };

  const handleDenyReschedule = async (requestId, reason) => {
    try {
      await axios.post(`/api/nurse/reschedule-requests/${requestId}/deny`, { reason });
      toast.success('Reschedule request denied');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to deny request');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Nurse Dashboard</h1>
          <p className="text-gray-600">Manage patient referrals, appointments, and check-ins</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Pending Referrals</div>
            <div className="text-2xl font-bold text-blue-600">{stats.pendingReferrals}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Today's Appointments</div>
            <div className="text-2xl font-bold text-green-600">{stats.todayAppointments}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Waiting Patients</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.waitingPatients}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Reschedule Requests</div>
            <div className="text-2xl font-bold text-purple-600">{stats.rescheduleRequests}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'search', label: 'Registry Search' },
                { id: 'register', label: 'Register Patient' },
                { id: 'referral', label: 'Create Referral' },
                { id: 'checkin', label: 'Check In' },
                { id: 'requests', label: 'Reschedule Requests' },
                { id: 'schedule', label: 'Today\'s Schedule' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-6 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'search' && (
              <NationalRegistrySearch onPatientImported={(id) => {
                toast.success(`Patient imported! ID: ${id}`);
                setActiveTab('referral');
              }} />
            )}
            
            {activeTab === 'register' && (
              <NonCitizenRegistration onSuccess={() => {
                toast.success('Patient registered successfully');
                setActiveTab('referral');
              }} />
            )}
            
            {activeTab === 'referral' && (
              <AIPriorityReferral />
            )}
            
            {activeTab === 'checkin' && (
              <PatientCheckIn />
            )}
            
            {activeTab === 'requests' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Pending Reschedule Requests</h3>
                {rescheduleRequests.length === 0 ? (
                  <p className="text-gray-500">No pending requests</p>
                ) : (
                  <div className="space-y-4">
                    {rescheduleRequests.map(req => (
                      <div key={req.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{req.patient_name}</p>
                            <p className="text-sm text-gray-600">
                              Current: {new Date(req.current_appointment_date).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">
                              Requested: {req.requested_date ? new Date(req.requested_date).toLocaleString() : 'No date specified'}
                            </p>
                            <p className="text-sm mt-2">Reason: {req.reason}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const newDate = prompt('Enter new appointment date (YYYY-MM-DD HH:MM):');
                                if (newDate) handleApproveReschedule(req.id, newDate);
                              }}
                              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Reason for denial:');
                                if (reason) handleDenyReschedule(req.id, reason);
                              }}
                              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'schedule' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Today's Appointments</h3>
                {todayAppointments.length === 0 ? (
                  <p className="text-gray-500">No appointments scheduled for today</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left">Time</th>
                          <th className="px-4 py-2 text-left">Patient</th>
                          <th className="px-4 py-2 text-left">Specialist</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayAppointments.map(apt => (
                          <tr key={apt.id} className="border-t">
                            <td className="px-4 py-2">{new Date(apt.appointment_date).toLocaleTimeString()}</td>
                            <td className="px-4 py-2">{apt.patient_name}</td>
                            <td className="px-4 py-2">{apt.specialist_name}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 rounded text-xs ${
                                apt.status === 'CHECKED_IN' ? 'bg-green-100 text-green-800' :
                                apt.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {apt.status}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              {apt.status === 'SCHEDULED' && (
                                <button
                                  onClick={() => {
                                    setActiveTab('checkin');
                                    // Pre-select this appointment
                                  }}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  Check In
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NurseDashboard;