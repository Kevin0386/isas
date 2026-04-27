import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentAPI, referralAPI } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function SpecialistView() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [pendingReferrals, setPendingReferrals] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecialistData();
  }, [selectedDate]);

  const fetchSpecialistData = async () => {
    try {
      setLoading(true);
      const specialistId = user?.profile?.id;
      
      if (specialistId) {
        const [appsResponse, refsResponse] = await Promise.all([
          appointmentAPI.getSpecialistAppointments(specialistId, { date: selectedDate }),
          referralAPI.getSpecialistReferrals(specialistId, 'pending')
        ]);
        
        setAppointments(appsResponse.data);
        setPendingReferrals(refsResponse.data);
      }
    } catch (error) {
      console.error('Failed to fetch specialist data:', error);
      toast.error('Failed to load your schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOutcome = async (appointmentId, status) => {
    try {
      await appointmentAPI.updateOutcome(appointmentId, status, '', '');
      toast.success(`Appointment marked as ${status}`);
      fetchSpecialistData();
    } catch (error) {
      toast.error('Failed to update appointment');
    }
  };

  const handleCheckIn = async (appointmentId) => {
    try {
      await appointmentAPI.checkIn(appointmentId);
      toast.success('Patient checked in successfully');
      fetchSpecialistData();
    } catch (error) {
      toast.error('Failed to check in patient');
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
      <h1 className="font-serif text-2xl text-white">Specialist Dashboard</h1>

      <div className="panel">
        <div className="flex items-center gap-4">
          <label className="text-text-muted">Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input w-auto"
          />
        </div>
      </div>

      <div className="panel">
        <h2 className="font-serif text-lg mb-4">
          Appointments for {format(new Date(selectedDate), 'MMMM do, yyyy')}
        </h2>
        
        {appointments.length === 0 ? (
          <p className="text-text-muted text-center py-4">No appointments scheduled</p>
        ) : (
          <div className="space-y-3">
            {appointments.map(apt => (
              <div key={apt.id} className="border border-border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-mono text-primary">{apt.time}</span>
                      <span className={`badge ${
                        apt.checked_in ? 'badge-confirmed' : 
                        apt.status === 'scheduled' ? 'badge-pending' : 'badge-missed'
                      }`}>
                        {apt.checked_in ? 'Checked In' : apt.status}
                      </span>
                    </div>
                    
                    <p className="font-medium">{apt.patient.name}</p>
                    <p className="text-sm text-text-muted">Omang: {apt.patient.omang}</p>
                    
                    {apt.referral && (
                      <div className="mt-2 p-2 bg-sky-mid rounded">
                        <p className="text-sm font-medium">Reason for visit:</p>
                        <p className="text-sm text-text-muted">{apt.referral.reason}</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2 mt-3">
                      {!apt.checked_in && apt.status === 'scheduled' && (
                        <button
                          onClick={() => handleCheckIn(apt.id)}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                        >
                          <i className="fas fa-check-circle mr-1"></i>
                          Check In
                        </button>
                      )}
                      {apt.checked_in && apt.status !== 'completed' && (
                        <>
                          <button
                            onClick={() => handleUpdateOutcome(apt.id, 'completed')}
                            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                          >
                            <i className="fas fa-check mr-1"></i>
                            Complete
                          </button>
                          <button
                            onClick={() => handleUpdateOutcome(apt.id, 'missed')}
                            className="text-xs bg-primary text-white px-3 py-1 rounded hover:bg-primary-dark"
                          >
                            <i className="fas fa-times mr-1"></i>
                            Missed
                          </button>
                        </>
                      )}
                      {apt.referral?.letter_available && (
                        <button className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                          <i className="fas fa-file-pdf mr-1"></i>
                          View Letter
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="w-24 text-right">
                    <span className="text-2xl font-mono text-primary">{apt.duration}</span>
                    <span className="text-xs text-text-muted block">minutes</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2 className="font-serif text-lg mb-4">Pending Referrals</h2>
        
        {pendingReferrals.length === 0 ? (
          <p className="text-text-muted text-center py-4">No pending referrals</p>
        ) : (
          <div className="space-y-3">
            {pendingReferrals.map(ref => (
              <div key={ref.id} className="border border-border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{ref.patient.name}</p>
                    <p className="text-sm text-text-muted">Omang: {ref.patient.omang}</p>
                    <p className="text-sm mt-1">{ref.reason}</p>
                    <div className="flex gap-2 mt-2">
                      <span className={`badge ${
                        ref.priority === 'emergency' ? 'badge-missed' :
                        ref.priority === 'urgent' ? 'badge-pending' : 'badge-confirmed'
                      }`}>
                        {ref.priority}
                      </span>
                      {ref.has_letter && (
                        <span className="badge badge-confirmed">
                          <i className="fas fa-file-pdf mr-1"></i>
                          Letter
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="btn-primary text-sm px-3 py-1">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}