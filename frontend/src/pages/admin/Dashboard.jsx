import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './Admin.css';

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#6366f1'];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/dashboard/stats'),
      axios.get('/api/dashboard/chart-data'),
      axios.get('/api/dashboard/activity-logs'),
    ]).then(([s, c, l]) => {
      setStats(s.data.stats);
      setCharts(c.data);
      setLogs(l.data.logs);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const statCards = [
    { label: 'Total Registrations', value: stats.totalParticipants, icon: '👥', color: 'var(--violet)', bg: 'rgba(99,102,241,0.1)' },
    { label: 'Total Teams', value: stats.totalTeams, icon: '🏆', color: 'var(--cyan)', bg: 'rgba(6,182,212,0.1)' },
    { label: 'Approved', value: stats.approved, icon: '✅', color: 'var(--green)', bg: 'rgba(34,197,94,0.1)' },
    { label: 'Rejected', value: stats.rejected, icon: '❌', color: 'var(--red)', bg: 'rgba(239,68,68,0.1)' },
    { label: 'Pending', value: stats.pending, icon: '⏳', color: 'var(--gold)', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Waiting for Team', value: stats.waitingForTeam, icon: '🔄', color: 'var(--violet-light)', bg: 'rgba(129,140,248,0.1)' },
  ];

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-main">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Welcome back, <strong>{user?.name}</strong></p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <a href="/api/participants/export" className="btn btn-outline btn-sm">⬇ Export Excel</a>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          {statCards.map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        {charts && (
          <div className="grid-2" style={{ gap: '24px', marginBottom: '32px' }}>
            <div className="card">
              <h3 style={{ marginBottom: '24px', fontSize: '16px' }}>📊 Registrations (Last 7 Days)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={charts.registrationsOverTime}>
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-primary)' }} />
                  <Bar dataKey="count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>🥧 Status Breakdown</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flex: 1, gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ width: '150px', height: '150px', flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.statusBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        dataKey="value"
                        label={false}
                      >
                        {charts.statusBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '150px' }}>
                  {charts.statusBreakdown.map((item, i) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{item.name}:</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activity Log */}
        <div className="card">
          <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>🕒 Recent Activity</h3>
          {logs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>No activity yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {logs.slice(0, 10).map(l => (
                <div key={l._id} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--violet)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{l.action}</span>
                    {l.targetName && <span style={{ color: 'var(--violet-light)', fontSize: '14px' }}> — {l.targetName}</span>}
                    {l.details && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{l.details}</p>}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {new Date(l.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  const { logout } = useAuth();
  const links = [
    { to: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/admin/participants', icon: '👥', label: 'Participants' },
    { to: '/admin/teams', icon: '🏆', label: 'Teams' },
    { to: '/admin/team-allocation', icon: '🔗', label: 'Team Allocation' },
    { to: '/admin/previous-participants', icon: '📚', label: 'Previous Participants' },
  ];
  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <span style={{ fontSize: '24px' }}>⚡</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '14px', background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>ByteBrainiacs</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Admin Panel</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {links.map(l => (
          <Link key={l.to} to={l.to} className="sidebar-link">
            <span>{l.icon}</span> {l.label}
          </Link>
        ))}
      </nav>
      <button className="sidebar-logout" onClick={logout}>🚪 Logout</button>
    </aside>
  );
}
