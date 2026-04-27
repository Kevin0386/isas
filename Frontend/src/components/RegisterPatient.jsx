import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { patientAPI, facilityAPI } from '../services/api';
import { validateOmang, formatOmang } from '../utils/omangValidator';
import toast from 'react-hot-toast';

export default function RegisterPatient() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    omang: '',
    full_name: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    village: '',
    district: '',
    next_of_kin_name: '',
    next_of_kin_phone: '',
    next_of_kin_relationship: '',
    medical_aid_number: '',
    medical_aid_name: ''
  });
  const [validation, setValidation] = useState({ valid: null, gender: null, message: '' });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [facilities, setFacilities] = useState([]);

  // Read query param for Omang
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const omangParam = params.get('omang');
    if (omangParam) {
      const formatted = formatOmang(omangParam);
      setFormData(prev => ({ ...prev, omang: formatted }));
      if (formatted.length === 9) {
        const result = validateOmang(formatted);
        setValidation(result);
        if (result.valid && result.gender) {
          setFormData(prev => ({ ...prev, gender: result.gender }));
        }
      }
    }
    fetchFacilities();
  }, [location]);

  const fetchFacilities = async () => {
    try {
      const response = await facilityAPI.getAll();
      setFacilities(response.data);
    } catch (error) {
      console.error('Failed to fetch facilities:', error);
    }
  };

  const handleOmangChange = (e) => {
    const formatted = formatOmang(e.target.value);
    setFormData({ ...formData, omang: formatted });
    if (formatted.length === 9) {
      const result = validateOmang(formatted);
      setValidation(result);
      if (result.valid && result.gender) {
        setFormData(prev => ({ ...prev, gender: result.gender }));
      }
    } else {
      setValidation({ valid: null, gender: null, message: '' });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validation.valid) {
      toast.error(validation.message || 'Please enter a valid Omang number');
      return;
    }

    if (!formData.full_name.trim()) {
      toast.error('Patient name is required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await patientAPI.create(formData);
      toast.success('Patient registered successfully');
      const pinSlip = response.data.pin_slip;
      if (pinSlip) {
        toast(
          <div className="text-center">
            <p className="font-bold mb-2">Temporary PIN: {pinSlip.pin}</p>
            <p className="text-xs text-text-muted">Please provide this to the patient.</p>
          </div>,
          { duration: 10000 }
        );
      }
      navigate('/nurse');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to register patient');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl text-white">Register New Patient</h1>

      <form onSubmit={handleSubmit} className="bg-bg-card backdrop-blur-md border border-border rounded-xl p-6 space-y-6">
        {/* Personal Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">Omang Number *</label>
            <input
              type="text"
              name="omang"
              value={formData.omang}
              onChange={handleOmangChange}
              className={`w-full input ${validation.valid === false ? 'input-error' : ''}`}
              placeholder="9-digit Omang"
              maxLength="9"
              required
            />
            {validation.gender && (
              <p className="text-xs text-text-muted mt-1">
                <i className={`fas fa-${validation.gender === 'male' ? 'mars' : 'venus'} mr-1`}></i>
                {validation.gender === 'male' ? 'Male' : 'Female'}
              </p>
            )}
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Full Name *</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full input"
              placeholder="Full name"
              required
            />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Date of Birth</label>
            <input
              type="date"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={handleChange}
              className="w-full input"
            />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full select"
              disabled={!!validation.gender}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full input"
              placeholder="Phone number"
            />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full input"
              placeholder="Email address"
            />
          </div>
        </div>

        {/* Address */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full input"
              placeholder="Street address"
            />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Village</label>
            <input
              type="text"
              name="village"
              value={formData.village}
              onChange={handleChange}
              className="w-full input"
              placeholder="Village/Town"
            />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">District</label>
            <input
              type="text"
              name="district"
              value={formData.district}
              onChange={handleChange}
              className="w-full input"
              placeholder="District"
            />
          </div>
        </div>

        {/* Next of Kin */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">Next of Kin Name</label>
            <input
              type="text"
              name="next_of_kin_name"
              value={formData.next_of_kin_name}
              onChange={handleChange}
              className="w-full input"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Next of Kin Phone</label>
            <input
              type="tel"
              name="next_of_kin_phone"
              value={formData.next_of_kin_phone}
              onChange={handleChange}
              className="w-full input"
              placeholder="Phone number"
            />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Relationship</label>
            <input
              type="text"
              name="next_of_kin_relationship"
              value={formData.next_of_kin_relationship}
              onChange={handleChange}
              className="w-full input"
              placeholder="e.g., Spouse, Brother"
            />
          </div>
        </div>

        {/* Medical Aid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">Medical Aid Number</label>
            <input
              type="text"
              name="medical_aid_number"
              value={formData.medical_aid_number}
              onChange={handleChange}
              className="w-full input"
              placeholder="Medical aid number"
            />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Medical Aid Name</label>
            <input
              type="text"
              name="medical_aid_name"
              value={formData.medical_aid_name}
              onChange={handleChange}
              className="w-full input"
              placeholder="e.g., BOMAID, Pula"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-sky hover:bg-sky-mid text-white px-4 py-2 rounded-lg transition-colors border border-border"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !validation.valid}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Registering...
              </>
            ) : (
              'Register Patient'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}