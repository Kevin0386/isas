import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const PatientCheckIn = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [vitals, setVitals] = useState({
    temperature: '',
    heart_rate: '',
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    respiratory_rate: '',
    oxygen_saturation: '',
    blood_glucose: ''
  });
  const [notes, setNotes] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchWaitingQueue();
    // Refresh queue every 30 seconds
    const interval = setInterval(fetchWaitingQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchWaitingQueue = async () => {
    try {
      const response = await axios.get('/api/nurse/queue');
      setWaitingQueue(response.data.queue);
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    }
  };

  const searchAppointments = async () => {
    if (!searchTerm) return;
    
    try {
      const response = await axios.get(`/api/nurse/appointments/search?q=${searchTerm}`);
      setSearchResults(response.data);
    } catch (error) {
      toast.error('Search failed');
    }
  };

  const handleCheckIn = async () => {
    if (!selectedAppointment) return;
    
    setCheckingIn(true);
    try {
      // Prepare vitals object (only include filled fields)
      const vitalsData = {};
      Object.entries(vitals).forEach(([key, value]) => {
        if (value && value !== '') {
          vitalsData[key] = parseFloat(value);
        }
      });
      
      const response = await axios.post(`/api/nurse/appointments/${selectedAppointment.id}/checkin`, {
        vitals: vitalsData,
        notes: notes
      });
      
      toast.success(`Checked in! Waiting number: ${response.data.waiting_number}`);
      
      // Reset form
      setSelectedAppointment(null);
      setSearchTerm('');
      setSearchResults([]);
      setVitals({
        temperature: '',
        heart_rate: '',
        blood_pressure_systolic: '',
        blood_pressure_diastolic: '',
        respiratory_rate: '',
        oxygen_saturation: '',
        blood_glucose: ''
      });
      setNotes('');
      setAlerts([]);
      
      fetchWaitingQueue();
      
    } catch (error) {
      toast.error(error.response?.data?.error || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleVitalChange = (field, value) => {
    setVitals({ ...vitals, [field]: value });
    
    // Validate as user types
    const numValue = parseFloat(value);
    const ranges = {
      temperature: { min: 35, max: 42, message: 'Temperature should be between 35-42°C' },
      heart_rate: { min: 30, max: 200, message: 'Heart rate should be between 30-200 BPM' },
      blood_pressure_systolic: { min: 70, max: 250, message: 'Systolic should be 70-250 mmHg' },
      blood_pressure_diastolic: { min: 40, max: 150, message: 'Diastolic should be 40-150 mmHg' },
      respiratory_rate: { min: 8, max: 40, message: 'Respiratory rate should be 8-40/min' },
      oxygen_saturation: { min: 70, max: 100, message: 'O2 saturation should be 70-100%' }
    };
    
    if (ranges[field] && numValue) {
      const range = ranges[field];
      if (numValue < range.min || numValue > range.max) {
        setAlerts(prev => [...prev, range.message]);
      } else {
        setAlerts(prev => prev.filter(a => a !== range.message));
      }
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Patient Check-In</h3>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Left Column - Search & Check-in */}
        <div>
          {/* Search Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">Find Appointment</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Patient name, Omang, or appointment ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2"
              />
              <button
                onClick={searchAppointments}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg overflow-hidden mb-6">
              <div className="bg-gray-50 px-4 py-2 font-medium">Today's Appointments</div>
              {searchResults.map(apt => (
                <div
                  key={apt.id}
                  onClick={() => setSelectedAppointment(apt)}
                  className={`p-4 border-t cursor-pointer hover:bg-gray-50 ${
                    selectedAppointment?.id === apt.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{apt.patient_name}</p>
                      <p className="text-sm text-gray-600">Time: {new Date(apt.appointment_date).toLocaleTimeString()}</p>
                      <p className="text-sm text-gray-600">Specialist: {apt.specialist_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs ${
                        apt.status === 'SCHEDULED' ? 'bg-green-100 text-green-800' : 'bg-gray-100'
                      }`}>
                        {apt.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Check-in Form */}
          {selectedAppointment && (
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-3">Check-in: {selectedAppointment.patient_name}</h4>
              
              {/* Vitals Section */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Vital Signs</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Temperature (°C)"
                      value={vitals.temperature}
                      onChange={(e) => handleVitalChange('temperature', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Heart Rate (BPM)"
                      value={vitals.heart_rate}
                      onChange={(e) => handleVitalChange('heart_rate', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="BP Systolic"
                        value={vitals.blood_pressure_systolic}
                        onChange={(e) => handleVitalChange('blood_pressure_systolic', e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      />
                      <span className="self-center">/</span>
                      <input
                        type="number"
                        placeholder="BP Diastolic"
                        value={vitals.blood_pressure_diastolic}
                        onChange={(e) => handleVitalChange('blood_pressure_diastolic', e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Respiratory Rate"
                      value={vitals.respiratory_rate}
                      onChange={(e) => handleVitalChange('respiratory_rate', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="O2 Saturation (%)"
                      value={vitals.oxygen_saturation}
                      onChange={(e) => handleVitalChange('oxygen_saturation', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {alerts.length > 0 && (
                <div className="mb-4 bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-800">⚠️ Vital Sign Alerts:</p>
                  <ul className="text-sm text-yellow-700 list-disc list-inside">
                    {alerts.map((alert, i) => <li key={i}>{alert}</li>)}
                  </ul>
                </div>
              )}

              {/* Notes */}
              <div className="mb-4">
                <textarea
                  rows={3}
                  placeholder="Additional notes (symptoms, concerns, etc.)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  {checkingIn ? 'Checking In...' : 'Confirm Check-In'}
                </button>
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Waiting Queue */}
        <div>
          <h4 className="font-semibold mb-3">Current Waiting Queue</h4>
          <div className="border rounded-lg overflow-hidden">
            {waitingQueue.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No patients waiting</div>
            ) : (
              <div className="divide-y">
                {waitingQueue.map((patient, idx) => (
                  <div key={idx} className="p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-blue-600">#{patient.position}</span>
                          <span className="font-medium">{patient.patient_name}</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Waiting number: {patient.waiting_number} | Arrived: {new Date(patient.arrival_time).toLocaleTimeString()}
                        </div>
                        {patient.vitals_recorded && (
                          <span className="text-xs text-green-600">✓ Vitals recorded</span>
                        )}
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">
                          Est. wait: {patient.estimated_wait_minutes} min
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientCheckIn;