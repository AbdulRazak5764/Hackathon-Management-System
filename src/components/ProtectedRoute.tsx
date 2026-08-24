import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { AlertTriangle, Database, ShieldAlert, Terminal } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireRole }) => {
  const { user, profile, loading, isConfigured } = useAuth();

  if (!isConfigured) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-slate-900 border border-amber-500/40 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center space-x-3 text-amber-400 mb-4">
            <AlertTriangle className="w-7 h-7" />
            <h2 className="text-xl font-bold text-white">Database Environment Setup Required</h2>
          </div>

          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            This production application requires a real Supabase database backend and environment variables. 
            No fake data or local fallback is used to ensure real persistent authentication and file uploads.
          </p>

          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3 font-mono text-xs mb-6">
            <div className="flex items-center space-x-2 text-cyan-400 font-sans font-semibold">
              <Terminal className="w-4 h-4" />
              <span>Required Environment Variables (.env or Netlify Settings)</span>
            </div>
            <div className="text-slate-400">VITE_SUPABASE_URL=https://your-project.supabase.co</div>
            <div className="text-slate-400">VITE_SUPABASE_ANON_KEY=eyJhbGciOi...</div>
          </div>

          <div className="space-y-3 text-xs text-slate-400 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="font-semibold text-slate-200 flex items-center space-x-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Initial SPOC Admin Seed Setup Instructions:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>Run the provided <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">supabase_schema.sql</code> script in your Supabase SQL Editor.</li>
              <li>Create user account with email <code className="text-amber-300 font-semibold">ramagiri.praveen594@gmail.com</code> and password <code className="text-amber-300 font-semibold">SIH@2026</code>.</li>
              <li>Set <code className="text-cyan-300">role = 'SPOC_ADMIN'</code> in <code className="text-cyan-300">public.user_profiles</code> for the SPOC Admin email.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-xs font-semibold text-cyan-400 animate-pulse">Verifying Security Session...</p>
        </div>
      </div>
    );
  }

  const isAuthenticated = Boolean(user || (profile && profile.role === 'SPOC_ADMIN'));

  if (!isAuthenticated) {
    return <Navigate to={requireRole === 'SPOC_ADMIN' ? '/admin/login' : '/student/login'} replace />;
  }

  if (requireRole && profile) {
    if (requireRole === 'SPOC_ADMIN' && profile.role !== 'SPOC_ADMIN') {
      return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-800/80 rounded-2xl p-8 max-w-md text-center shadow-2xl">
            <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-xs text-slate-400 mb-6">
              You do not have permission to access the SPOC Admin portal. Student accounts are restricted to the Student Dashboard.
            </p>
            <Navigate to="/student/dashboard" replace />
          </div>
        </div>
      );
    }

    if (requireRole === 'STUDENT' && profile.role === 'SPOC_ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
