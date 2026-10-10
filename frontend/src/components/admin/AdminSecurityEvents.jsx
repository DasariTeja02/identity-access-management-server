import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  Lock,
  Unlock,
  KeyRound
} from 'lucide-react';
import { adminService } from '../../services/api';

const EVENT_TYPES = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'LOGOUT',
  'ACCOUNT_LOCKED',
  'ACCOUNT_UNLOCKED',
  'PASSWORD_CHANGED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_FAILED',
  'MFA_RECOVERY_USED',
  'SESSION_REVOKED',
  'ADMIN_DISABLED_USER',
  'ADMIN_ENABLED_USER',
  'ADMIN_LOCKED_USER',
  'ADMIN_UNLOCKED_USER',
  'ADMIN_ROLE_ASSIGNED',
  'ADMIN_ROLE_REMOVED',
  'ADMIN_RESET_USER_MFA',
  'ADMIN_REVOKED_SESSION',
  'ADMIN_REVOKED_ALL_SESSIONS',
];

export default function AdminSecurityEvents() {
  const [events, setEvents] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);

  const [search, setSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page,
        size,
        search: search.trim() || undefined,
        eventType: eventTypeFilter || undefined,
        username: usernameFilter.trim() || undefined,
      };
      const res = await adminService.getSecurityEvents(params);
      if (res.success) {
        setEvents(res.data.content || []);
        setTotalElements(res.data.totalElements || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch security events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, eventTypeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    fetchEvents();
  };

  const getEventBadge = (type, result) => {
    const isFailure = result === 'FAILURE' || type.includes('FAIL') || type.includes('LOCKED');
    const isAdminAction = type.startsWith('ADMIN_');
    const isMfa = type.startsWith('MFA_');

    let bg = 'rgba(56, 189, 248, 0.15)';
    let color = '#38bdf8';

    if (isFailure) {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#f87171';
    } else if (isAdminAction) {
      bg = 'rgba(168, 85, 247, 0.15)';
      color = '#c084fc';
    } else if (isMfa) {
      bg = 'rgba(234, 179, 8, 0.15)';
      color = '#facc15';
    } else if (type === 'LOGIN_SUCCESS') {
      bg = 'rgba(34, 197, 94, 0.15)';
      color = '#4ade80';
    }

    return (
      <span style={{
        padding: '0.15rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.7rem',
        fontFamily: 'monospace',
        fontWeight: 700,
        backgroundColor: bg,
        color: color,
        border: `1px solid ${color}33`,
      }}>
        {type}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
            Security Audit Trail & SIEM Events
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
            Tamper-evident logs of authentications, administrative changes, and policy events
          </p>
        </div>
        <button
          onClick={fetchEvents}
          className="btn-secondary"
          disabled={loading}
          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
        >
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          <span>Refresh Audit Stream</span>
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          
          {/* General Search Box */}
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search by keyword, IP or details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            />
          </div>

          {/* Username Filter */}
          <div style={{ minWidth: '160px' }}>
            <input
              type="text"
              placeholder="Filter by username..."
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            />
          </div>

          {/* Event Type Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              value={eventTypeFilter}
              onChange={(e) => { setEventTypeFilter(e.target.value); setPage(0); }}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontSize: '0.875rem'
              }}
            >
              <option value="">All Event Types</option>
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}
          >
            Apply Filters
          </button>
        </form>
      </div>

      {/* Security Events Table */}
      <div className="glass-panel" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Timestamp</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Event Type</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Actor / User</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Result</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>IP / Device</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    Loading audit stream...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    No security events found matching current criteria.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr 
                    key={ev.id} 
                    style={{ 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Timestamp */}
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : 'N/A'}
                    </td>

                    {/* Event Type */}
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      {getEventBadge(ev.eventType, ev.result)}
                    </td>

                    {/* Actor & User */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                        {ev.username || 'System'}
                      </div>
                      {ev.actorUserId && ev.targetUserId && ev.actorUserId !== ev.targetUserId && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          Actor: {ev.actorUserId} → Target: {ev.targetUserId}
                        </div>
                      )}
                    </td>

                    {/* Result */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: ev.result === 'SUCCESS' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: ev.result === 'SUCCESS' ? '#4ade80' : '#f87171'
                      }}>
                        {ev.result || 'INFO'}
                      </span>
                    </td>

                    {/* IP / User Agent */}
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                      <div>{ev.ipAddress || '127.0.0.1'}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.userAgent || 'Unknown client'}
                      </div>
                    </td>

                    {/* Metadata / Details */}
                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.details || ev.metadata || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.8125rem', color: '#94a3b8' }}>
          <div>
            Showing <b>{events.length}</b> of <b>{totalElements}</b> events (Page {page + 1} of {totalPages})
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="btn-secondary"
              style={{ padding: '0.35rem 0.65rem' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="btn-secondary"
              style={{ padding: '0.35rem 0.65rem' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
