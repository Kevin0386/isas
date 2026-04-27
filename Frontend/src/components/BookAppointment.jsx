import React, { useState, useEffect } from 'react';
import { specialistAPI, appointmentAPI, patientAPI } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function BookAppointment({ patient, onClose, onSuccess }) {
  const [specialists, setSpecialists] = useState([]);
  const [selectedSpecialist, setSelectedSpecialist] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    fetchSpecialists();
  }, []);

  useEffect(() => {
    if (selectedSpecialist && selectedDate) {
      fetchSlots();
    }
  }, [selectedSpecialist, selectedDate]);

  const fetchSpecialists = async () => {
    try {
      const res = await specialistAPI.getAll();
      setSpecialists(res.data);
    } catch (error) {
      toast.error('Failed to load specialists');
    }
  };

  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const res = await specialistAPI.getSlots(selectedSpecialist, selectedDate);
      setSlots(res.data.slots);
    } catch (error) {
      toast.error('Failed to load available slots');
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBook = async () => {
    if (!selectedSpecialist) {
      toast.error('Please select a specialist');
      return;
    }
    if (!selectedSlot) {
      toast.error('Please select a time slot');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please provide a reason for the appointment');
      return;
    }

    setLoading(true);
    try {
      await appointmentAPI.book({
        patient_id: patient.id,
        specialist_id: parseInt(selectedSpecialist),
        appointment_date: selectedSlot.datetime,
        reason: reason,
        duration: 30
      });
      toast.success('Appointment booked successfully');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const availableCount = slots.filter(s => s.available).length;
  const takenCount = slots.filter(s => s.taken).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="font-serif text-xl text-white">Book Appointment for {patient.name}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Specialist selection */}
          <div>
            <label className="block text-text-muted text-sm mb-2">Select Specialist</label>
            <select
              value={selectedSpecialist}
              onChange={(e) => setSelectedSpecialist(e.target.value)}
              className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white"
            >
              <option value="">Choose a specialist...</option>
              {specialists.map(spec => (
                <option key={spec.id} value={spec.id}>
                  Dr. {spec.name} - {spec.specialty}
                </option>
              ))}
            </select>
          </div>

          {/* Date picker */}
          <div>
            <label className="block text-text-muted text-sm mb-2">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white"
            />
          </div>

          {/* Slots display */}
          {selectedSpecialist && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-text-muted text-sm">Available Time Slots</label>
                <div className="text-xs">
                  <span className="text-green-500">Available: {availableCount}</span>
                  {' | '}
                  <span className="text-primary">Taken: {takenCount}</span>
                </div>
              </div>

              {loadingSlots ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-2xl text-primary"></i>
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8 text-text-muted">
                  No working hours on this day
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2">
                  {slots.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => slot.available && setSelectedSlot(slot)}
                      disabled={!slot.available}
                      className={`
                        py-2 px-3 rounded-lg text-sm font-medium transition-all
                        ${slot.available 
                          ? selectedSlot?.time === slot.time
                            ? 'bg-primary text-white'
                            : 'bg-green-600/20 text-green-500 hover:bg-green-600/30 border border-green-500/30'
                          : 'bg-primary/20 text-text-muted cursor-not-allowed line-through'
                        }
                      `}
                    >
                      {slot.time}
                      {slot.taken && <span className="ml-1 text-xs">🔒</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-text-muted text-sm mb-2">Reason for Appointment</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows="3"
              className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white"
              placeholder="e.g., Follow-up, Chest pain, etc."
              required
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={onClose} className="bg-sky hover:bg-sky-mid text-white px-4 py-2 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleBook}
              disabled={loading || !selectedSpecialist || !selectedSlot}
              className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? <><i className="fas fa-spinner fa-spin mr-2"></i>Booking...</> : 'Confirm Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}