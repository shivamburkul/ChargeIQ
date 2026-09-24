
import api from './client';

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  adminLogin: (data) => api.post('/auth/admin-login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  deleteAccount: () => api.delete('/auth/me'),
};

export const vehicleApi = {
  catalog: () => api.get('/vehicles/catalog'),
  list: () => api.get('/vehicles'),
  add: (data) => api.post('/vehicles', data),
  update: (id, data) => api.put(`/vehicles/${id}`, data),
  remove: (id) => api.delete(`/vehicles/${id}`),
  setDefault: (id) => api.patch(`/vehicles/${id}/default`),
};

export const stationApi = {
  list: (params) => api.get('/stations', { params }),
  nlpSearch: (query, lat, lng) => api.get('/stations/search/nlp', { params: { query, lat, lng } }),
  recommend: (data) => api.post('/stations/recommend', data),
  compare: (ids) => api.get('/stations/compare', { params: { ids: ids.join(',') } }),
  get: (id) => api.get(`/stations/${id}`),
  myStations: () => api.get('/stations/owner/mine'),
  ownerBookings: () => api.get('/stations/owner/bookings'),
  create: (data) => api.post('/stations', data),
  update: (id, data) => api.put(`/stations/${id}`, data),
  remove: (id) => api.delete(`/stations/${id}`),
  analytics: (id) => api.get(`/stations/${id}/analytics`),
};

export const bookingApi = {
  create: (data) => api.post('/bookings', data),
  list: () => api.get('/bookings'),
  get: (id) => api.get(`/bookings/${id}`),
  start: (id) => api.post(`/bookings/${id}/start`),
  cancel: (id, reason) => api.post(`/bookings/${id}/cancel`, { reason }),
  reschedule: (id, slotStart) => api.post(`/bookings/${id}/reschedule`, { slotStart }),
  progress: (id) => api.get(`/bookings/${id}/progress`),
  invoiceUrl: (id) => `/bookings/${id}/invoice`,
  ownerInvoiceUrl: (bookingId) => `/stations/owner/bookings/${bookingId}/invoice`,
};

export const reviewApi = {
  listForStation: (stationId) => api.get(`/reviews/station/${stationId}`),
  add: (data) => api.post('/reviews', data),
  remove: (id) => api.delete(`/reviews/${id}`),
};

export const notificationApi = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const paymentApi = {
  create: (bookingId) => api.post('/payments', { bookingId }),
  confirm: (paymentId, cardDetails) => api.post(`/payments/${paymentId}/confirm`, cardDetails),
  get: (paymentId) => api.get(`/payments/${paymentId}`),
  forBooking: (bookingId) => api.get(`/payments/booking/${bookingId}`),
};

export const blockchainApi = {
  chain: () => api.get('/blockchain/chain'),
  verify: () => api.get('/blockchain/verify'),
  forBooking: (bookingId) => api.get(`/blockchain/booking/${bookingId}`),
};

export const adminApi = {
  overview: () => api.get('/admin/overview'),
  users: () => api.get('/admin/users'),
  removeUser: (id) => api.delete(`/admin/users/${id}`),
  stations: () => api.get('/admin/stations'),
  toggleStation: (id) => api.patch(`/admin/stations/${id}/toggle`),
  approveStation: (id) => api.patch(`/admin/stations/${id}/approve`),
  rejectStation: (id) => api.delete(`/admin/stations/${id}/reject`),
  bookings: () => api.get('/admin/bookings'),
  bookingInvoiceUrl: (bookingId) => `/admin/bookings/${bookingId}/invoice`,
  activity: () => api.get('/admin/activity'),
};

export const plannerApi = {
  plan: (data) => api.post('/planner', data),
};
