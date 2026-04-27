import React, { useState, useEffect } from 'react';
import { patientAPI, facilityAPI, specialistAPI, referralAPI, appointmentAPI, rescheduleAPI } from '../services/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import BookAppointment from './BookAppointment';

export default function NurseView() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedPatientForBooking, setSelectedPatientForBooking] = useState(null);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [validationSuggestions, setValidationSuggestions] = useState([]);
  const [suggestedPriority, setSuggestedPriority] = useState('');
  const [departmentReferrals, setDepartmentReferrals] = useState([]);
  const [weeklyAppointments, setWeeklyAppointments] = useState([]);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [referralForm, setReferralForm] = useState({
    referring_facility_id: '',
    referred_to_facility_id: '',
    specialist_id: '',
    reason: '',
    clinical_summary: '',
    diagnosis: '',
    priority: 'routine'
  });

  useEffect(() => {
    fetchFacilities();
    fetchSpecialists();
    fetchTodayAppointments();
    fetchPendingRequests();
    fetchDepartmentReferrals();
    fetchWeeklyAppointments();
  }, []);

  const fetchFacilities = async () => {
    try {
      const response = await facilityAPI.getAll();
      setFacilities(response.data);
    } catch (error) {
      toast.error('Failed to load facilities');
    }
  };

  const fetchSpecialists = async () => {
    try {
      const response = await specialistAPI.getAll();
      setSpecialists(response.data);
    } catch (error) {
      toast.error('Failed to load specialists');
    }
  };

  const fetchTodayAppointments = async () => {
    try {
      const response = await appointmentAPI.getTodayAppointments();
      setTodayAppointments(response.data);
    } catch (error) {
      console.error('Failed to fetch today\'s appointments:', error);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await rescheduleAPI.getPending();
      setPendingRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
    }
  };

  const fetchDepartmentReferrals = async () => {
    try {
      const response = await referralAPI.getTracker();
      setDepartmentReferrals(response.data);
    } catch (error) {
      console.error('Failed to fetch department referrals:', error);
    }
  };

  const fetchWeeklyAppointments = async () => {
    try {
      // Get start of week (Monday)
      const today = new Date();
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startOfWeek.setDate(today.getDate() - daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      // Get end of week (Sunday)
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      const startDateStr = startOfWeek.toISOString().split('T')[0];
      const endDateStr = endOfWeek.toISOString().split('T')[0];
      
      console.log('Fetching appointments from', startDateStr, 'to', endDateStr);
      
      const response = await appointmentAPI.getAppointmentsByDateRange(startDateStr, endDateStr);
      console.log('Received appointments:', response.data);
      setWeeklyAppointments(response.data);
    } catch (error) {
      console.error('Failed to fetch weekly appointments:', error);
      toast.error('Failed to load weekly schedule');
      setWeeklyAppointments([]);
    }
  };

  const searchPatients = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }
    setLoading(true);
    try {
      const response = await patientAPI.search(searchQuery);
      setPatients(response.data);
      if (response.data.length === 0) {
        toast('No patients found');
      }
    } catch (error) {
      toast.error('Failed to search patients');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (appointmentId) => {
    try {
      await appointmentAPI.checkIn(appointmentId);
      toast.success('Patient checked in successfully');
      fetchTodayAppointments();
      fetchWeeklyAppointments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Check-in failed');
    }
  };

  const handleApproveRequest = async (requestId, action, newDate = null) => {
    try {
      await rescheduleAPI.approve(requestId, action, 'Reviewed by nurse', newDate);
      toast.success(`Request ${action}ed`);
      fetchPendingRequests();
    } catch (error) {
      toast.error('Failed to update request');
    }
  };

  const validateReferralData = async (reason, specialty, priority) => {
    try {
      const res = await referralAPI.validateReferral({ reason, specialty, priority });
      setValidationWarnings(res.data.warnings);
      setValidationSuggestions(res.data.suggestions);
      return res.data.valid;
    } catch (error) {
      return true;
    }
  };

  const getSuggestedPriority = async (reason, diagnosis) => {
    try {
      const res = await referralAPI.suggestPriority({ reason, diagnosis });
      setSuggestedPriority(res.data.suggested_priority);
    } catch (error) {}
  };

  const handleCreateReferral = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!referralForm.reason) {
      toast.error('Please provide a reason for referral');
      return;
    }
    if (!referralForm.referring_facility_id || !referralForm.referred_to_facility_id) {
      toast.error('Please select both referring and referred facilities');
      return;
    }

    const isValid = await validateReferralData(
      referralForm.reason,
      referralForm.specialist_id ? specialists.find(s => s.id == referralForm.specialist_id)?.specialty : '',
      referralForm.priority
    );
    if (!isValid) {
      toast.error('Please address the warnings before proceeding.');
      return;
    }

    setSubmitting(true);
    const referralData = {
      patient_id: selectedPatient.id,
      referring_facility_id: parseInt(referralForm.referring_facility_id, 10),
      referred_to_facility_id: parseInt(referralForm.referred_to_facility_id, 10),
      specialist_id: referralForm.specialist_id ? parseInt(referralForm.specialist_id, 10) : null,
      reason: referralForm.reason,
      clinical_summary: referralForm.clinical_summary || '',
      diagnosis: referralForm.diagnosis || '',
      priority: referralForm.priority
    };

    try {
      await referralAPI.create(referralData);
      toast.success('Referral created successfully');
      setSelectedPatient(null);
      setReferralForm({
        referring_facility_id: '',
        referred_to_facility_id: '',
        specialist_id: '',
        reason: '',
        clinical_summary: '',
        diagnosis: '',
        priority: 'routine'
      });
      setValidationWarnings([]);
      setValidationSuggestions([]);
      setSuggestedPriority('');
      setPatients([]);
      setSearchQuery('');
      fetchDepartmentReferrals();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create referral');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPin = async (patientId, patientName) => {
    try {
      const response = await patientAPI.resetPin(patientId);
      toast.success(
        <div>
          <p className="font-bold">PIN reset for {patientName}</p>
          <p className="text-lg font-mono mt-1">New PIN: {response.data.new_pin}</p>
          <p className="text-xs mt-2">Please provide this to the patient.</p>
        </div>,
        { duration: 10000 }
      );
    } catch (error) {
      toast.error('Failed to reset PIN');
    }
  };

  const handleReferralClick = (referral) => {
    setSelectedReferral(referral);
    setShowReferralModal(true);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchPatients();
    }
  };

  const getPriorityBadge = (priority) => {
    switch(priority) {
      case 'emergency':
        return <span className="badge badge-missed">⚠️ Emergency</span>;
      case 'urgent':
        return <span className="badge badge-pending">🔴 Urgent</span>;
      default:
        return <span className="badge badge-confirmed">🟢 Routine</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'completed':
        return <span className="badge badge-confirmed">✓ Completed</span>;
      case 'assigned':
        return <span className="badge badge-confirmed">📋 Assigned</span>;
      case 'pending':
        return <span className="badge badge-pending">⏳ Pending</span>;
      case 'cancelled':
        return <span className="badge badge-missed">✗ Cancelled</span>;
      default:
        return <span className="badge badge-pending">{status}</span>;
    }
  };

  // Group appointments by date
  const getAppointmentsByDate = () => {
    const grouped = {};
    weeklyAppointments.forEach(apt => {
      const dateKey = apt.date.split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(apt);
    });
    return grouped;
  };

  // Get weekly stats from fetched appointments
  const getWeeklyStats = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const today = new Date();
    const startOfWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(today.getDate() - daysToMonday);
    
    const appointmentsByDate = getAppointmentsByDate();
    
    return days.map((day, index) => {
      const targetDate = new Date(startOfWeek);
      targetDate.setDate(startOfWeek.getDate() + index);
      const dateStr = targetDate.toISOString().split('T')[0];
      
      const dayAppointments = appointmentsByDate[dateStr] || [];
      const scheduled = dayAppointments.filter(a => a.status === 'scheduled').length;
      const completed = dayAppointments.filter(a => a.status === 'completed').length;
      const checkedIn = dayAppointments.filter(a => a.checked_in).length;
      
      return {
        day,
        date: dateStr,
        displayDate: targetDate.toLocaleDateString('en-BW', { month: 'short', day: 'numeric' }),
        total: dayAppointments.length,
        scheduled,
        completed,
        checkedIn,
        appointments: dayAppointments.slice(0, 3)
      };
    });
  };

  const weeklyStats = getWeeklyStats();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-serif text-2xl text-white">Head Nurse Station</h1>
        <Link to="/register-non-citizen" className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-colors">
          <i className="fas fa-passport mr-2"></i>
          Register Non-Citizen
        </Link>
      </div>

      {/* Department Schedule - Today's Appointments */}
      <div className="panel">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-lg">📅 Today's Schedule</h2>
          <div className="flex items-center gap-2">
            <i className="fas fa-calendar-day text-primary"></i>
            <span className="text-sm text-text-muted">
              {new Date().toLocaleDateString('en-BW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
        {todayAppointments.length === 0 ? (
          <div className="text-center py-8">
            <i className="fas fa-calendar-check text-4xl text-text-muted mb-3"></i>
            <p className="text-text-muted">No appointments scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayAppointments.map((apt) => (
              <div key={apt.id} className="flex items-center justify-between p-3 bg-sky-mid rounded-lg hover:bg-sky-deep transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-20 text-center">
                    <p className="text-lg font-mono text-primary">{apt.time}</p>
                  </div>
                  <div>
                    <p className="font-medium">{apt.patient_name}</p>
                    <p className="text-xs text-text-muted">
                      <i className="fas fa-hashtag mr-1"></i>Appointment #{apt.id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${apt.checked_in ? 'badge-confirmed' : 'badge-pending'}`}>
                    {apt.checked_in ? '✓ Checked In' : apt.status}
                  </span>
                  {!apt.checked_in && apt.status === 'scheduled' && (
                    <button onClick={() => handleCheckIn(apt.id)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                      <i className="fas fa-check-circle mr-1"></i> Check In
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Schedule Overview */}
      <div className="panel">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-lg">📊 Weekly Schedule Overview</h2>
          <button onClick={fetchWeeklyAppointments} className="text-primary text-sm hover:underline">
            <i className="fas fa-sync-alt mr-1"></i> Refresh
          </button>
        </div>
        <div className="grid grid-cols-7 gap-3">
          {weeklyStats.map((day, idx) => (
            <div key={idx} className="bg-sky-mid rounded-lg overflow-hidden">
              <div className="p-3 text-center border-b border-border">
                <p className="font-bold text-primary">{day.day}</p>
                <p className="text-xs text-text-muted">{day.displayDate}</p>
              </div>
              <div className="p-3">
                <div className="text-center mb-2">
                  <p className="text-2xl font-bold">{day.total}</p>
                  <p className="text-xs text-text-muted">Total Appointments</p>
                </div>
                {day.total > 0 ? (
                  <>
                    <div className="flex justify-around text-xs border-t border-border pt-2">
                      <div className="text-center">
                        <p className="text-yellow-500 font-medium">{day.scheduled}</p>
                        <p className="text-text-muted">Scheduled</p>
                      </div>
                      <div className="text-center">
                        <p className="text-blue-500 font-medium">{day.checkedIn}</p>
                        <p className="text-text-muted">Checked In</p>
                      </div>
                      <div className="text-center">
                        <p className="text-green-500 font-medium">{day.completed}</p>
                        <p className="text-text-muted">Completed</p>
                      </div>
                    </div>
                    {day.appointments.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-text-muted mb-1">Appointments:</p>
                        {day.appointments.map(apt => (
                          <div key={apt.id} className="text-xs py-1 flex justify-between">
                            <span className="text-primary">{apt.time}</span>
                            <span className="text-text-muted truncate ml-1">{apt.patient?.name?.split(' ')[0] || 'Patient'}</span>
                          </div>
                        ))}
                        {day.appointments.length === 3 && day.total > 3 && (
                          <p className="text-xs text-text-muted mt-1 text-center">+{day.total - 3} more</p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <i className="fas fa-calendar-week text-text-muted text-2xl mb-1"></i>
                    <p className="text-xs text-text-muted">No appointments</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Reschedule Requests */}
      {pendingRequests.length > 0 && (
        <div className="panel">
          <h2 className="font-serif text-lg mb-4">⏰ Pending Reschedule Requests</h2>
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div key={req.id} className="p-3 bg-sky-mid rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{req.patient_name}</p>
                    <p className="text-sm text-text-muted">Reason: {req.reason}</p>
                    <p className="text-xs text-text-muted mt-1">
                      Requested: {req.requested_date ? new Date(req.requested_date).toLocaleString() : 'No preferred date'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApproveRequest(req.id, 'approve')} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                      <i className="fas fa-check mr-1"></i> Approve
                    </button>
                    <button onClick={() => handleApproveRequest(req.id, 'deny')} className="bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded text-sm">
                      <i className="fas fa-times mr-1"></i> Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Department Referrals */}
      <div className="panel">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-lg">📋 All Department Referrals</h2>
          <button onClick={fetchDepartmentReferrals} className="text-primary text-sm hover:underline">
            <i className="fas fa-sync-alt mr-1"></i> Refresh
          </button>
        </div>
        {departmentReferrals.length === 0 ? (
          <p className="text-text-muted text-center py-4">No referrals found in this department</p>
        ) : (
          <div className="space-y-3">
            {departmentReferrals.map(ref => (
              <div 
                key={ref.id} 
                onClick={() => handleReferralClick(ref)}
                className="border border-border rounded-lg p-4 hover:border-primary cursor-pointer transition-all hover:shadow-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{ref.patient_name}</p>
                    <p className="text-sm text-text-muted">Referral #{ref.referral_number}</p>
                    <p className="text-sm mt-1">
                      <i className="fas fa-user-md mr-1 text-primary"></i>
                      Specialist: {ref.specialist || 'Not yet assigned'}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Created: {new Date(ref.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {getPriorityBadge(ref.priority)}
                    <div className="mt-2">
                      {getStatusBadge(ref.status)}
                    </div>
                    {ref.waiting_days && (
                      <p className="text-xs text-primary mt-1">Waiting: {ref.waiting_days} days</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search Patient Section */}
      <div className="panel">
        <h2 className="font-serif text-lg mb-4">🔍 Search & Register Patient</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter Omang number or patient name..."
            className="flex-1 bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
          />
          <button onClick={searchPatients} className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50" disabled={loading}>
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-search mr-2"></i>Search</>}
          </button>
        </div>

        {patients.length > 0 ? (
          <div className="mt-4 border border-border rounded-lg overflow-hidden">
            {patients.map(patient => (
              <div
                key={patient.id}
                className={`p-4 border-b last:border-b-0 border-border ${selectedPatient?.id === patient.id ? 'bg-primary/10' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <div onClick={() => setSelectedPatient(patient)} className="flex-1 cursor-pointer">
                    <p className="font-medium">{patient.name}</p>
                    <p className="text-sm text-text-muted">
                      {patient.source === 'national' ? '🇧🇼 National Registry' : 'Local'} · Omang: {patient.omang} · {patient.village || 'No village'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResetPin(patient.id, patient.name)}
                      className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded"
                    >
                      <i className="fas fa-key mr-1"></i> Reset PIN
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPatientForBooking(patient);
                        setShowBookingModal(true);
                      }}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                    >
                      <i className="fas fa-calendar-plus mr-1"></i> Book Appointment
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery && !loading ? (
          <div className="mt-4 p-6 text-center bg-sky-mid rounded-lg border border-border">
            <i className="fas fa-user-slash text-4xl text-text-muted mb-2"></i>
            <p className="text-text-muted mb-3">No patient found with "{searchQuery}"</p>
            <button onClick={() => window.location.href = `/register-non-citizen?passport=${encodeURIComponent(searchQuery)}`} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-colors">
              <i className="fas fa-passport mr-2"></i> Register Non-Citizen
            </button>
          </div>
        ) : null}
      </div>

      {/* Referral Form */}
      {selectedPatient && (
        <div className="panel">
          <h2 className="font-serif text-lg mb-4">📝 New Referral for {selectedPatient.name}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-text-muted text-sm mb-2">Referring Facility *</label>
                <select value={referralForm.referring_facility_id} onChange={(e) => setReferralForm({...referralForm, referring_facility_id: e.target.value})} className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary" required>
                  <option value="">Select facility</option>
                  {facilities.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-text-muted text-sm mb-2">Referred To *</label>
                <select value={referralForm.referred_to_facility_id} onChange={(e) => setReferralForm({...referralForm, referred_to_facility_id: e.target.value})} className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary" required>
                  <option value="">Select facility</option>
                  {facilities.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-text-muted text-sm mb-2">Assign Specialist (Optional)</label>
              <select value={referralForm.specialist_id} onChange={(e) => setReferralForm({...referralForm, specialist_id: e.target.value})} className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary">
                <option value="">Assign later</option>
                {specialists.map(s => (<option key={s.id} value={s.id}>Dr. {s.name} - {s.specialty}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-text-muted text-sm mb-2">Priority</label>
              <select value={referralForm.priority} onChange={(e) => setReferralForm({...referralForm, priority: e.target.value})} className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary">
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            {suggestedPriority && (
              <div className="p-2 bg-blue-bg rounded-lg text-sm">
                <i className="fas fa-robot mr-2 text-blue-500"></i>
                AI suggests: <strong className="text-primary">{suggestedPriority.toUpperCase()}</strong> priority
              </div>
            )}
            {validationWarnings.length > 0 && (
              <div className="p-2 bg-red-bg rounded-lg text-sm">
                <p className="font-medium text-primary">⚠️ Please address:</p>
                <ul className="list-disc list-inside text-text-muted">
                  {validationWarnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            {validationSuggestions.length > 0 && (
              <div className="p-2 bg-yellow-bg rounded-lg text-sm">
                <p className="font-medium text-yellow">💡 Suggestions:</p>
                <ul className="list-disc list-inside text-text-muted">
                  {validationSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            <div>
              <label className="block text-text-muted text-sm mb-2">Reason for Referral *</label>
              <textarea value={referralForm.reason} onChange={(e) => setReferralForm({...referralForm, reason: e.target.value})} rows="3" className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary" placeholder="Clinical reason for referral..." required />
            </div>
            <div>
              <label className="block text-text-muted text-sm mb-2">Clinical Summary (Optional)</label>
              <textarea value={referralForm.clinical_summary} onChange={(e) => setReferralForm({...referralForm, clinical_summary: e.target.value})} rows="2" className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary" placeholder="Brief clinical summary..." />
            </div>
            <div>
              <label className="block text-text-muted text-sm mb-2">Diagnosis (Optional)</label>
              <input type="text" value={referralForm.diagnosis} onChange={(e) => setReferralForm({...referralForm, diagnosis: e.target.value})} className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary" placeholder="Working diagnosis..." />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setSelectedPatient(null)} className="bg-sky hover:bg-sky-mid text-white px-4 py-2 rounded-lg transition-colors border border-border" disabled={submitting}>Cancel</button>
              <button onClick={handleCreateReferral} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50" disabled={submitting}>
                {submitting ? <><i className="fas fa-spinner fa-spin mr-2"></i>Creating...</> : 'Create Referral'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Referral Details Modal */}
      {showReferralModal && selectedReferral && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="font-serif text-xl text-white">Referral Details</h2>
              <button onClick={() => setShowReferralModal(false)} className="text-text-muted hover:text-white">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-sky-mid rounded-lg p-4">
                <p className="text-sm text-text-muted">Referral Number</p>
                <p className="font-mono text-lg">{selectedReferral.referral_number}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                  <i className="fas fa-user text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Patient</p>
                    <p className="font-medium">{selectedReferral.patient_name}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                  <i className="fas fa-flag text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Priority</p>
                    {getPriorityBadge(selectedReferral.priority)}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                  <i className="fas fa-info-circle text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Status</p>
                    {getStatusBadge(selectedReferral.status)}
                  </div>
                </div>
                
                {selectedReferral.specialist && (
                  <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                    <i className="fas fa-user-md text-primary w-6"></i>
                    <div>
                      <p className="text-sm text-text-muted">Assigned Specialist</p>
                      <p className="font-medium">{selectedReferral.specialist}</p>
                    </div>
                  </div>
                )}
                
                {selectedReferral.appointment_date && (
                  <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                    <i className="fas fa-calendar-check text-primary w-6"></i>
                    <div>
                      <p className="text-sm text-text-muted">Appointment Date</p>
                      <p>{new Date(selectedReferral.appointment_date).toLocaleString()}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                  <i className="fas fa-calendar text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Created At</p>
                    <p>{new Date(selectedReferral.created_at).toLocaleString()}</p>
                  </div>
                </div>
                
                {selectedReferral.waiting_days && (
                  <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                    <i className="fas fa-hourglass-half text-primary w-6"></i>
                    <div>
                      <p className="text-sm text-text-muted">Waiting Days</p>
                      <p className="font-medium">{selectedReferral.waiting_days} days</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && selectedPatientForBooking && (
        <BookAppointment
          patient={selectedPatientForBooking}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedPatientForBooking(null);
          }}
          onSuccess={() => {
            fetchTodayAppointments();
            fetchDepartmentReferrals();
            fetchWeeklyAppointments();
            setShowBookingModal(false);
            setSelectedPatientForBooking(null);
          }}
        />
      )}
    </div>
  );
}