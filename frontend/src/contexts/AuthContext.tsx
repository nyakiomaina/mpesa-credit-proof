import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authAPI } from '../lib/api';

interface User {
  id: string;
  phone_number: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  requestOTP: (phoneNumber: string) => Promise<{ error: Error | null }>;
  verifyOTP: (phoneNumber: string, otp: string) => Promise<{ error: Error | null }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const requestOTP = async (phoneNumber: string) => {
    try {
      await authAPI.requestOTP(phoneNumber);
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const verifyOTP = async (phoneNumber: string, otp: string) => {
    try {
      const response = await authAPI.verifyOTP(phoneNumber, otp);
      setToken(response.token);
      setUser(response.user);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, requestOTP, verifyOTP, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
