import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { StudentLogin } from './pages/student/StudentLogin';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminAnalytics } from './pages/admin/AdminAnalytics';

export function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <div className="min-h-screen bg-slate-950 flex flex-col justify-between selection:bg-cyan-500 selection:text-white transition-colors duration-300">
            <div>
              <Navbar />
              <main>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  
                  {/* Student Routes */}
                  <Route path="/student/login" element={<StudentLogin />} />
                  <Route
                    path="/student/dashboard"
                    element={
                      <ProtectedRoute requireRole="STUDENT">
                        <StudentDashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* SPOC Admin Routes */}
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route
                    path="/admin/dashboard"
                    element={
                      <ProtectedRoute requireRole="SPOC_ADMIN">
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/analytics"
                    element={
                      <ProtectedRoute requireRole="SPOC_ADMIN">
                        <AdminAnalytics />
                      </ProtectedRoute>
                    }
                  />

                  {/* Catch-all Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>

            <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-400 bg-slate-950 transition-colors">
              <p className="font-semibold text-slate-300">
                Powered by Department of Computer Science & Engineering (CSE)
              </p>
            </footer>
          </div>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
