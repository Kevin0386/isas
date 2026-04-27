import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { specialistAPI, appointmentAPI } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Schedules() {
  const { user, isSpecialist, isNurse, isAdmin } = useAuth();
  const [specialists, setSpecialists] = useState([]);
  const [selectedSpecialist, setSelectedSpecialist] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [availableSlots, setAvailableSlots] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // For specialists: automatically set the specialist ID from profile
  useEffect(() => {
    if (isSpecialist && user?.profile?.id) {
      setSelectedSpecialist(user.profile.id);
    }
  }, [isSpecialist, user]);

  // Fetch specialists for nurse/admin dropdown
  useEffect(() => {
    if (isNurse || isAdmin) {
      fetchSpecialists();
    }
  }, [isNurse, isAdmin]);

  // When selectedSpecialist changes or date changes, fetch schedule & appointments
  useEffect(() => {
    if (selectedSpecialist) {
      fetchSpecialistData();
      fetchAvailableSlotsCount();
    }
  }, [selectedSpecialist, selectedDate]);

  const fetchSpecialists = async () => {
    try {
      const response = await specialistAPI.getAll();
      setSpecialists(response.data);
      if (response.data.length > 0 && !selectedSpecialist) {
        setSelectedSpecialist(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch specialists:', error);
      toast.error('Failed to load specialists');
    }
  };

  const fetchSpecialistData = async () => {
    if (!selectedSpecialist) return;

    setLoading(true);
    try {
      const [scheduleResponse, appointmentsResponse] = await Promise.all([
        specialistAPI.getSchedule(selectedSpecialist),
        appointmentAPI.getSpecialistAppointments(selectedSpecialist, { date: selectedDate })
      ]);
      setSchedule(scheduleResponse.data);
      setAppointments(appointmentsResponse.data);
    } catch (error) {
      console.error('Failed to fetch specialist data:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSlotsCount = async () => {
    if (!selectedSpecialist) return;
    
    setLoadingSlots(true);
    try {
      const response = await specialistAPI.getAvailableSlotsCount(selectedSpecialist, selectedDate);
      setAvailableSlots(response.data);
    } catch (error) {
      console.error('Failed to fetch available slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Get available slots for a specific day
  const getDayAvailableSlots = (dayOfWeek) => {
    const daySchedule = schedule.find(s => s.day_of_week === dayOfWeek);
    if (!daySchedule) return null;
    
    // For today's date, show dynamic slots
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + dayOfWeek);
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    
    // If this is the selected date, show dynamic available slots
    if (dateStr === selectedDate && availableSlots.available_slots !== undefined) {
      return {
        ...daySchedule,
        dynamicAvailable: availableSlots.available_slots,
        dynamicBooked: availableSlots.booked_slots,
        dynamicTotal: availableSlots.total_slots
      };
    }
    
    // Otherwise show max slots
    return {
      ...daySchedule,
      dynamicAvailable: daySchedule.max_patients,
      dynamicBooked: 0,
      dynamicTotal: daySchedule.max_patients
    };
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl text-white">Specialist Schedules</h1>

      <div className="bg-bg-card backdrop-blur-md border border-border rounded-xl p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Specialist selector – shown for nurses and admins */}
          {(isNurse || isAdmin) && (
            <div>
              <label className="block text-text-muted text-sm mb-2">Select Specialist</label>
              <select
                value={selectedSpecialist || ''}
                onChange={(e) => setSelectedSpecialist(parseInt(e.target.value))}
                className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
              >
                <option value="">Choose a specialist...</option>
                {specialists.map(s => (
                  <option key={s.id} value={s.id}>
                    Dr. {s.name} - {s.specialty}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-text-muted text-sm mb-2">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Show a message if no specialist is selected */}
        {!selectedSpecialist && (isNurse || isAdmin) && (
          <div className="text-center py-8">
            <p className="text-text-muted">Please select a specialist to view their schedule.</p>
          </div>
        )}

        {selectedSpecialist && (
          <>
            {/* Regular Weekly Schedule with Dynamic Slot Counts */}
            <div className="mb-6">
              <h2 className="font-serif text-lg mb-3">Weekly Schedule</h2>
              <div className="grid grid-cols-7 gap-2">
                {days.map((day, index) => {
                  const daySchedule = getDayAvailableSlots(index);
                  return (
                    <div key={day} className="bg-sky-mid p-3 rounded-lg text-center">
                      <p className="text-xs text-text-muted mb-1">{day.substring(0, 3)}</p>
                      {daySchedule ? (
                        <>
                          <p className="text-xs font-medium">
                            {daySchedule.start_time} - {daySchedule.end_time}
                          </p>
                          <div className="mt-2">
                            <p className={`text-lg font-bold ${daySchedule.dynamicAvailable > 0 ? 'text-green-500' : 'text-primary'}`}>
                              {daySchedule.dynamicAvailable}
                            </p>
                            <p className="text-xs text-text-muted">slots available</p>
                          </div>
                          {daySchedule.dynamicBooked > 0 && (
                            <p className="text-xs text-text-muted mt-1">
                              {daySchedule.dynamicBooked} booked
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-primary mt-2">Not available</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Detailed Slots */}
            <div className="mb-6 p-4 bg-sky-deep rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-medium">
                  {format(new Date(selectedDate), 'MMMM do, yyyy')}
                </h3>
                {loadingSlots ? (
                  <i className="fas fa-spinner fa-spin text-primary"></i>
                ) : (
                  <div className="text-right">
                    <p className={`text-lg font-bold ${availableSlots.available_slots > 0 ? 'text-green-500' : 'text-primary'}`}>
                      {availableSlots.available_slots || 0} / {availableSlots.total_slots || 0} slots available
                    </p>
                    {availableSlots.booked_slots > 0 && (
                      <p className="text-xs text-text-muted">{availableSlots.booked_slots} appointments booked</p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Progress bar showing capacity */}
              {availableSlots.total_slots > 0 && (
                <div className="w-full bg-sky rounded-full h-2 mb-4">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(availableSlots.booked_slots / availableSlots.total_slots) * 100}%` }}
                  ></div>
                </div>
              )}
            </div>

            {/* Appointments for selected date */}
            <div>
              <h2 className="font-serif text-lg mb-3">
                Appointments for {format(new Date(selectedDate), 'MMMM do, yyyy')}
              </h2>
              {loading ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-2xl text-primary"></i>
                </div>
              ) : appointments.length === 0 ? (
                <p className="text-text-muted text-center py-4">No appointments scheduled</p>
              ) : (
                <div className="space-y-3">
                  {appointments.map(apt => (
                    <div key={apt.id} className="border border-border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-lg font-mono text-primary">{apt.time}</p>
                          <p className="font-medium">{apt.patient?.name || 'Unknown Patient'}</p>
                          <p className="text-sm text-text-muted">Omang: {apt.patient?.omang || 'N/A'}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          apt.status === 'scheduled' ? 'bg-yellow-500/20 text-yellow-500' :
                          apt.status === 'confirmed' ? 'bg-green-500/20 text-green-500' :
                          'bg-primary/20 text-primary'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}