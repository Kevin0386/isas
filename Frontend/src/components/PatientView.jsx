import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentAPI, referralAPI } from '../services/api';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ChangePin from './ChangePin';

export default function PatientView() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChangePin, setShowChangePin] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);

  useEffect(() => {
    fetchPatientData();
  }, []);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const patientId = user?.profile?.id;
      if (patientId) {
        const [appsResponse, refsResponse] = await Promise.all([
          appointmentAPI.getPatientAppointments(patientId),
          referralAPI.getPatientReferrals(patientId)
        ]);
        setAppointments(appsResponse.data);
        setReferrals(refsResponse.data);
      }
    } catch (error) {
      console.error('Failed to fetch patient data:', error);
      toast.error('Failed to load your data');
    } finally {
      setLoading(false);
    }
  };

  const handleAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
    setShowAppointmentModal(true);
  };

  const handleReferralClick = (referral) => {
    setSelectedReferral(referral);
    setShowReferralModal(true);
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'scheduled':
        return <span className="badge badge-pending">Scheduled</span>;
      case 'confirmed':
        return <span className="badge badge-confirmed">Confirmed</span>;
      case 'completed':
        return <span className="badge badge-confirmed">Completed</span>;
      case 'missed':
        return <span className="badge badge-missed">Missed</span>;
      case 'cancelled':
        return <span className="badge badge-missed">Cancelled</span>;
      default:
        return <span className="badge badge-pending">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-4xl text-primary"></i>
      </div>
    );
  }

  const upcomingAppointments = appointments.filter(a => a.status === 'scheduled');
  const pastAppointments = appointments.filter(a => a.status !== 'scheduled');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-serif text-2xl text-white">My Appointments</h1>
        <button
          onClick={() => setShowChangePin(true)}
          className="bg-sky hover:bg-sky-mid text-white px-4 py-2 rounded-lg transition-colors"
        >
          <i className="fas fa-key mr-2"></i>
          Change PIN
        </button>
      </div>

      {/* Upcoming Appointments */}
      <div className="panel">
        <h2 className="font-serif text-lg mb-4">Upcoming Appointments</h2>
        {upcomingAppointments.length === 0 ? (
          <p className="text-text-muted text-center py-4">No upcoming appointments</p>
        ) : (
          <div className="space-y-3">
            {upcomingAppointments.map(app => (
              <div 
                key={app.id} 
                onClick={() => handleAppointmentClick(app)}
                className="border border-border rounded-lg p-4 hover:border-primary cursor-pointer transition-all hover:shadow-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{app.specialist.name}</p>
                    <p className="text-sm text-text-muted">{app.specialist.specialty}</p>
                    <p className="text-sm mt-2">
                      <i className="fas fa-calendar mr-2 text-primary"></i>
                      {format(new Date(app.date), 'EEEE, MMMM do, yyyy')}
                    </p>
                    <p className="text-sm">
                      <i className="fas fa-clock mr-2 text-primary"></i>
                      {format(new Date(app.date), 'h:mm a')} ({app.duration} min)
                    </p>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(app.status)}
                    {app.checked_in && (
                      <p className="text-xs text-green-500 mt-1">
                        <i className="fas fa-check-circle mr-1"></i>Checked In
                      </p>
                    )}
                  </div>
                </div>
                {app.can_reschedule && (
                  <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                    <Link to={`/reschedule/${app.id}`} className="text-sm text-primary hover:underline">
                      <i className="fas fa-calendar-alt mr-1"></i> Request Reschedule
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Appointments */}
      <div className="panel">
        <h2 className="font-serif text-lg mb-4">Past Appointments</h2>
        {pastAppointments.length === 0 ? (
          <p className="text-text-muted text-center py-4">No past appointments</p>
        ) : (
          <div className="space-y-3">
            {pastAppointments.map(app => (
              <div 
                key={app.id} 
                onClick={() => handleAppointmentClick(app)}
                className="border border-border rounded-lg p-4 hover:border-primary cursor-pointer transition-all hover:shadow-lg opacity-75"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{app.specialist.name}</p>
                    <p className="text-sm text-text-muted">{app.specialist.specialty}</p>
                    <p className="text-sm mt-2">
                      {format(new Date(app.date), 'MMM do, yyyy')} at {format(new Date(app.date), 'h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(app.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Referrals */}
      <div className="panel">
        <h2 className="font-serif text-lg mb-4">My Referrals</h2>
        {referrals.length === 0 ? (
          <p className="text-text-muted text-center py-4">No referrals found</p>
        ) : (
          <div className="space-y-3">
            {referrals.slice(0, 5).map(ref => (
              <div 
                key={ref.id} 
                onClick={() => handleReferralClick(ref)}
                className="border border-border rounded-lg p-4 hover:border-primary cursor-pointer transition-all hover:shadow-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-text-muted">Referral #{ref.referral_number}</p>
                    <p className="mt-1">Referred to: <span className="font-medium">{ref.referred_to}</span></p>
                    {ref.specialist && (
                      <p className="text-sm">Specialist: {ref.specialist.name} ({ref.specialist.specialty})</p>
                    )}
                    {ref.created_by_nurse && (
                      <p className="text-xs text-text-muted mt-1">
                        <i className="fas fa-user-nurse mr-1"></i>
                        Created by: {ref.created_by_nurse.name} ({ref.created_by_nurse.department})
                      </p>
                    )}
                    <p className="text-xs text-text-muted">
                      Date: {format(new Date(ref.date), 'MMM do, yyyy')}
                    </p>
                  </div>
                  <div>
                    <span className={`badge ${
                      ref.status === 'completed' ? 'badge-confirmed' : 
                      ref.status === 'scheduled' ? 'badge-confirmed' : 
                      ref.status === 'pending' ? 'badge-pending' : 'badge-missed'
                    }`}>
                      {ref.status}
                    </span>
                    <p className="text-xs text-text-muted mt-1 capitalize">
                      Priority: {ref.priority}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointment Details Modal */}
      {showAppointmentModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="font-serif text-xl text-white">Appointment Details</h2>
              <button onClick={() => setShowAppointmentModal(false)} className="text-text-muted hover:text-white">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-sky-mid rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                    <i className="fas fa-user-md text-primary text-xl"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{selectedAppointment.specialist.name}</h3>
                    <p className="text-text-muted">{selectedAppointment.specialist.specialty}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                  <i className="fas fa-calendar text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Date</p>
                    <p className="font-medium">{format(new Date(selectedAppointment.date), 'EEEE, MMMM do, yyyy')}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                  <i className="fas fa-clock text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Time</p>
                    <p className="font-medium">{format(new Date(selectedAppointment.date), 'h:mm a')} ({selectedAppointment.duration} minutes)</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                  <i className="fas fa-hashtag text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Appointment Number</p>
                    <p className="font-mono text-sm">{selectedAppointment.appointment_number}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                  <i className="fas fa-info-circle text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Status</p>
                    {getStatusBadge(selectedAppointment.status)}
                  </div>
                </div>
              </div>
              
              {selectedAppointment.can_reschedule && (
                <div className="pt-4">
                  <Link 
                    to={`/reschedule/${selectedAppointment.id}`}
                    onClick={() => setShowAppointmentModal(false)}
                    className="w-full btn-primary text-center inline-block py-2"
                  >
                    <i className="fas fa-calendar-alt mr-2"></i>
                    Request Reschedule
                  </Link>
                </div>
              )}
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
                  <i className="fas fa-hospital text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Referred To</p>
                    <p className="font-medium">{selectedReferral.referred_to}</p>
                  </div>
                </div>
                
                {selectedReferral.specialist && (
                  <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                    <i className="fas fa-user-md text-primary w-6"></i>
                    <div>
                      <p className="text-sm text-text-muted">Assigned Specialist</p>
                      <p className="font-medium">{selectedReferral.specialist.name}</p>
                      <p className="text-xs text-text-muted">{selectedReferral.specialist.specialty}</p>
                    </div>
                  </div>
                )}
                
                {selectedReferral.created_by_nurse && (
                  <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                    <i className="fas fa-user-nurse text-primary w-6"></i>
                    <div>
                      <p className="text-sm text-text-muted">Created By</p>
                      <p className="font-medium">{selectedReferral.created_by_nurse.name}</p>
                      <p className="text-xs text-text-muted">{selectedReferral.created_by_nurse.department}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                  <i className="fas fa-flag text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Priority</p>
                    <p className={`font-medium capitalize ${
                      selectedReferral.priority === 'emergency' ? 'text-primary' :
                      selectedReferral.priority === 'urgent' ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                      {selectedReferral.priority}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                  <i className="fas fa-calendar text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Referral Date</p>
                    <p>{format(new Date(selectedReferral.date), 'MMMM do, yyyy')}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-sky-mid rounded-lg">
                  <i className="fas fa-info-circle text-primary w-6"></i>
                  <div>
                    <p className="text-sm text-text-muted">Status</p>
                    <span className={`badge ${
                      selectedReferral.status === 'completed' ? 'badge-confirmed' : 
                      selectedReferral.status === 'scheduled' ? 'badge-confirmed' : 
                      selectedReferral.status === 'pending' ? 'badge-pending' : 'badge-missed'
                    }`}>
                      {selectedReferral.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showChangePin && (
        <ChangePin
          onClose={() => setShowChangePin(false)}
          onSuccess={() => {
            setShowChangePin(false);
          }}
        />
      )}
    </div>
  );
}