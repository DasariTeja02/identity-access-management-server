import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { sessionService, adminSessionService } from '../services/api';
import AlertBanner from './AlertBanner';
import {
  Shield,
  Laptop,
  Smartphone,
  Globe,
  Clock,
  LogOut,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Activity,
  UserX,
  Search,
  CheckCircle,
  Database
} from 'lucide-react';

export default function SessionManagement() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [adminSessions, setAdminSessions] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminTab, setAdminTab] = useState('sessions'); // 'sessions' or 'events'

  const isAdmin = user?.roles?.some((r) => r.name === 'ROLE_ADMIN' || r === 'ROLE_ADMIN');

  const fetchSessionData = useCallback(async () => {
    setError(null);
    try {
      setRefreshing(true);
      // 1. Fetch user active sessions
      const res = await sessionService.getSessions();
      setSessions(res.data || []);

      // 2. If admin, fetch all sessions and security events
      if (isAdmin) {
        try {
          const adminRes = await adminSessionService.getAllSessions();
          setAdminSessions(adminRes.data || []);

          const eventsRes = await adminSessionService.getSecurityEvents();
          setSecurityEvents(eventsRes.data || []);
        } catch (adminErr) {
          console.warn('Could not fetch admin session data:', adminErr);
        }
      }
    } catch (err) {
      if (err.status === 503) {
        setError('Redis session store is temporarily unavailable. Please verify Redis connectivity.');
      } else if (err.status === 401) {
        setError('Your session has expired or was revoked. Please log in again.');
      } else {
        setError(err.message || 'Failed to fetch session information.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  // Handle individual session revocation
  const handleRevokeSession = async (sessionId, isCurrent) => {
    if (isCurrent) {
      if (window.confirm('Revoking your current session will immediately log you out. Continue?')) {
        await handleLogoutCurrent();
      }
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await sessionService.revokeSession(sessionId);
      setSuccess('Session revoked successfully.');
      await fetchSessionData();
    } catch (err) {
      setError('Could not revoke session: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Logout Current Session
  const handleLogoutCurrent = async () => {
    try {
      setActionLoading(true);
      await logout();
    } catch (err) {
      setError('Logout failed: ' + (err.message || 'Error'));
      setActionLoading(false);
    }
  };

  // Handle Logout All Sessions
  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to log out of ALL devices and sessions? This will invalidate all your tokens.')) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await sessionService.logoutAll();
      setSuccess('All sessions revoked. Redirecting to login...');
      setTimeout(() => {
        logout();
      }, 1000);
    } catch (err) {
      setError('Could not revoke all sessions: ' + (err.message || 'Error'));
      setActionLoading(false);
    }
  };

  // Admin: Revoke session for any user
  const handleAdminRevoke = async (sessionId) => {
    try {
      setActionLoading(true);
      setError(null);
      await adminSessionService.revokeSession(sessionId);
      setSuccess('Session revoked by administrator.');
      await fetchSessionData();
    } catch (err) {
      setError('Admin revoke failed: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Format relative time
  const formatTime = (isoString) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const currentSession = sessions.find((s) => s.current);
  const otherSessions = sessions.filter((s) => !s.current);

  const filteredAdminSessions = adminSessions.filter((s) =>
    !searchQuery ||
    s.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.ipAddress?.includes(searchQuery) ||
    s.browser?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div className="glass-panel" style={{ padding: '1.75rem', borderLeft: '4px solid #10b981' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              <Shield size={16} />
              <span>PHASE 4: REAL-TIME SESSION & TOKEN MANAGEMENT</span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
              Session & Security Dashboard
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.35rem', margin: 0 }}>
              Authenticated sessions tracked via PostgreSQL durable audit & Redis high-performance revocation blacklist.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={fetchSessionData}
              className="btn-secondary"
              disabled={refreshing || actionLoading}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
            >
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              <span>Refresh Sessions</span>
            </button>
            <button
              onClick={handleLogoutAll}
              className="btn-danger"
              disabled={actionLoading}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
            >
              <Trash2 size={14} />
              <span>Logout All Sessions</span>
            </button>
          </div>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}
      {success && <AlertBanner type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* CURRENT SESSION CARD */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              {currentSession?.deviceType === 'Mobile' ? <Smartphone size={20} /> : <Laptop size={20} />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Current Session</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>The device and browser you are currently using</span>
            </div>
          </div>

          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
            ACTIVE (THIS DEVICE)
          </span>
        </div>

        {currentSession ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Device</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, fontSize: '0.9375rem' }}>{currentSession.deviceType || 'Desktop'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Browser</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, fontSize: '0.9375rem' }}>{currentSession.browser || 'Unknown'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Operating System</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, fontSize: '0.9375rem' }}>{currentSession.operatingSystem || 'Unknown'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Application</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, fontSize: '0.9375rem', color: '#8b5cf6' }}>{currentSession.clientName || 'iam-web-portal'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>IP Address</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, fontSize: '0.9375rem', fontFamily: 'monospace' }}>{currentSession.ipAddress || '127.0.0.1'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, fontSize: '0.9375rem' }}>{formatTime(currentSession.createdAt)}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Active</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, fontSize: '0.9375rem' }}>{formatTime(currentSession.lastActiveAt)}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, fontSize: '0.9375rem', color: '#10b981' }}>{currentSession.status}</p>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
            {loading ? 'Loading current session details...' : 'Current session state established.'}
          </div>
        )}

        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={handleLogoutCurrent}
            className="btn-danger"
            disabled={actionLoading}
            style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
          >
            <LogOut size={14} />
            <span>Logout Current Session</span>
          </button>
        </div>
      </div>

      {/* OTHER ACTIVE SESSIONS */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Other Active Sessions</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Other devices and browsers currently authenticated with your credentials
            </span>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Total: <strong>{otherSessions.length}</strong>
          </span>
        </div>

        {otherSessions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <CheckCircle size={32} style={{ color: '#10b981', margin: '0 auto 0.75rem' }} />
            <p style={{ margin: 0, fontWeight: 500 }}>No other active sessions detected.</p>
            <span style={{ fontSize: '0.75rem' }}>You are only logged in on this current device.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Device & Browser</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Operating System</th>
                  <th style={{ padding: '0.75rem 1rem' }}>IP Address</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Last Active</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {otherSessions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {s.deviceType === 'Mobile' ? <Smartphone size={16} /> : <Laptop size={16} />}
                        <div>
                          <strong>{s.browser || 'Unknown Browser'}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.deviceType}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{s.operatingSystem || 'Unknown'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>{s.ipAddress || 'Unknown'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{formatTime(s.lastActiveAt)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: s.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: s.status === 'ACTIVE' ? '#10b981' : '#ef4444'
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      {s.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleRevokeSession(s.id, false)}
                          className="btn-danger"
                          disabled={actionLoading}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADMINISTRATOR CONSOLE (ROLE_ADMIN ONLY) */}
      {isAdmin && (
        <div className="glass-panel" style={{ padding: '1.75rem', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#8b5cf6', fontSize: '0.75rem', fontWeight: 700 }}>
                <Shield size={14} />
                <span>ADMINISTRATOR SESSION GOVERNANCE</span>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0.25rem 0 0' }}>All System Sessions & Audit Events</h3>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setAdminTab('sessions')}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  background: adminTab === 'sessions' ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: '#ffffff',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                All Sessions ({adminSessions.length})
              </button>
              <button
                onClick={() => setAdminTab('events')}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  background: adminTab === 'events' ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: '#ffffff',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Security Audit Log ({securityEvents.length})
              </button>
            </div>
          </div>

          {adminTab === 'sessions' ? (
            <>
              {/* Search bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <Search size={16} style={{ color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Search sessions by username, IP address, or browser..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.875rem', width: '100%', outline: 'none' }}
                />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>User</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Client / Device</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>IP Address</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Created</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Last Active</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Status</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Admin Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdminSessions.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <strong>{s.username}</strong>
                          {s.current && <span style={{ marginLeft: '0.4rem', color: '#10b981', fontSize: '0.7rem' }}>[You]</span>}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{s.browser} ({s.operatingSystem})</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace' }}>{s.ipAddress}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{formatTime(s.createdAt)}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{formatTime(s.lastActiveAt)}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <span style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: s.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: s.status === 'ACTIVE' ? '#10b981' : '#ef4444'
                          }}>
                            {s.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                          {s.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleAdminRevoke(s.id)}
                              className="btn-danger"
                              disabled={actionLoading}
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem' }}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* Security Audit Events Log */
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Timestamp</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Event Type</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>User</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>IP Address</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Audit Details</th>
                  </tr>
                </thead>
                <tbody>
                  {securityEvents.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{formatTime(e.timestamp)}</td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <span style={{
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: e.eventType.includes('REVOKED') || e.eventType.includes('FAILURE')
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(16, 185, 129, 0.15)',
                          color: e.eventType.includes('REVOKED') || e.eventType.includes('FAILURE')
                            ? '#ef4444'
                            : '#10b981'
                        }}>
                          {e.eventType}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}><strong>{e.username || 'System'}</strong></td>
                      <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace' }}>{e.ipAddress || '-'}</td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{e.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
