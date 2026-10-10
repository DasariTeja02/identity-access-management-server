import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  FileText,
  RefreshCw,
  ArrowRight,
  Shield
} from 'lucide-react';
import { adminService } from '../../services/api';

export default function AdminDashboardOverview({ onNavigateTab }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setError(null);
      const res = await adminService.getStats();
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load administrative statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: '#94a3b8' }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginRight: '0.75rem' }} />
        <span>Loading Admin Statistics...</span>
      </div>
    );
  }

  const mfaPercentage = stats?.totalUsers > 0 
    ? Math.round((stats.mfaEnabledUsers / stats.totalUsers) * 100) 
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
            System Security & Administration Overview
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
            Real-time identity metrics, active sessions, and security posture
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="btn-secondary"
          disabled={refreshing}
          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
        >
          <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{refreshing ? 'Updating...' : 'Refresh Stats'}</span>
        </button>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* 8 Primary Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        
        {/* Total Users */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Users
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            {stats?.totalUsers ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            Registered platform accounts
          </div>
        </div>

        {/* Active Users */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Users
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#22c55e', letterSpacing: '-0.02em' }}>
            {stats?.activeUsers ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            Enabled & accessible
          </div>
        </div>

        {/* Disabled Users */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Disabled Accounts
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserX size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: stats?.disabledUsers > 0 ? '#ef4444' : '#94a3b8', letterSpacing: '-0.02em' }}>
            {stats?.disabledUsers ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            Logins disallowed
          </div>
        </div>

        {/* Locked Users */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Locked Accounts
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: stats?.lockedUsers > 0 ? '#f59e0b' : '#94a3b8', letterSpacing: '-0.02em' }}>
            {stats?.lockedUsers ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            Administrative lockout
          </div>
        </div>

        {/* MFA Adoption */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              MFA Adoption
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#a855f7', letterSpacing: '-0.02em' }}>
              {stats?.mfaEnabledUsers ?? 0}
            </span>
            <span style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 600 }}>
              ({mfaPercentage}%)
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            TOTP 2FA enrolled
          </div>
        </div>

        {/* Active Sessions */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Sessions
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0ea5e9', letterSpacing: '-0.02em' }}>
            {stats?.activeSessions ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            Authenticated device tokens
          </div>
        </div>

        {/* Failed Logins (24h) */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Failed Logins (24h)
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: stats?.failedLoginsLast24Hours > 0 ? '#ef4444' : '#94a3b8', letterSpacing: '-0.02em' }}>
            {stats?.failedLoginsLast24Hours ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            Suspicious login alerts
          </div>
        </div>

        {/* Total Security Events */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Security Audit Logs
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1', letterSpacing: '-0.02em' }}>
            {stats?.totalSecurityEvents ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
            Tamper-evident audit events
          </div>
        </div>

      </div>

      {/* Role Distribution & Quick Management Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        
        {/* Role Distribution Panel */}
        <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <Shield size={20} color="#8b5cf6" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              RBAC Role Distribution
            </h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
            Active users mapped to administrative and standard roles
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stats?.roleDistribution && Object.entries(stats.roleDistribution).map(([role, count]) => {
              const isAdmin = role.includes('ADMIN');
              return (
                <div 
                  key={role} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      display: 'inline-block', 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      backgroundColor: isAdmin ? '#ef4444' : '#38bdf8' 
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{role}</span>
                  </div>
                  <span style={{ 
                    fontSize: '0.8125rem', 
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    backgroundColor: isAdmin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    color: isAdmin ? '#f87171' : '#38bdf8'
                  }}>
                    {count} {count === 1 ? 'user' : 'users'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Administrative Navigation */}
        <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
            Administrative Actions
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
            Jump to dedicated security and management tools
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => onNavigateTab && onNavigateTab('users')}
              className="btn-secondary"
              style={{ justifyContent: 'space-between', padding: '0.875rem 1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Users size={18} color="#38bdf8" />
                <span style={{ fontWeight: 600 }}>Manage Users & Accounts</span>
              </div>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => onNavigateTab && onNavigateTab('roles')}
              className="btn-secondary"
              style={{ justifyContent: 'space-between', padding: '0.875rem 1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Shield size={18} color="#a855f7" />
                <span style={{ fontWeight: 600 }}>Roles & Permission Scopes</span>
              </div>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => onNavigateTab && onNavigateTab('events')}
              className="btn-secondary"
              style={{ justifyContent: 'space-between', padding: '0.875rem 1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={18} color="#22c55e" />
                <span style={{ fontWeight: 600 }}>Inspect Security Audit Logs</span>
              </div>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
