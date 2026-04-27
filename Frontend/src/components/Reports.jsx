import React, { useState } from 'react';
import { reportAPI } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState('waiting_times');
  const [dateRange, setDateRange] = useState({
    startDate: format(new Date().setDate(1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateReport = async () => {
    // Role check for admin-only report
    if (reportType === 'referral_volume' && user?.role !== 'admin') {
      toast.error('You are not authorized to view this report');
      return;
    }

    setLoading(true);
    setError(null);
    setReportData(null);
    
    try {
      let response;
      const params = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate
      };
      
      console.log('Generating report:', reportType, params);
      
      switch (reportType) {
        case 'waiting_times':
          response = await reportAPI.waitingTimes(params);
          break;
        case 'referral_volume':
          response = await reportAPI.referralVolumeByDistrict(params);
          break;
        default:
          return;
      }
      
      console.log('Report data received:', response.data);
      setReportData(response.data);
      toast.success('Report generated successfully');
    } catch (error) {
      console.error('Report generation error:', error);
      setError(error.response?.data?.message || 'Failed to generate report');
      toast.error(error.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (formatType) => {
    if (!reportData) {
      toast.error('Please generate a report first');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      let url;
      
      if (formatType === 'csv') {
        url = `http://localhost:5000/api/reports/export/${reportType}?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
      } else if (formatType === 'pdf') {
        url = `http://localhost:5000/api/reports/export-pdf/${reportType}?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
      } else if (formatType === 'word') {
        url = `http://localhost:5000/api/reports/export-word/${reportType}?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
      } else {
        return;
      }
      
      console.log('Exporting to:', formatType, url);
      
      const response = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${reportType}_report.${formatType === 'word' ? 'docx' : formatType}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(`Report exported as ${formatType.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error.message || 'Export failed. Please try again.');
    }
  };

  const renderReportData = () => {
    if (!reportData) return null;
    
    if (reportType === 'waiting_times') {
      const waitingTimes = reportData.waiting_times || [];
      if (waitingTimes.length === 0) {
        return <p className="text-text-muted text-center py-4">No data available for the selected period.</p>;
      }
      
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left p-2">Referral Number</th>
                <th>Patient Name</th>
                <th>Created At</th>
                <th>Appointment Date</th>
                <th>Waiting Days</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {waitingTimes.map((item, idx) => (
                <tr key={idx} className="border-b border-border hover:bg-sky-mid/50">
                  <td className="p-2">{item.referral_number}</td>
                  <td className="p-2">{item.patient_name}</td>
                  <td className="p-2 text-xs">{new Date(item.created_at).toLocaleDateString()}</td>
                  <td className="p-2 text-xs">{new Date(item.appointment_date).toLocaleDateString()}</td>
                  <td className="p-2">{item.waiting_days}</td>
                  <td className="p-2">
                    <span className={`badge ${
                      item.priority === 'emergency' ? 'badge-missed' :
                      item.priority === 'urgent' ? 'badge-pending' : 'badge-confirmed'
                    }`}>
                      {item.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    if (reportType === 'referral_volume') {
      if (!Array.isArray(reportData) || reportData.length === 0) {
        return <p className="text-text-muted text-center py-4">No data available for the selected period.</p>;
      }
      
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left p-2">District</th>
                <th>Referral Count</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((item, idx) => (
                <tr key={idx} className="border-b border-border hover:bg-sky-mid/50">
                  <td className="p-2">{item.district}</td>
                  <td className="p-2 font-bold text-primary">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    return <pre className="text-sm text-text-muted overflow-auto max-h-96">{JSON.stringify(reportData, null, 2)}</pre>;
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl text-white">Reports</h1>
      
      <div className="bg-bg-card backdrop-blur-md border border-border rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-text-muted text-sm mb-2">Report Type</label>
            <select 
              value={reportType} 
              onChange={(e) => {
                setReportType(e.target.value);
                setReportData(null);
                setError(null);
              }} 
              className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary"
            >
              <option value="waiting_times">Waiting Times</option>
              {user?.role === 'admin' && (
                <option value="referral_volume">Referral Volume by District</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">Start Date</label>
            <input 
              type="date" 
              value={dateRange.startDate} 
              onChange={(e) => {
                setDateRange({...dateRange, startDate: e.target.value});
                setReportData(null);
              }} 
              className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary" 
            />
          </div>
          <div>
            <label className="block text-text-muted text-sm mb-2">End Date</label>
            <input 
              type="date" 
              value={dateRange.endDate} 
              onChange={(e) => {
                setDateRange({...dateRange, endDate: e.target.value});
                setReportData(null);
              }} 
              className="w-full bg-sky border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary" 
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3">
          <button 
            onClick={generateReport} 
            disabled={loading} 
            className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <><i className="fas fa-spinner fa-spin mr-2"></i>Generating...</> : <><i className="fas fa-chart-bar mr-2"></i>Generate Report</>}
          </button>
        </div>
        
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-500">{error}</p>
          </div>
        )}
        
        {reportData && (
          <div className="mt-6">
            <div className="flex justify-end gap-2 mb-4">
              <button onClick={() => exportReport('csv')} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                <i className="fas fa-file-csv mr-2"></i>Export CSV
              </button>
              <button onClick={() => exportReport('pdf')} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                <i className="fas fa-file-pdf mr-2"></i>Export PDF
              </button>
              <button onClick={() => exportReport('word')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm">
                <i className="fas fa-file-word mr-2"></i>Export Word
              </button>
            </div>
            
            <div className="bg-sky-mid rounded-lg p-4 overflow-x-auto">
              {renderReportData()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}