import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { patientAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function RegisterNonCitizen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    passport_number: '',
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
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.passport_number.trim() || !formData.full_name.trim()) {
      toast.error('Passport number and full name are required');
      return;
    }
    setSubmitting(true);
    try {
      const response = await patientAPI.createNonCitizen(formData);
      toast.success(response.data.message || 'Non-citizen registered successfully');
      if (response.data.temp_pin) {
        toast(`Temporary PIN: ${response.data.temp_pin}`, { duration: 10000 });
      }
      navigate('/nurse');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl text-white">Register Non-Citizen Patient</h1>
      <form onSubmit={handleSubmit} className="bg-bg-card backdrop-blur-md border border-border rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">Passport Number *</label>
            <input type="text" name="passport_number" value={formData.passport_number} onChange={handleChange} className="w-full input" placeholder="Passport number" required />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Full Name *</label>
            <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} className="w-full input" placeholder="Full name" required />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Date of Birth</label>
            <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="w-full input" />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Gender</label>
            <select name="gender" value={formData.gender} onChange={handleChange} className="w-full select">
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Phone</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full input" placeholder="Phone number" />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full input" placeholder="Email address" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">Address</label>
            <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full input" placeholder="Street address" />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Village</label>
            <input type="text" name="village" value={formData.village} onChange={handleChange} className="w-full input" placeholder="Village/Town" />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">District</label>
            <input type="text" name="district" value={formData.district} onChange={handleChange} className="w-full input" placeholder="District" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">Next of Kin Name</label>
            <input type="text" name="next_of_kin_name" value={formData.next_of_kin_name} onChange={handleChange} className="w-full input" placeholder="Full name" />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Next of Kin Phone</label>
            <input type="tel" name="next_of_kin_phone" value={formData.next_of_kin_phone} onChange={handleChange} className="w-full input" placeholder="Phone number" />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Relationship</label>
            <input type="text" name="next_of_kin_relationship" value={formData.next_of_kin_relationship} onChange={handleChange} className="w-full input" placeholder="e.g., Spouse, Brother" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-text-muted text-sm mb-2">Medical Aid Number</label>
            <input type="text" name="medical_aid_number" value={formData.medical_aid_number} onChange={handleChange} className="w-full input" placeholder="Medical aid number" />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Medical Aid Name</label>
            <input type="text" name="medical_aid_name" value={formData.medical_aid_name} onChange={handleChange} className="w-full input" placeholder="e.g., BOMAID, Pula" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={() => navigate(-1)} className="bg-sky hover:bg-sky-mid text-white px-4 py-2 rounded-lg transition-colors border border-border">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50">
            {submitting ? <><i className="fas fa-spinner fa-spin mr-2"></i>Registering...</> : 'Register Patient'}
          </button>
        </div>
      </form>
    </div>
  );
}