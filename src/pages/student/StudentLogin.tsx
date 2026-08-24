import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Award, UserCheck, Lock, Mail, ArrowRight, ShieldCheck, UserPlus, Building } from 'lucide-react';

export const StudentLogin: React.FC = () => {
  const { loginStudent, signupStudent } = useAuth();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [collegeName, setCollegeName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setLoading(true);

    if (isSignup) {
      if (!fullName || !collegeName) {
        setError('Please enter your full name and college name.');
        setLoading(false);
        return;
      }
      const res = await signupStudent(email, password, fullName, collegeName);
      if (res.error) {
        setError(res.error);
      } else {
        setInfoMsg('Registration Successful! Account created. Please enter your password to log in.');
        setIsSignup(false);
        setPassword('');
      }
    } else {
      const res = await loginStudent(email, password);
      if (res.error) {
        if (res.error.toLowerCase().includes('email not confirmed')) {
          setError('Email not confirmed by Supabase Auth. To fix: Go to Supabase Dashboard -> Authentication -> Providers -> Email and turn off "Confirm email", or confirm the user email in Authentication -> Users.');
        } else {
          setError(res.error);
        }
      } else {
        navigate('/student/dashboard');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20 mb-3">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <UserCheck className="w-7 h-7 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {isSignup ? 'Student Team Registration' : 'Student Lead Login'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Smart India Hackathon 2026 Submission Portal
          </p>
        </div>

        {infoMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-800 text-emerald-300 text-xs flex items-start space-x-2 shadow-lg">
            <span className="font-bold">✓ Success:</span>
            <span>{infoMsg}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2">
            <span className="font-semibold">Error:</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name (Team Lead)</label>
                <div className="relative">
                  <UserPlus className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                    placeholder="e.g. Ananya Sharma"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">College / University Name</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={collegeName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCollegeName(e.target.value)}
                    placeholder="e.g. St. Xavier Engineering College"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">College Email / Student Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="student@college.edu"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 mt-2"
          >
            <span>{loading ? 'Authenticating...' : isSignup ? 'Create Student Account' : 'Log In to Portal'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center flex flex-col space-y-2">
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setError(null);
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            {isSignup ? 'Already registered? Log In here' : 'New Team? Create Student Account'}
          </button>

          <Link
            to="/admin/login"
            className="text-[11px] text-slate-500 hover:text-amber-400 transition-colors flex items-center justify-center space-x-1 pt-2"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>Are you a College SPOC Admin? Log In here</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
