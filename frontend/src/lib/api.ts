import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle API errors gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const authAPI = {
  requestOTP: async (phoneNumber: string) => {
    const response = await api.post('/api/auth/request-otp', { phone_number: phoneNumber });
    return response.data;
  },
  verifyOTP: async (phoneNumber: string, otp: string) => {
    const response = await api.post('/api/auth/verify-otp', { phone_number: phoneNumber, otp });
    return response.data;
  },
};

export const tillsAPI = {
  register: async (tillNumber: string, tillType: 'BuyGoods' | 'PayBill') => {
    const response = await api.post('/api/tills/register', { till_number: tillNumber, till_type: tillType });
    return response.data;
  },
  list: async () => {
    const response = await api.get('/api/tills');
    return response.data;
  },
  verify: async (tillId: string, verificationCode?: string) => {
    const response = await api.post('/api/tills/verify', { till_id: tillId, verification_code: verificationCode });
    return response.data;
  },
};

export const proofsAPI = {
  generate: async (tillId: string, dataSource: string, dateRange?: { from: string; to: string }) => {
    const response = await api.post('/api/proofs/generate', {
      till_id: tillId,
      data_source: dataSource,
      date_range: dateRange,
    });
    return response.data;
  },
  getStatus: async (sessionId: string) => {
    const response = await api.get(`/api/proofs/status/${sessionId}`);
    return response.data;
  },
  getResult: async (sessionId: string) => {
    const response = await api.get(`/api/proofs/result/${sessionId}`);
    return response.data;
  },
  list: async () => {
    const response = await api.get('/api/proofs');
    return response.data;
  },
};

export const dataAPI = {
  upload: async (tillId: string, file: File) => {
    const formData = new FormData();
    formData.append('till_id', tillId);
    formData.append('file', file);

    const response = await api.post('/api/data/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default api;

