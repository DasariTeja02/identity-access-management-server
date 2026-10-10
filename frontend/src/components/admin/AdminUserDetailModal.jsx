import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Clock
} from 'lucide-react';
import { adminService } from '../../services/api';

export default function AdminUserDetailModal({
  userId,
  isOpen,
  onClose,
  onUserModified,
}) {
  const [userDetail, setUserDetail] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const fetchDetails = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const [userRes, sessionsRes] = await Promise.all([
        adminService.getUser(userId),
        adminService.getUserSessions(userId)
      ]);
      if (userRes.success) {
        setUserDetail(userRes.data);
      }
      if (sessionsRes.success) {
        setSessions(sessionsRes.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchDetails();
    }
  }, [isOpen, userId]);

  const handleRevokeSingleSession = async (sessionId) => {
    try {
      setActionLoading(true);
      setError(null);
      await adminService.revokeUserSession(userId, sessionId);
      setSuccessMsg('Session revoked successfully.');
      fetchDetails();
      if (onUserModified) onUserModified();
    } catch (err) {
      setError(err.message || 'Failed to revoke session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm('Revoke all active sessions for this user? They will be logged out of all devices immediately.')) {
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      await adminService.revokeAllUserSessions(userId);
      setSuccessMsg('All active sessions revoked successfully.');
      fetchDetails();
      if (onUserModified) onUserModified();
    } catch (err) {
      setError(err.message || 'Failed to revoke sessions');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.5rem',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                User Security Dossier
              </h2>
              <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                {userDetail ? `@${userDetail.username} (ID: ${userDetail.id})` : 'Loading...'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.5rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {successMsg}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#94a3b8' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: '0.75rem' }} />
            <span>Fetching Profile & Active Session State...</span>
          </div>
        ) : userDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Account Status Flags & Identity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Account Status</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <span style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: userDetail.enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: userDetail.enabled ? '#4ade80' : '#f87171'
                  }}>
                    {userDetail.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <span style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: !userDetail.accountLocked ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: !userDetail.accountLocked ? '#4ade80' : '#fbbf24'
                  }}>
                    {!userDetail.accountLocked ? 'UNLOCKED' : 'LOCKED'}
                  </span>
                </div>
              </div>

              <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>MFA (Phase 5)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <span style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: userDetail.mfaEnabled ? 'rgba(168, 85, 247, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                    color: userDetail.mfaEnabled ? '#c084fc' : '#94a3b8'
                  }}>
                    {userDetail.mfaEnabled ? 'MFA ACTIVE (TOTP)' : 'MFA DISABLED'}
                  </span>
                </div>
              </div>

              <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Active Sessions</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.25rem' }}>
                  {sessions.length}
                </div>
              </div>
            </div>

            {/* Profile Information Table */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.04)', fontWeight: 600, fontSize: '0.875rem' }}>
                Identity Profile
              </div>
              <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Full Name</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {userDetail.firstName || userDetail.lastName ? `${userDetail.firstName || ''} ${userDetail.lastName || ''}` : 'Not provided'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Email Address</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{userDetail.email}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Member Since</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {userDetail.createdAt ? new Date(userDetail.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Last Login Timestamp</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {userDetail.lastLoginAt ? new Date(userDetail.lastLoginAt).toLocaleString() : 'Never logged in'}
                  </div>
                </div>
              </div>
            </div>

            {/* Assigned Roles & Authorities */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', padding: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Assigned RBAC Roles & Permissions
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {userDetail.roles?.map(r => (
                  <span key={r} style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    backgroundColor: r.includes('ADMIN') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    color: r.includes('ADMIN') ? '#f87171' : '#38bdf8',
                    border: r.includes('ADMIN') ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)'
                  }}>
                    {r}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Authorities: {userDetail.authorities?.join(', ') || 'None'}
              </div>
            </div>

            {/* Active Sessions Panel */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Active User Sessions (Phase 4)</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Device & token states backed by Redis and DB session store</div>
                </div>
                {sessions.length > 0 && (
                  <button
                    onClick={handleRevokeAllSessions}
                    disabled={actionLoading}
                    className="btn-danger"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                  >
                    Revoke All Sessions
                  </button>
                )}
              </div>

              {sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                  No active sessions found for this user.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sessions.map((sess) => (
                    <div key={sess.sessionId} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '0.8125rem'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                          {sess.ipAddress ? `IP: ${sess.ipAddress}` : 'Session'} — {sess.userAgent ? sess.userAgent.substring(0, 45) + '...' : 'Browser Device'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
                          ID: <code style={{ color: '#94a3b8' }}>{sess.sessionId.substring(0, 8)}...</code> | Created: {new Date(sess.createdAt).toLocaleString()} | Expires: {sess.expiresAt ? new Date(sess.expiresAt).toLocaleTimeString() : 'N/A'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeSingleSession(sess.sessionId)}
                        disabled={actionLoading}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          borderRadius: '6px',
                          padding: '0.35rem 0.65rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.75rem'
                        }}
                      >
                        <Trash2 size={13} />
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
