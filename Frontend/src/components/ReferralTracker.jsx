import React, { useState, useEffect } from 'react';
import { referralAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ReferralTracker() {
  const [referrals, setReferrals] = useState([]);
  const [waitTimes, setWaitTimes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [trackerRes, waitRes] = await Promise.all([
        referralAPI.getTracker(),
        referralAPI.getAverageWaitTimes()
      ]);
      setReferrals(trackerRes.data);
      setWaitTimes(waitRes.data);
    } catch (error) {
      console.error('Failed to load referral tracker:', error);
      toast.error(error.response?.data?.message || 'Failed to load data');
      // Set empty arrays so UI doesn't break
      setReferrals([]);
      setWaitTimes([]);
    } finally {
      setLoading(false);
    }
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
      <h1 className="font-serif text-2xl text-white">Referral Tracker & Waitlist</h1>
      
      {/* Average wait times */}
      <div className="panel">
        <h2 className="font-serif text-lg mb-3">Average Wait Times (by specialty)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {waitTimes.map(w => (
            <div key={w.specialty} className="bg-sky-mid p-3 rounded-lg text-center">
              <p className="text-sm text-text-muted">{w.specialty}</p>
              <p className="text-xl font-bold text-primary">{w.avg_wait_days || 'N/A'} days</p>
            </div>
          ))}
          {waitTimes.length === 0 && (
            <div className="col-span-full text-center text-text-muted">No data available</div>
          )}
        </div>
      </div>

      {/* Referral list */}
      <div className="panel overflow-x-auto">
        <h2 className="font-serif text-lg mb-3">All Referrals (Your Department)</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-left p-2">Ref #</th>
              <th>Patient</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Wait Days</th>
              <th>Specialist</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map(r => (
              <tr key={r.id} className="border-b border-border">
                <td className="p-2">{r.referral_number}</td>
                <td>{r.patient_name}</td>
                <td>
                  <span className={`badge ${
                    r.priority === 'emergency' ? 'badge-missed' :
                    r.priority === 'urgent' ? 'badge-pending' : 'badge-confirmed'
                  }`}>
                    {r.priority}
                  </span>
                </td>
                <td>{r.status}</td>
                <td>{r.waiting_days !== null ? r.waiting_days : 'pending'}</td>
                <td>{r.specialist || 'unassigned'}</td>
              </tr>
            ))}
            {referrals.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-8 text-text-muted">
                  No referrals found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}