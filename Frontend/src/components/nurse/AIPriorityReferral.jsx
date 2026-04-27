import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const AIPriorityReferral = () => {
  const [formData, setFormData] = useState({
    patient_id: '',
    specialty: '',
    reason: '',
    referring_facility_id: '',
    referred_to_facility_id: ''
  });
  
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const handleReasonChange = async (e) => {
    const reason = e.target.value;
    setFormData({ ...formData, reason });
    
    // Auto-analyze as user types (debounced)
    if (reason.length > 20) {
      clearTimeout(window.analysisTimeout);
      window.analysisTimeout = setTimeout(() => analyzeReferral(reason), 1000);
    }
  };

  const analyzeReferral = async (reason) => {
    if (!reason || reason.length < 10) return;
    
    setAnalyzing(true);
    try {
      const response = await axios.post('/api/nurse/referrals/analyze', {
        reason: reason,
        specialty: formData.specialty,
        patient_age: null // Could get from patient data
      });
      
      setAiAnalysis(response.data);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const searchPatient = async () => {
    if (!patientSearch) return;
    
    try {
      const response = await axios.get(`/api/nurse/patients/search?q=${patientSearch}`);
      setSearchResults(response.data);
    } catch (error) {
      toast.error('Search failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.patient_id) {
      toast.error('Please select a patient');
      return;
    }
    
    if (!formData.reason) {
      toast.error('Please provide referral reason');
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await axios.post('/api/nurse/referrals/create', formData);
      
      toast.success(
        `Referral created! AI Priority: ${response.data.ai_suggestion.priority}\n` +
        `Suggested timeframe: ${response.data.ai_suggestion.suggested_timeframe}`
      );
      
      // Reset form
      setFormData({
        patient_id: '',
        specialty: '',
        reason: '',
        referring_facility_id: '',
        referred_to_facility_id: ''
      });
      setAiAnalysis(null);
      setSearchResults([]);
      setPatientSearch('');
      
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create referral');
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'EMERGENCY': return 'bg-red-100 text-red-800 border-red-300';
      case 'URGENT': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getPriorityIcon = (priority) => {
    switch(priority) {
      case 'EMERGENCY': return '🔴';
      case 'URGENT': return '🟡';
      default: return '🟢';
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Create Referral with AI Priority Suggestion</h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Search */}
        <div>
          <label className="block text-sm font-medium mb-1">Search Patient</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter name or Omang"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2"
            />
            <button
              type="button"
              onClick={searchPatient}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Search
            </button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="mt-2 border rounded-lg overflow-hidden">
              {searchResults.map(patient => (
                <div
                  key={patient.id}
                  onClick={() => {
                    setFormData({ ...formData, patient_id: patient.id });
                    setSearchResults([]);
                    setPatientSearch(patient.full_name);
                  }}
                  className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                >
                  <p className="font-medium">{patient.full_name}</p>
                  <p className="text-sm text-gray-500">Omang: {patient.omang || 'N/A'} | ID: {patient.display_id}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Referral Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Specialty *</label>
            <select
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              required
            >
              <option value="">Select specialty</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Oncology">Oncology</option>
              <option value="Neurology">Neurology</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Obstetrics">Obstetrics</option>
              <option value="Orthopedics">Orthopedics</option>
              <option value="Ophthalmology">Ophthalmology</option>
              <option value="Dermatology">Dermatology</option>
              <option value="Psychiatry">Psychiatry</option>
              <option value="Radiology">Radiology</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Referring Facility</label>
            <input
              type="text"
              value={formData.referring_facility_id}
              onChange={(e) => setFormData({ ...formData, referring_facility_id: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="e.g., Mahalapye Primary Hospital"
            />
          </div>
        </div>

        {/* Referral Reason */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Referral Reason / Clinical Summary *
          </label>
          <textarea
            rows={6}
            value={formData.reason}
            onChange={handleReasonChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Describe the patient's condition, symptoms, and reason for referral..."
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.reason.length} characters | AI will analyze for priority
          </p>
        </div>

        {/* AI Analysis Display */}
        {analyzing && (
          <div className="bg-gray-50 border rounded-lg p-4 text-center">
            <div className="animate-pulse">🤖 AI analyzing referral...</div>
          </div>
        )}

        {aiAnalysis && !analyzing && (
          <div className={`border-2 rounded-lg p-4 ${getPriorityColor(aiAnalysis.priority)}`}>
            <div className="flex items-start gap-3">
              <div className="text-2xl">{getPriorityIcon(aiAnalysis.priority)}</div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-lg">AI Priority Suggestion</h4>
                    <p className="text-sm opacity-75">Confidence: {(aiAnalysis.confidence * 100).toFixed(0)}%</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium">Score: {aiAnalysis.score}/100</span>
                    <div className="w-32 h-2 bg-gray-200 rounded-full mt-1">
                      <div 
                        className={`h-2 rounded-full ${
                          aiAnalysis.priority === 'EMERGENCY' ? 'bg-red-600' :
                          aiAnalysis.priority === 'URGENT' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${aiAnalysis.score}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <p className="mt-2">{aiAnalysis.reasoning}</p>
                
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Suggested Timeframe:</span>
                    <span className="ml-2">{aiAnalysis.suggested_timeframe}</span>
                  </div>
                  {aiAnalysis.dangerous_conditions?.length > 0 && (
                    <div>
                      <span className="font-medium text-red-600">⚠️ Detected:</span>
                      <span className="ml-2">{aiAnalysis.dangerous_conditions.join(', ')}</span>
                    </div>
                  )}
                </div>
                
                {aiAnalysis.keywords_matched?.length > 0 && (
                  <div className="mt-2 text-xs">
                    <span className="font-medium">Keywords detected:</span>
                    <span className="ml-1">{aiAnalysis.keywords_matched.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !formData.patient_id || !formData.reason}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {submitting ? 'Creating Referral...' : 'Create Referral with AI Priority'}
        </button>
      </form>
    </div>
  );
};

export default AIPriorityReferral;