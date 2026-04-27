import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const NationalRegistrySearch = ({ onPatientImported }) => {
  const [omang, setOmang] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    village: '',
    district: '',
    phone: '',
    email: '',
    next_of_kin_name: '',
    next_of_kin_phone: '',
    temp_pin: Math.floor(1000 + Math.random() * 9000).toString()
  });

  const handleSearch = async () => {
    if (!omang || omang.length !== 11) {
      toast.error('Please enter a valid 11-digit Omang number');
      return;
    }

    setSearching(true);
    try {
      const response = await axios.post('/api/nurse/registry/search', { omang });
      if (response.data.success) {
        setSearchResult(response.data);
        if (response.data.patient_exists_locally) {
          toast.info('Patient already exists in local system');
          onPatientImported?.(response.data.local_patient_id);
        } else if (response.data.registry_data) {
          toast.success('Patient found in national registry');
          // Auto-fill form with inferred data
          setFormData(prev => ({
            ...prev,
            date_of_birth: `${response.data.registry_data.inferred_birth_year}-01-01`
          }));
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async () => {
    try {
      const response = await axios.post('/api/nurse/registry/import', {
        omang,
        ...formData
      });
      
      if (response.data.success) {
        toast.success('Patient imported successfully!');
        onPatientImported?.(response.data.patient_id);
        // Reset form
        setOmang('');
        setSearchResult(null);
        setFormData({
          full_name: '',
          date_of_birth: '',
          village: '',
          district: '',
          phone: '',
          email: '',
          next_of_kin_name: '',
          next_of_kin_phone: '',
          temp_pin: Math.floor(1000 + Math.random() * 9000).toString()
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Import failed');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">National Patient Registry Search</h2>
      
      {/* Search Section */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Enter Omang Number (11 digits)"
          value={omang}
          onChange={(e) => setOmang(e.target.value)}
          className="flex-1 border rounded-lg px-4 py-2"
          maxLength={11}
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {searching ? 'Searching...' : 'Search Registry'}
        </button>
      </div>

      {/* Search Result Display */}
      {searchResult && searchResult.registry_data && !searchResult.patient_exists_locally && (
        <div className="border rounded-lg p-4 mb-6 bg-green-50">
          <h3 className="font-semibold text-green-800 mb-2">✓ Patient Found in National Registry</h3>
          <div className="grid grid-cols-2 gap-2 text-sm mb-4">
            <p><span className="font-medium">Registry ID:</span> {searchResult.registry_data.registry_id}</p>
            <p><span className="font-medium">Inferred Gender:</span> {searchResult.registry_data.inferred_gender}</p>
            <p><span className="font-medium">Birth Year:</span> {searchResult.registry_data.inferred_birth_year}</p>
            <p><span className="font-medium">Last Updated:</span> {new Date(searchResult.registry_data.last_updated).toLocaleDateString()}</p>
          </div>
          
          <h3 className="font-semibold mb-3">Complete Patient Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Full Name *"
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="date"
              placeholder="Date of Birth"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="text"
              placeholder="Village"
              value={formData.village}
              onChange={(e) => setFormData({...formData, village: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="text"
              placeholder="District"
              value={formData.district}
              onChange={(e) => setFormData({...formData, district: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="text"
              placeholder="Next of Kin Name"
              value={formData.next_of_kin_name}
              onChange={(e) => setFormData({...formData, next_of_kin_name: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="tel"
              placeholder="Next of Kin Phone"
              value={formData.next_of_kin_phone}
              onChange={(e) => setFormData({...formData, next_of_kin_phone: e.target.value})}
              className="border rounded-lg px-3 py-2"
            />
          </div>
          
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleImport}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
            >
              Import from National Registry
            </button>
            <div className="text-sm text-gray-600 self-center">
              Temporary PIN: <span className="font-mono font-bold">{formData.temp_pin}</span> (give to patient)
            </div>
          </div>
        </div>
      )}

      {searchResult && searchResult.patient_exists_locally && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <p className="text-yellow-800">✓ Patient already registered in local system</p>
        </div>
      )}
    </div>
  );
};

export default NationalRegistrySearch;