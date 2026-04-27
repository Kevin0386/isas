import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const SpecialistDashboard = () => {
  const [activeTab, setActiveTab] = useState('today');
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [pendingReferrals, setPendingReferrals] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today_appointments: 0,
    pending_referrals: 0,
    weekly_appointments: 0,
    monthly_completed: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, todayRes, pendingRes] = await Promise.all([
        axios.get('/api/specialist/dashboard'),
        axios.get('/api/specialist/appointments/today'),
        axios.get('/api/specialist/referrals/pending')
      ]);
      
      setStats(statsRes.data);
      setTodayAppointments(todayRes.data.appointments || []);
      setPendingReferrals(pendingRes.data.referrals || []);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOutcome = async (appointmentId, status, notes, outcomeText) => {
    try {
      await axios.put(`/api/specialist/appointments/${appointmentId}/outcome`, {
        status: status,
        clinical_notes: notes,
        outcome: outcomeText
      });
      
      toast.success(`Appointment marked as ${status}`);
      fetchDashboardData();
      setSelectedAppointment(null);
      setClinicalNotes('');
      setOutcome('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Update failed');
    }
  };

  const handleAcceptReferral = async (referralId, appointmentDate = null) => {
    try {
      await axios.post(`/api/specialist/referrals/${referralId}/accept`, {
        appointment_date: appointmentDate
      });
      toast.success('Referral accepted');
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to accept referral');
    }
  };

  const handleDeclineReferral = async (referralId, reason) => {
    try {
      await axios.post(`/api/specialist/referrals/${referralId}/decline`, { reason });
      toast.success('Referral declined');
      fetchDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to decline referral');
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      emergency: 'bg-red-100 text-red-800',
      urgent: 'bg-yellow-100 text-yellow-800',
      routine: 'bg-green-100 text-green-800'
    };
    return colors[priority] || 'bg-gray-100';
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Specialist Dashboard</h1>
          <p className="text-gray-600">
            Dr. {stats.specialist_name} - {stats.specialty}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Today's Appointments</div>
            <div className="text-2xl font-bold text-blue-600">{stats.today_appointments}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Pending Referrals</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending_referrals}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">This Week</div>
            <div className="text-2xl font-bold text-green-600">{stats.weekly_appointments}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Completed (Month)</div>
            <div className="text-2xl font-bold text-purple-600">{stats.monthly_completed}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'today', label: "Today's Schedule" },
                { id: 'pending', label: 'Pending Referrals' },
                { id: 'week', label: 'Weekly Schedule' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-6 text-sm font-medium ${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Today's Appointments Tab */}
            {activeTab === 'today' && (
              <div>
                {todayAppointments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No appointments scheduled for today</p>
                ) : (
                  <div className="space-y-4">
                    {todayAppointments.map(apt => (
                      <div key={apt.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-bold text-lg">{apt.appointment_time}</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                apt.checked_in ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {apt.checked_in ? 'Checked In' : 'Not Checked In'}
                              </span>
                              {apt.waiting_time && (
                                <span className="text-sm text-orange-600">
                                  Waiting: {apt.waiting_time} min
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-lg">{apt.patient_name}</p>
                            <p className="text-gray-600 text-sm">
                              Age: {apt.patient_age || 'N/A'} | {apt.referral_priority?.toUpperCase()}
                            </p>
                            <p className="text-gray-700 mt-2">{apt.referral_reason}</p>
                          </div>
                          <div className="ml-4">
                            {apt.status === 'scheduled' && apt.checked_in && (
                              <button
                                onClick={() => setSelectedAppointment(apt)}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                              >
                                Start Consultation
                              </button>
                            )}
                            {apt.status === 'in_progress' && (
                              <button
                                onClick={() => setSelectedAppointment(apt)}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pending Referrals Tab */}
            {activeTab === 'pending' && (
              <div>
                {pendingReferrals.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No pending referrals</p>
                ) : (
                  <div className="space-y-4">
                    {pendingReferrals.map(ref => (
                      <div key={ref.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`px-2 py-1 rounded text-xs ${getPriorityBadge(ref.priority)}`}>
                                {ref.priority.toUpperCase()}
                              </span>
                              <span className="text-sm text-gray-500">
                                Waiting: {ref.waiting_days} days
                              </span>
                              <span className="text-sm text-gray-500">
                                Ref: {ref.referral_number}
                              </span>
                            </div>
                            <p className="font-medium">{ref.patient_name}</p>
                            <p className="text-gray-600 text-sm">
                              Age: {ref.patient_age || 'N/A'} | {ref.patient_village || 'Unknown'}
                            </p>
                            <p className="font-medium mt-2">Reason for referral:</p>
                            <p className="text-gray-700">{ref.reason}</p>
                            {ref.clinical_summary && (
                              <>
                                <p className="font-medium mt-2">Clinical Summary:</p>
                                <p className="text-gray-700">{ref.clinical_summary}</p>
                              </>
                            )}
                          </div>
                          <div className="ml-4 flex flex-col gap-2">
                            <button
                              onClick={() => {
                                const date = prompt('Enter appointment date (YYYY-MM-DD HH:MM):');
                                if (date) handleAcceptReferral(ref.id, date);
                                else handleAcceptReferral(ref.id);
                              }}
                              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Reason for declining:');
                                if (reason) handleDeclineReferral(ref.id, reason);
                              }}
                              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Weekly Schedule Tab */}
            {activeTab === 'week' && (
              <div>
                <p className="text-gray-500 text-center py-8">
                  Weekly schedule view coming soon. Use the API endpoint /api/specialist/appointments/week
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Consultation Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold">
                  Consultation: {selectedAppointment.patient_name}
                </h2>
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Clinical Notes</label>
                  <textarea
                    rows={6}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Record clinical findings, diagnosis, treatment plan..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Outcome</label>
                  <textarea
                    rows={3}
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Summary of consultation outcome..."
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleUpdateOutcome(
                      selectedAppointment.id,
                      'completed',
                      clinicalNotes,
                      outcome
                    )}
                    className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                  >
                    Complete Appointment
                  </button>
                  <button
                    onClick={() => handleUpdateOutcome(
                      selectedAppointment.id,
                      'missed',
                      clinicalNotes,
                      'Patient did not attend'
                    )}
                    className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700"
                  >
                    Mark as Missed
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecialistDashboard;