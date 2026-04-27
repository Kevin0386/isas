import React, { useState, useEffect } from 'react';
import { adminAPI, facilityAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    omang: '',
    full_name: '',
    role: 'head_nurse',
    gender: 'male',
    phone: '',
    email: '',
    employee_id: '',
    department_id: '',
    facility_id: '',
    specialty_id: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchSpecialties();
    fetchFacilities();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await adminAPI.getUsers();
      setUsers(res.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await adminAPI.getDepartments();
      setDepartments(res.data);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchSpecialties = async () => {
    try {
      const res = await adminAPI.getSpecialties();
      setSpecialties(res.data);
    } catch (error) {
      console.error('Failed to fetch specialties:', error);
    }
  };

  const fetchFacilities = async () => {
    try {
      const res = await facilityAPI.getAll();
      setFacilities(res.data);
    } catch (error) {
      console.error('Failed to fetch facilities:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        department_id: form.department_id ? parseInt(form.department_id) : null,
        facility_id: form.facility_id ? parseInt(form.facility_id) : null,
        specialty_id: form.specialty_id ? parseInt(form.specialty_id) : null
      };
      const res = await adminAPI.createUser(payload);
      toast.success(`User created. Temporary PIN: ${res.data.temp_pin}`);
      setShowModal(false);
      fetchUsers();
      setForm({
        omang: '',
        full_name: '',
        role: 'head_nurse',
        gender: 'male',
        phone: '',
        email: '',
        employee_id: '',
        department_id: '',
        facility_id: '',
        specialty_id: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Creation failed');
    }
  };

  const handleResetPin = async (userId, userName) => {
    if (window.confirm(`Reset PIN for ${userName}?`)) {
      try {
        const res = await adminAPI.resetUserPin(userId);
        toast.success(`New PIN for ${userName}: ${res.data.new_pin}`, { duration: 10000 });
      } catch (error) {
        toast.error('Failed to reset PIN');
      }
    }
  };

  // Soft delete - deactivate user (cannot log in, but data preserved)
  const handleDeactivate = async (userId, userName) => {
    if (window.confirm(`Deactivate ${userName}? They will not be able to log in.`)) {
      try {
        await adminAPI.updateUser(userId, { status: 'inactive' });
        toast.success('User deactivated');
        fetchUsers();
      } catch (error) {
        toast.error('Failed to deactivate user');
      }
    }
  };

  // Reactivate user
  const handleReactivate = async (userId, userName) => {
    if (window.confirm(`Reactivate ${userName}? They will be able to log in again.`)) {
      try {
        await adminAPI.updateUser(userId, { status: 'active' });
        toast.success('User reactivated');
        fetchUsers();
      } catch (error) {
        toast.error('Failed to reactivate user');
      }
    }
  };

  // Hard delete - permanently remove from database
  const handleHardDelete = async (userId, userName) => {
    if (window.confirm(`⚠️ PERMANENT DELETE: This will completely remove ${userName} from the database. This action CANNOT be undone. Continue?`)) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/admin/users/${userId}/hard-delete`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          toast.success('User permanently deleted');
          fetchUsers();
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to delete user');
        }
      } catch (error) {
        toast.error('Failed to delete user');
      }
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      patient: 'bg-blue-500/20 text-blue-500',
      head_nurse: 'bg-green-500/20 text-green-500',
      specialist: 'bg-purple-500/20 text-purple-500',
      admin: 'bg-red-500/20 text-red-500'
    };
    return badges[role] || 'bg-gray-500/20 text-gray-500';
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
      <div className="flex justify-between items-center">
        <h1 className="font-serif text-2xl text-white">User Management</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <i className="fas fa-user-plus mr-2"></i>Add User
        </button>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-left p-2">Omang</th>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-border hover:bg-sky-mid/50">
                <td className="p-2 font-mono text-xs">{u.omang}</td>
                <td className="p-2 font-medium">{u.full_name}</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${getRoleBadge(u.role)}`}>
                    {u.role === 'head_nurse' ? 'Head Nurse' : u.role}
                  </span>
                </td>
                <td className="p-2 text-text-muted">{u.email || '—'}</td>
                <td className="p-2 text-text-muted">{u.phone || '—'}</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    u.status === 'active' 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-red-500/20 text-red-500'
                  }`}>
                    {u.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-2">
                  <div className="flex gap-2">
                    {/* Reset PIN - always available */}
                    <button 
                      onClick={() => handleResetPin(u.id, u.full_name)} 
                      className="text-yellow-500 hover:text-yellow-400 text-sm" 
                      title="Reset PIN"
                    >
                      <i className="fas fa-key"></i>
                    </button>
                    
                    {u.status === 'active' ? (
                      /* Deactivate button for active users */
                      <button 
                        onClick={() => handleDeactivate(u.id, u.full_name)} 
                        className="text-orange-500 hover:text-orange-400 text-sm" 
                        title="Deactivate User"
                      >
                        <i className="fas fa-user-slash"></i>
                      </button>
                    ) : (
                      /* Reactivate and Hard Delete buttons for inactive users */
                      <>
                        <button 
                          onClick={() => handleReactivate(u.id, u.full_name)} 
                          className="text-green-500 hover:text-green-400 text-sm" 
                          title="Reactivate User"
                        >
                          <i className="fas fa-user-check"></i>
                        </button>
                        <button 
                          onClick={() => handleHardDelete(u.id, u.full_name)} 
                          className="text-red-500 hover:text-red-400 text-sm" 
                          title="Permanently Delete User"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="font-serif text-xl text-white">Create New User</h2>
              <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-white">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-muted text-sm mb-2">Omang *</label>
                  <input className="input w-full" placeholder="9-digit Omang" value={form.omang} onChange={e => setForm({...form, omang: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-text-muted text-sm mb-2">Full Name *</label>
                  <input className="input w-full" placeholder="Full name" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-muted text-sm mb-2">Role *</label>
                  <select className="select w-full" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="head_nurse">Head Nurse</option>
                    <option value="specialist">Specialist</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-muted text-sm mb-2">Gender</label>
                  <select className="select w-full" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
              
              {form.role === 'head_nurse' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-text-muted text-sm mb-2">Department *</label>
                    <select className="select w-full" value={form.department_id} onChange={e => setForm({...form, department_id: e.target.value})} required>
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-text-muted text-sm mb-2">Facility</label>
                    <select className="select w-full" value={form.facility_id} onChange={e => setForm({...form, facility_id: e.target.value})}>
                      <option value="">Select Facility</option>
                      {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
              
              {form.role === 'specialist' && (
                <div>
                  <label className="block text-text-muted text-sm mb-2">Specialty *</label>
                  <select className="select w-full" value={form.specialty_id} onChange={e => setForm({...form, specialty_id: e.target.value})} required>
                    <option value="">Select Specialty</option>
                    {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-muted text-sm mb-2">Phone</label>
                  <input className="input w-full" placeholder="Phone number" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
                <div>
                  <label className="block text-text-muted text-sm mb-2">Email</label>
                  <input className="input w-full" placeholder="Email address" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className="block text-text-muted text-sm mb-2">Employee ID</label>
                <input className="input w-full" placeholder="Employee ID" value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})} />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}