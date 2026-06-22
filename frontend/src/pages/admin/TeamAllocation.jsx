import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import { AdminSidebar } from './Dashboard';
import './Admin.css';

export default function TeamAllocation() {
  const [individuals, setIndividuals] = useState([]);
  const [selected, setSelected] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const toast = useToast();

  const fetchIndividuals = () => {
    setLoading(true);
    axios.get('/api/teams/approved-individuals')
      .then(r => setIndividuals(r.data.individuals))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchIndividuals(); }, []);

  const toggleSelect = (id) => {
    setSelected(s =>
      s.includes(id) ? s.filter(x => x !== id) : s.length < 3 ? [...s, id] : s
    );
  };

  const allocate = async () => {
    if (selected.length < 2 || selected.length > 3) return toast.error('Select 2 or 3', 'Please select 2 or 3 participants.');
    if (!teamName.trim()) return toast.error('Team name required', 'Enter a team name.');
    setSubmitting(true);
    try {
      await axios.post('/api/teams/allocate', { memberIds: selected, teamName: teamName.trim() });
      setSuccessMsg(teamName.trim());
      toast.success('Team Allocated!', `Team "${teamName.trim()}" created. Members notified via email.`);
      // Remove allocated members from list
      setIndividuals(prev => prev.filter(x => !selected.includes(x._id)));
      setSelected([]);
      setTeamName('');
    } catch (err) {
      toast.error('Error', err.response?.data?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-main">

        {/* Header */}
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Team Allocation</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Select 2 or 3 approved individuals to form a team
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={fetchIndividuals}>↻ Refresh</button>
        </div>

        {/* Success Banner */}
        {successMsg && (
          <div style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '12px', padding: '16px 20px', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>✅</span>
            <p style={{ color: '#4ade80', fontSize: '14px' }}>
              Team "<strong>{successMsg}</strong>" was successfully created! All members have been notified via email.
            </p>
            <button onClick={() => setSuccessMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'flex-start' }}>

          {/* ── Individuals Pool ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--violet-light)' }}>
                Approved Individuals <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({individuals.length} available)</span>
              </h3>
              {selected.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>Clear selection</button>
              )}
            </div>

            {loading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : individuals.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
                <h3>No eligible individuals</h3>
                <p>Approve some individual registrations first, then return here to allocate teams.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '65vh', overflowY: 'auto', paddingRight: '4px' }}>
                {individuals.map(p => {
                  const isSelected = selected.includes(p._id);
                  const selIdx = selected.indexOf(p._id);
                  const maxReached = selected.length >= 3 && !isSelected;
                  return (
                    <div key={p._id}
                      onClick={() => !maxReached && toggleSelect(p._id)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: `2px solid ${isSelected ? 'var(--violet)' : 'var(--border)'}`,
                        background: isSelected ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                        cursor: maxReached ? 'not-allowed' : 'pointer',
                        opacity: maxReached ? 0.5 : 1,
                        transition: 'var(--transition)',
                        display: 'flex', alignItems: 'center', gap: '14px',
                      }}>
                      {/* Selection number badge */}
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                        background: isSelected ? 'var(--violet)' : 'rgba(255,255,255,0.05)',
                        border: `2px solid ${isSelected ? 'var(--violet)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: 700,
                        color: isSelected ? '#fff' : 'var(--text-muted)',
                        transition: 'var(--transition)',
                      }}>
                        {isSelected ? selIdx + 1 : '○'}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{p.fullName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {p.college} &nbsp;·&nbsp; {p.yearOfStudy} &nbsp;·&nbsp; {p.city || 'Mumbai'}
                        </div>
                      </div>

                      {isSelected && (
                        <span style={{ fontSize: '11px', background: 'var(--violet)', color: '#fff', padding: '2px 8px', borderRadius: '100px', flexShrink: 0 }}>
                          Member {selIdx + 1}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Allocation Panel ── */}
          <div className="card" style={{ position: 'sticky', top: '100px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '24px', color: 'var(--violet-light)' }}>
              🔗 Create Team
            </h3>

            {/* Progress indicator */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Members selected</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: selected.length >= 2 ? 'var(--green)' : 'var(--gold)' }}>
                  {selected.length} / 3 (Min 2)
                </span>
              </div>
              <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '3px',
                  width: `${(selected.length / 3) * 100}%`,
                  background: selected.length >= 2 ? 'var(--green)' : 'var(--grad-primary)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Selected members list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {[0, 1, 2].map(i => {
                const memberId = selected[i];
                const member = memberId ? individuals.find(x => x._id === memberId) : null;
                return (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: '8px',
                    background: member ? 'var(--bg-secondary)' : 'rgba(255,255,255,0.02)',
                    border: `1px dashed ${member ? 'var(--border-hover)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', gap: '10px',
                    minHeight: '46px',
                  }}>
                    <span style={{
                      width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                      background: member ? 'var(--violet)' : 'rgba(99,102,241,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700,
                      color: member ? '#fff' : 'var(--text-muted)',
                    }}>{i + 1}</span>
                    {member ? (
                      <>
                        <span style={{ fontSize: '13px', fontWeight: 500, flex: 1 }}>{member.fullName}</span>
                        <button onClick={() => toggleSelect(memberId)}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>×</button>
                      </>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Select from list...</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Team name */}
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Team Name <span style={{ color: 'var(--red)' }}>*</span></label>
              <input
                type="text"
                className="form-input"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="e.g. NeuralNinjas"
              />
            </div>

            {/* Submit */}
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={selected.length < 2 || !teamName.trim() || submitting}
              onClick={allocate}
            >
              {submitting ? '⏳ Allocating...' : '🔗 Allocate Team & Notify Members'}
            </button>

            {selected.length < 2 && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px' }}>
                {2 - selected.length} more member{2 - selected.length !== 1 ? 's' : ''} needed minimum
              </p>
            )}

            {/* Info box */}
            <div style={{
              marginTop: '20px', padding: '12px 14px',
              background: 'rgba(6,182,212,0.08)', borderRadius: '8px',
              border: '1px solid rgba(6,182,212,0.2)',
              fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6'
            }}>
              📧 Once allocated, all members will automatically receive a team notification email with teammate details.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
