import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { adminLogin, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  if (isAdmin) { navigate('/admin/dashboard'); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminLogin(email, password);
      toast.success('Welcome back!', 'Logged in as Admin.');
      navigate('/admin/dashboard');
    } catch (err) {
      toast.error('Login Failed', err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div className="hero-orb hero-orb-1" style={{ width: '400px', height: '400px', top: '-100px', right: '-100px' }} />
      <div className="hero-orb hero-orb-2" style={{ width: '300px', height: '300px', bottom: '-100px', left: '-100px' }} />
      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        <div className="card" style={{ padding: '48px 40px' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Admin <span className="gradient-text">Login</span></h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>ByteBrainiacs Management Portal</p>
          </div>
          <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Admin Email</label>
              <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@bytebrainiacs.com" autoComplete="off" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="new-password" required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '8px' }}>
              {loading ? '⏳ Logging in...' : '→ Login to Dashboard'}
            </button>
          </form>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '24px' }}>
            Default: admin@bytebrainiacs.com / Admin@1234
          </p>
        </div>
      </div>
    </div>
  );
}
