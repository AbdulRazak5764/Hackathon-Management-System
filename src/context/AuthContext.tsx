import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type UserRole = 'STUDENT' | 'SPOC_ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  college_name: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  isSpocAdmin: boolean;
  loginStudent: (email: string, pass: string) => Promise<{ error?: string }>;
  signupStudent: (email: string, pass: string, name: string, college: string) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  loginAdmin: (email: string, pass: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  updatePassword: (newPass: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if SPOC master session stored locally
    const savedSpocSession = localStorage.getItem('sih_spoc_master_session');
    if (savedSpocSession) {
      try {
        const parsed = JSON.parse(savedSpocSession);
        const prof = parsed.profile || parsed;
        const usr = parsed.user || { id: 'spoc-admin-master-id', email: 'rpkumar2024@chaitanya.edu.in' };

        if (prof.email === 'rpkumar2024@chaitanya.edu.in') {
          setUser(usr as any);
          setProfile(prof);
          setLoading(false);
        }
      } catch (e) {}
    }

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email ?? '');
      } else {
        setLoading(false);
      }
    });

    // Listen to Auth State changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id, session.user.email ?? '');
      } else {
        if (!localStorage.getItem('sih_spoc_master_session')) {
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist yet, check if SPOC Admin default email
        const isSpocEmail = email.toLowerCase() === 'rpkumar2024@chaitanya.edu.in';
        const newRole: UserRole = isSpocEmail ? 'SPOC_ADMIN' : 'STUDENT';
        const newProf: UserProfile = {
          id: userId,
          email: email,
          role: newRole,
          full_name: isSpocEmail ? 'Dr R Praveen Kumar (SPOC)' : email.split('@')[0],
          college_name: 'Chaitanya (Deemed to be University)',
        };

        await supabase.from('user_profiles').insert(newProf);
        setProfile(newProf);
      } else if (data) {
        setProfile(data as UserProfile);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const loginStudent = async (email: string, pass: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase credentials not configured in environment.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return { error: error.message };

    // Check if user is SPOC Admin trying to use student portal login
    const { data: prof } = await supabase.from('user_profiles').select('role').eq('id', data.user.id).single();
    if (prof?.role === 'SPOC_ADMIN') {
      return { error: 'Admin accounts must log in via the College SPOC Portal.' };
    }
    return {};
  };

  const signupStudent = async (email: string, pass: string, name: string, college: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase credentials not configured.' };
    
    // Controlled signup - ALWAYS forces role = 'STUDENT'
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { full_name: name, college_name: college, role: 'STUDENT' }
      }
    });

    if (error) return { error: error.message };

    // Check if user email is already registered in Supabase
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return { error: 'An account with this email is already registered. Please log in.' };
    }

    if (data.user) {
      const newProf: UserProfile = {
        id: data.user.id,
        email,
        role: 'STUDENT',
        full_name: name,
        college_name: college,
      };
      await supabase.from('user_profiles').upsert(newProf);

      // Sign out session so student must log in manually
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    }
    return {};
  };

  const loginAdmin = async (email: string, pass: string) => {
    const authorizedSpocEmail = 'rpkumar2024@chaitanya.edu.in';
    const authorizedSpocPass = 'SIH@2026';

    // Strict security check: Only authorized SPOC Admin email can log in via Admin Portal
    if (email.toLowerCase().trim() !== authorizedSpocEmail.toLowerCase()) {
      return { error: 'Access Denied: Only authorized SPOC Admin (rpkumar2024@chaitanya.edu.in) can log in to SPOC Portal.' };
    }

    if (!isSupabaseConfigured) {
      if (pass === authorizedSpocPass) {
        const spocMasterProf: UserProfile = {
          id: 'spoc-admin-master-id',
          email: authorizedSpocEmail,
          role: 'SPOC_ADMIN',
          full_name: 'Dr R Praveen Kumar (SPOC)',
          college_name: 'Chaitanya (Deemed to be University)',
        };
        const masterUser: any = {
          id: 'spoc-admin-master-id',
          email: authorizedSpocEmail,
          role: 'authenticated',
          aud: 'authenticated',
          app_metadata: { provider: 'email' },
          user_metadata: { full_name: 'Dr R Praveen Kumar (SPOC)', role: 'SPOC_ADMIN' },
          created_at: new Date().toISOString(),
        };
        setUser(masterUser);
        setProfile(spocMasterProf);
        localStorage.setItem('sih_spoc_master_session', JSON.stringify({ user: masterUser, profile: spocMasterProf }));
        return {};
      }
      return { error: 'Supabase credentials not configured in environment.' };
    }

    let { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

    // Auto-bootstrap permanent SPOC Admin account if logging in for the first time
    if (error && email.toLowerCase() === authorizedSpocEmail.toLowerCase()) {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: { full_name: 'Dr R Praveen Kumar (SPOC)', role: 'SPOC_ADMIN' }
        }
      });

      if (!signUpErr && signUpData.user) {
        const spocProf: UserProfile = {
          id: signUpData.user.id,
          email,
          role: 'SPOC_ADMIN',
          full_name: 'Dr R Praveen Kumar (SPOC)',
          college_name: 'Chaitanya (Deemed to be University)',
        };
        await supabase.from('user_profiles').upsert(spocProf);
        setProfile(spocProf);

        const retryRes = await supabase.auth.signInWithPassword({ email, password: pass });
        if (!retryRes.error) {
          data = retryRes.data;
          error = null;
        }
      }
    }

    // GUARANTEED SPOC MASTER LOGIN (If password matches SIH@2026):
    if (error && pass === authorizedSpocPass) {
      const spocMasterProf: UserProfile = {
        id: 'spoc-admin-master-id',
        email: authorizedSpocEmail,
        role: 'SPOC_ADMIN',
        full_name: 'Dr R Praveen Kumar (SPOC)',
        college_name: 'Chaitanya (Deemed to be University)',
      };
      const masterUser: any = {
        id: 'spoc-admin-master-id',
        email: authorizedSpocEmail,
        role: 'authenticated',
        aud: 'authenticated',
        app_metadata: { provider: 'email' },
        user_metadata: { full_name: 'Dr R Praveen Kumar (SPOC)', role: 'SPOC_ADMIN' },
        created_at: new Date().toISOString(),
      };
      setUser(masterUser);
      setProfile(spocMasterProf);
      localStorage.setItem('sih_spoc_master_session', JSON.stringify({ user: masterUser, profile: spocMasterProf }));
      return {};
    }

    if (error) return { error: error.message };

    // Verify and enforce SPOC Admin Role
    const { data: prof } = await supabase.from('user_profiles').select('*').eq('id', data.user.id).single();
    if (prof) {
      if (prof.role !== 'SPOC_ADMIN') {
        if (email.toLowerCase() === authorizedSpocEmail.toLowerCase()) {
          await supabase.from('user_profiles').update({ role: 'SPOC_ADMIN' }).eq('id', data.user.id);
          prof.role = 'SPOC_ADMIN';
          setProfile(prof as UserProfile);
        } else {
          await supabase.auth.signOut();
          return { error: 'Access Denied: Only authorized SPOC Admin can access the Admin Portal.' };
        }
      } else {
        setProfile(prof as UserProfile);
      }
    } else {
      const fallbackProf: UserProfile = {
        id: data.user.id,
        email: authorizedSpocEmail,
        role: 'SPOC_ADMIN',
        full_name: 'Dr R Praveen Kumar (SPOC)',
        college_name: 'Chaitanya (Deemed to be University)',
      };
      setProfile(fallbackProf);
    }

    // Also persist master session so user remains logged in seamlessly
    const masterUser: any = {
      id: data.user.id,
      email: authorizedSpocEmail,
      role: 'authenticated',
    };
    const spocProf: UserProfile = {
      id: data.user.id,
      email: authorizedSpocEmail,
      role: 'SPOC_ADMIN',
      full_name: 'Dr R Praveen Kumar (SPOC)',
      college_name: 'Chaitanya (Deemed to be University)',
    };
    localStorage.setItem('sih_spoc_master_session', JSON.stringify({ user: masterUser, profile: spocProf }));

    return {};
  };

  const logout = async () => {
    localStorage.removeItem('sih_spoc_master_session');
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
  };

  const updatePassword = async (newPass: string) => {
    if (!isSupabaseConfigured) return { error: 'Supabase credentials not configured.' };
    const { error } = await supabase.auth.updateUser({ password: newPass });
    return error ? { error: error.message } : {};
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isConfigured: isSupabaseConfigured,
        isSpocAdmin: profile?.role === 'SPOC_ADMIN' || profile?.email === 'rpkumar2024@chaitanya.edu.in',
        loginStudent,
        signupStudent,
        loginAdmin,
        logout,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
