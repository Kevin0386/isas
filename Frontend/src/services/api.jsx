import axios from 'axios';

// Use environment variable or fallback to localhost for development
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== AUTHENTICATION APIs ====================
export const authAPI = {
  login: (omang, pin) => api.post('/auth/login', { omang, pin: String(pin) }),
  resetPin: (omang) => api.post('/auth/reset-pin', { omang }),
  confirmResetPin: (token, newPin) => api.post('/auth/confirm-reset-pin', { token, new_pin: newPin }),
  validateOmang: (omang) => api.post('/validate/omang', { omang }),
  changePin: (currentPin, newPin) => api.post('/auth/change-pin', { current_pin: currentPin, new_pin: newPin }),
};

// ==================== PATIENT APIs ====================
export const patientAPI = {
  search: (query) => api.get('/patients/search', { params: { q: query } }),
  get: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  createNonCitizen: (data) => api.post('/patients/non-citizen', data),
  resetPin: (patientId) => api.post(`/patients/${patientId}/reset-pin`),
  getDepartmentPatients: () => api.get('/nurse/department-patients'),
};

// ==================== FACILITY APIs ====================
export const facilityAPI = {
  getAll: () => api.get('/facilities'),
  get: (id) => api.get(`/facilities/${id}`),
};

// ==================== SPECIALIST APIs ====================
export const specialistAPI = {
  getAll: (params) => api.get('/specialists', { params }),
  get: (id) => api.get(`/specialists/${id}`),
  getSchedule: (id) => api.get(`/specialists/${id}/schedule`),
  getAvailableSlots: (specialistId, date) => api.get(`/specialists/${specialistId}/available-slots`, { params: { date } }),
  getSlots: (specialistId, date) => api.get(`/specialists/${specialistId}/slots`, { params: { date } }),
  getAvailableSlotsCount: (specialistId, date) => api.get(`/specialists/${specialistId}/available-slots-count`, { params: { date } }),
  updateAvailability: (isAvailable) => api.put('/specialist/availability', { is_available: isAvailable }),
  getDashboard: () => api.get('/specialist/dashboard'),
  getAppointmentDetails: (appointmentId) => api.get(`/specialist/appointments/${appointmentId}`),
};

// ==================== REFERRAL APIs ====================
export const referralAPI = {
  create: (data) => api.post('/referrals', data),
  get: (id) => api.get(`/referrals/${id}`),
  getPatientReferrals: (patientId) => api.get(`/referrals/patient/${patientId}`),
  getSpecialistReferrals: (specialistId, status) => api.get(`/referrals/specialist/${specialistId}`, { params: { status } }),
  getPendingApproval: () => api.get('/referrals/pending-approval'),
  approve: (referralId, action, specialistId, reason) => api.post(`/referrals/${referralId}/approve`, { action, specialist_id: specialistId, reason }),
  getDocument: (referralId) => api.get(`/referrals/${referralId}/document`, { responseType: 'blob' }),
  validateReferral: (data) => api.post('/referrals/validate', data),
  suggestPriority: (data) => api.post('/referrals/suggest-priority', data),
  getTracker: () => api.get('/referrals/tracker'),
  getAverageWaitTimes: () => api.get('/referrals/average-wait-times'),
  getAIAnalysis: (data) => api.post('/nurse/referrals/analyze', data),
};

// ==================== APPOINTMENT APIs ====================
export const appointmentAPI = {
  create: (data) => api.post('/appointments', data),
  get: (id) => api.get(`/appointments/${id}`),
  getPatientAppointments: (patientId) => api.get(`/appointments/patient/${patientId}`),
  getSpecialistAppointments: (specialistId, params) => api.get(`/appointments/specialist/${specialistId}`, { params }),
  getTodayAppointments: () => api.get('/appointments/today'),
  getAppointmentsByDateRange: (startDate, endDate) => api.get('/appointments/date-range', { params: { start_date: startDate, end_date: endDate } }),
  checkIn: (appointmentId) => api.post(`/appointments/${appointmentId}/check-in`),
  updateOutcome: (appointmentId, status, outcome, notes) => api.put(`/appointments/${appointmentId}/outcome`, { status, outcome, clinical_notes: notes }),
  book: (data) => api.post('/appointments/book', data),
};

// ==================== RESCHEDULE APIs ====================
export const rescheduleAPI = {
  request: (appointmentId, reason, requestedDate) => api.post('/reschedule', { appointment_id: appointmentId, reason, requested_date: requestedDate }),
  getPending: () => api.get('/reschedule/pending'),
  approve: (requestId, action, notes, newDate) => api.post(`/reschedule/${requestId}/approve`, { action, notes, new_date: newDate }),
};

// ==================== NOTIFICATION APIs ====================
export const notificationAPI = {
  getAll: (unreadOnly = false) => api.get('/notifications', { params: { unread_only: unreadOnly } }),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  sendReminders: () => api.post('/notifications/send-appointment-reminders'),
};

// ==================== REMINDER APIs ====================
export const reminderAPI = {
  sendReminders: () => api.post('/notifications/send-appointment-reminders'),
};

// ==================== ESCALATION APIs ====================
export const escalationAPI = {
  getAlerts: () => api.get('/escalation/alerts'),
  getDelayedReferrals: () => api.get('/escalation/check-delayed'),
  sendAlert: (referralId) => api.post('/escalation/send-alerts', { referral_id: referralId }),
  getRules: () => api.get('/escalation/rules'),
  updateRules: (rules) => api.put('/escalation/rules', rules),
};

// ==================== REPORT APIs ====================
export const reportAPI = {
  appointmentVolumes: (params) => api.get('/reports/appointment-volumes', { params }),
  waitingTimes: (params) => api.get('/reports/waiting-times', { params }),
  referralVolumeByDistrict: (params) => api.get('/reports/referral-volume-by-district', { params }),
  exportReport: (type, params) => api.get(`/reports/export/${type}`, { params, responseType: 'blob' }),
  exportPDF: (type, params) => api.get(`/reports/export-pdf/${type}`, { params, responseType: 'blob' }),
  exportWord: (type, params) => api.get(`/reports/export-word/${type}`, { params, responseType: 'blob' }),
};

// ==================== STATS APIs ====================
export const statsAPI = {
  getDashboard: () => api.get('/stats/dashboard'),
  getMonthlyNoShow: () => api.get('/stats/no-show/monthly'),
  getCurrentNoShow: () => api.get('/stats/no-show/current'),
};

// ==================== UPLOAD APIs ====================
export const uploadAPI = {
  file: (file, referralId, documentType) => {
    const formData = new FormData();
    formData.append('file', file);
    if (referralId) formData.append('referral_id', referralId);
    if (documentType) formData.append('document_type', documentType);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ==================== ADMIN APIs ====================
export const adminAPI = {
  getUsers: () => api.get('/admin/users'),
  getUser: (userId) => api.get(`/admin/users/${userId}`),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (userId, data) => api.put(`/admin/users/${userId}`, data),
  deleteUser: (userId) => api.delete(`/admin/users/${userId}`),
  hardDeleteUser: (userId) => api.delete(`/admin/users/${userId}/hard-delete`),
  resetUserPin: (userId) => api.post(`/admin/users/${userId}/reset-pin`),
  getActivityLogs: (params) => api.get('/admin/activity-logs', { params }),
  getActivitySummary: () => api.get('/admin/activity-logs/summary'),
  getSettings: () => api.get('/admin/settings'),
  updateSetting: (key, value) => api.put(`/admin/settings/${key}`, { value }),
  getStats: () => api.get('/admin/stats'),
  getDepartments: () => api.get('/admin/departments'),
  createDepartment: (data) => api.post('/admin/departments', data),
  getSpecialties: () => api.get('/admin/specialties'),
  checkMissedAppointments: () => api.post('/admin/check-missed-appointments'),
};

// ==================== DEMO APIs ====================
export const demoAPI = {
  getDemoAccounts: () => api.get('/demo-accounts'),
};

// ==================== FHIR APIs ====================
export const fhirAPI = {
  getPatient: (identifier) => api.get('/fhir/Patient', { params: { identifier } }),
  getAppointments: (patientId, date) => api.get('/fhir/Appointment', { params: { patient: patientId, date } }),
  createServiceRequest: (data) => api.post('/fhir/ServiceRequest', data),
  getCapabilityStatement: () => api.get('/fhir/metadata'),
};

// ==================== AI APIs ====================
export const aiAPI = {
  analyzeReferral: (data) => api.post('/ai/referral/analyze', data),
  getReferralTemplate: (specialty) => api.get(`/ai/referral/template/${specialty}`),
  predictNoShowRisk: (appointmentId) => api.get(`/ai/appointment/${appointmentId}/no-show-risk`),
  getHighRiskAppointments: () => api.get('/ai/appointments/high-risk'),
};

// ==================== ANALYTICS APIs ====================
export const analyticsAPI = {
  getReferralNetwork: () => api.get('/analytics/referral-network'),
  getBottlenecks: () => api.get('/analytics/bottlenecks'),
  getSeasonalTrends: () => api.get('/analytics/seasonal-trends'),
  getHeatmap: () => api.get('/analytics/heatmap'),
  getSpecialistUtilization: () => api.get('/analytics/specialist-utilization'),
  exportAnalytics: (type, format) => api.get(`/analytics/export/${format}`, { params: { type } }),
};

// ==================== TELEMEDICINE APIs ====================
export const telemedicineAPI = {
  createSession: (appointmentId) => api.post('/telemedicine/session/create', { appointment_id: appointmentId }),
  getJoinLink: (sessionId) => api.get(`/telemedicine/session/${sessionId}/join`),
  updateSessionStatus: (sessionId, status) => api.put(`/telemedicine/session/${sessionId}/status`, { status }),
  getActiveSessions: () => api.get('/telemedicine/sessions/active'),
  validateVital: (vitalName, value) => api.post('/telemedicine/vitals/validate', { vital_name: vitalName, value }),
  getVitalTrends: (patientId) => api.get(`/telemedicine/patient/${patientId}/vitals/trend`),
};

// ==================== REGISTRY APIs ====================
export const registryAPI = {
  search: (omang, fullName, phone, email) => api.post('/nurse/registry/search', { omang, full_name: fullName, phone, email }),
  import: (omang, data) => api.post('/nurse/registry/import', { omang, ...data }),
  validateOmang: (omang) => api.post('/validate/omang', { omang }),
};

export default api;