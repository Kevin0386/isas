import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointmentAPI, rescheduleAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function RescheduleRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [reason, setReason] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAppointmentDetails();
  }, [id]);

  const fetchAppointmentDetails = async () => {
    setLoading(true);
    try {
      const response = await appointmentAPI.getPatientAppointments(user?.profile?.id);
      const found = response.data.find(a => a.id === parseInt(id));
      setAppointment(found);
    } catch (error) {
      toast.error('Failed to fetch appointment details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      toast.error('Please provide a reason for rescheduling');
      return;
    }

    setSubmitting(true);
    try {
      await rescheduleAPI.request(id, reason, requestedDate || null);
      toast.success('Reschedule request submitted successfully');
      navigate('/patient');
    } catch (error) {
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-4xl text-primary"></i>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">Appointment not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-serif text-2xl text-white mb-6">Request Reschedule</h1>

      <div className="bg-bg-card backdrop-blur-md border border-border rounded-xl p-6">
        <div className="mb-6 p-4 bg-sky-mid rounded-lg">
          <h2 className="font-medium mb-2">Appointment Details</h2>
          <p className="text-sm text-text-muted">Specialist: {appointment.specialist.name}</p>
          <p className="text-sm text-text-muted">Date: {new Date(appointment.date).toLocaleString()}</p>
          <p className="text-sm text-text-muted">Status: {appointment.status}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">
              Reason for Rescheduling <span className="text-primary">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows="4"
              className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
              placeholder="Please provide a detailed reason for requesting to reschedule..."
              required
            />
          </div>

          <div>
            <label className="block text-text-muted text-sm mb-2">
              Preferred New Date (Optional)
            </label>
            <input
              type="datetime-local"
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
              className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="bg-sky hover:bg-sky-mid text-white px-6 py-3 rounded-lg transition-colors border border-border"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}