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

export const proofsAPI = {
  // Direct proof generation endpoint that works with Supabase transaction format
  generateDirect: async (transactions: any[]) => {
    const mappedTransactions = transactions.map(tx => {
      // Map M-Pesa transaction types to RISC Zero expected types
      let mappedType = tx.transaction_type || 'Payment';
      if (mappedType.toLowerCase() === 'received') {
        mappedType = 'Payment';
      } else if (mappedType.toLowerCase() === 'reversal') {
        mappedType = 'Reversal';
      } else {
        // For 'sent', 'withdrawal', etc., only include if they're payments
        // Otherwise filter them out by not including them
        mappedType = 'Payment'; // Default to Payment for now
      }

      const timestamp = new Date(tx.transaction_date).getTime() / 1000; // Convert to seconds
      // Amount is stored in KSh, convert to cents (multiply by 100)
      // Ensure amount is positive and valid
      const amountInKsh = Math.abs(parseFloat(tx.amount) || 0);
      const amount = Math.round(amountInKsh * 100); // Convert to cents

      // Skip transactions with zero or invalid amounts
      if (amount === 0 || isNaN(timestamp) || timestamp <= 0) {
        return null;
      }

      return {
        timestamp,
        amount,
        transaction_type: mappedType,
        reference: tx.customer_hash || '',
      };
    })
    .filter((tx): tx is NonNullable<typeof tx> => tx !== null)
    .filter(tx => tx.transaction_type === 'Payment' || tx.transaction_type === 'Reversal');

    // Debug: Log what's being sent to backend
    console.log('Sending to backend:', {
      total: transactions.length,
      filtered: mappedTransactions.length,
      sample: mappedTransactions.slice(0, 3),
      amounts: mappedTransactions.map(t => t.amount),
      types: [...new Set(mappedTransactions.map(t => t.transaction_type))]
    });

    const response = await api.post('/api/proofs/generate-direct', {
      transactions: mappedTransactions,
    });
    return response.data;
  },
  // Original endpoint (requires till_id)
  generate: async (tillId: string, dataSource: string = 'upload') => {
    const response = await api.post('/api/proofs/generate', {
      till_id: tillId,
      data_source: dataSource,
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
};

export default api;
