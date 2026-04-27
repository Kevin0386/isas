import React, { useState } from 'react';
import { patientAPI, uploadAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ScanReferral() {
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);

  const searchPatients = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }
    setSearching(true);
    try {
      const response = await patientAPI.search(searchQuery);
      setPatients(response.data);
      if (response.data.length === 0) {
        toast('No patients found');  // ✅ Fixed: was toast.info
      }
    } catch (error) {
      toast.error('Failed to search patients');
    } finally {
      setSearching(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const maxSize = 16 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('File size must be less than 16MB');
        e.target.value = '';
        return;
      }
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('File must be PDF, JPEG, or PNG');
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }
    setUploading(true);
    try {
      await uploadAPI.file(selectedFile, null, 'referral_letter_initial');
      toast.success('File uploaded successfully');
      setSelectedFile(null);
      document.getElementById('file-input').value = '';
      setSelectedPatient(null);
      setPatients([]);
      setSearchQuery('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchPatients();
    }
  };

  const clearSelection = () => {
    setSelectedPatient(null);
    setSelectedFile(null);
    document.getElementById('file-input').value = '';
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl text-white">Scan Referral Letter</h1>
      <div className="bg-bg-card backdrop-blur-md border border-border rounded-xl p-6">
        <h2 className="font-serif text-lg mb-4">Search Patient</h2>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter Omang number or patient name..."
            className="flex-1 bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
          />
          <button
            onClick={searchPatients}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
            disabled={searching}
          >
            {searching ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-search mr-2"></i>Search</>}
          </button>
        </div>

        {patients.length > 0 ? (
          <div className="mb-4 border border-border rounded-lg overflow-hidden">
            {patients.map(patient => (
              <div
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className={`p-4 cursor-pointer hover:bg-sky-mid border-b last:border-b-0 border-border ${selectedPatient?.id === patient.id ? 'bg-primary/10' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{patient.name}</p>
                    <p className="text-sm text-text-muted">
                      Omang: {patient.omang} · {patient.village || 'No village'}
                    </p>
                  </div>
                  {selectedPatient?.id === patient.id && <i className="fas fa-check-circle text-green-500"></i>}
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery && !searching ? (
          <div className="mb-4 p-6 text-center bg-sky-mid rounded-lg border border-border">
            <i className="fas fa-user-slash text-4xl text-text-muted mb-2"></i>
            <p className="text-text-muted mb-3">No patient found with "{searchQuery}"</p>
            <button
              onClick={() => { window.location.href = `/register-non-citizen?passport=${encodeURIComponent(searchQuery)}`; }}
              className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-colors"
            >
              <i className="fas fa-passport mr-2"></i> Register Non-Citizen
            </button>
          </div>
        ) : null}

        {selectedPatient && (
          <div className="mt-6 p-6 border-2 border-dashed border-border rounded-lg text-center">
            <i className="fas fa-cloud-upload-alt text-4xl text-text-muted mb-3"></i>
            <p className="text-text-muted mb-2">Upload referral letter for {selectedPatient.name}</p>
            <p className="text-xs text-text-muted mb-4">Accepted formats: PDF, JPEG, PNG (Max 16MB)</p>
            <input
              id="file-input"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-input"
              className="inline-block bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg cursor-pointer transition-colors"
            >
              <i className="fas fa-folder-open mr-2"></i> Choose File
            </label>
            {selectedFile && (
              <div className="mt-4 p-4 bg-sky-mid rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <i className={`fas ${selectedFile.type === 'application/pdf' ? 'fa-file-pdf' : 'fa-file-image'} text-primary text-xl mr-3`}></i>
                    <div className="text-left">
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-text-muted">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      document.getElementById('file-input').value = '';
                    }}
                    className="text-text-muted hover:text-primary"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {uploading ? <><i className="fas fa-spinner fa-spin mr-2"></i>Uploading...</> : <><i className="fas fa-upload mr-2"></i>Upload File</>}
                  </button>
                  <button
                    onClick={clearSelection}
                    className="bg-sky hover:bg-sky-mid text-white px-4 py-2 rounded-lg transition-colors border border-border"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!selectedPatient && patients.length > 0 && (
          <p className="text-center text-text-muted mt-4">Select a patient from the list above to upload a referral letter</p>
        )}
      </div>
    </div>
  );
}