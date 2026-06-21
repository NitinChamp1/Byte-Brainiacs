import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

const Home = lazy(() => import('./pages/Home'));
const Register = lazy(() => import('./pages/Register'));
const PreviousParticipants = lazy(() => import('./pages/PreviousParticipants'));
const Rules = lazy(() => import('./pages/Rules'));
const Contact = lazy(() => import('./pages/Contact'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const ParticipantList = lazy(() => import('./pages/admin/ParticipantList'));
const TeamAllocation = lazy(() => import('./pages/admin/TeamAllocation'));
const PreviousParticipantsAdmin = lazy(() => import('./pages/admin/PreviousParticipantsAdmin'));
const TeamList = lazy(() => import('./pages/admin/TeamList'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
    Loading...
  </div>
);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Navbar />
            <div className="page-content">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  <Route path="/payment-cancel" element={<PaymentCancel />} />
                  <Route path="/previous-participants" element={<PreviousParticipants />} />
                  <Route path="/rules" element={<Rules />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/admin" element={<ProtectedRoute />}>
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="participants" element={<ParticipantList />} />
                    <Route path="teams" element={<TeamList />} />
                    <Route path="team-allocation" element={<TeamAllocation />} />
                    <Route path="previous-participants" element={<PreviousParticipantsAdmin />} />
                  </Route>
                </Routes>
              </Suspense>
            </div>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
