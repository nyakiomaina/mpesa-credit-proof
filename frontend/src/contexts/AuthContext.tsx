import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, businessData: BusinessData) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

interface BusinessData {
  business_name: string;
  contact_email: string;
  kra_pin?: string;
  registration_number?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase environment variables are missing. Some features may not work.');
      setLoading(false);
      return () => {}; // Return empty cleanup function
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, businessData: BusinessData) => {
    try {
      // Sign up with business data in metadata
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            business_name: businessData.business_name,
            kra_pin: businessData.kra_pin,
            registration_number: businessData.registration_number,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('User creation failed');

      // The trigger will create the business record automatically
      // But if it doesn't exist yet, try to create it
      // Wait a moment for the trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if business record exists, if not create it
      const { data: existingBusiness } = await supabase
        .from('businesses')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (!existingBusiness) {
        // Try to insert - this might fail if RLS blocks it, but trigger should have created it
        const { error: businessError } = await supabase
          .from('businesses')
          .insert({
            id: data.user.id,
            business_name: businessData.business_name,
            contact_email: businessData.contact_email,
            kra_pin: businessData.kra_pin || null,
            registration_number: businessData.registration_number || null,
          } as any);

        // If insert fails due to RLS, the trigger should have created it
        // So we'll try to update it instead
        if (businessError && businessError.code !== '23505') {
          // Try to update instead (in case trigger created it with default values)
          const { error: updateError } = await ((supabase
            .from('businesses') as any)
            .update({
              business_name: businessData.business_name,
              contact_email: businessData.contact_email,
              kra_pin: businessData.kra_pin || null,
              registration_number: businessData.registration_number || null,
            } as any)
            .eq('id', data.user.id) as any) as any;

          if (updateError && !updateError.message.includes('row-level security')) {
            throw updateError;
          }
        }
      } else {
        // Update existing business record with full details
        const { error: updateError } = await ((supabase
          .from('businesses') as any)
          .update({
            business_name: businessData.business_name,
            contact_email: businessData.contact_email,
            kra_pin: businessData.kra_pin || null,
            registration_number: businessData.registration_number || null,
          } as any)
          .eq('id', data.user.id) as any) as any;

        if (updateError) throw updateError;
      }

      // Get session if available
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        setSession(sessionData.session);
        setUser(sessionData.session.user);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
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
