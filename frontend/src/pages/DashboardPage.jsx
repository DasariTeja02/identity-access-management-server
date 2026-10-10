import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/api';
import AlertBanner from '../components/AlertBanner';
import { 
  ShieldCheck, 
  User, 
  Key, 
  Server, 
  Calendar, 
  CheckCircle2, 
  RefreshCw, 
  Layers,
  Database,
  Lock,
  LogOut,
  Fingerprint
} from 'lucide-react';

import OAuth2Playground from '../components/OAuth2Playground';
import OpenIdConnectPlayground from '../components/OpenIdConnectPlayground';
import SessionManagement from '../components/SessionManagement';
import MfaSettings from '../components/MfaSettings';
import AdminDashboardOverview from '../components/admin/AdminDashboardOverview';
import AdminUserManagement from '../components/admin/AdminUserManagement';
import AdminRoleManagement from '../components/admin/AdminRoleManagement';
import AdminSecurityEvents from '../components/admin/AdminSecurityEvents';

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshUser, logout } = useAuth();
  const [activePhase, setActivePhase] = useState(() => searchParams.get('tab') || 'all');
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    try {
      const res = await dashboardService.getSummary();
      setSummaryData(res.data);
    } catch (err) {
      setError('Could not fetch server summary: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    await fetchSummary();
  };

  const currentUser = summaryData?.user || user;
  const isAdmin = currentUser?.roles?.some(r => r.includes('ADMIN'));
  const [adminSubTab, setAdminSubTab] = useState('overview');

  const navTabs = [
    { id: 'all', label: '🌟 Full Platform (Phases 1 - 5)' },
    ...(isAdmin ? [{ id: 'admin', label: '👑 Phase 6: Admin & Security' }] : []),
    { id: 'mfa', label: '🔐 Phase 5: Security & MFA' },
    { id: 'session', label: '🔒 Phase 4: Session & Security' },
    { id: 'oidc', label: '🆔 Phase 3: OpenID Connect (OIDC)' },
    { id: 'phase2', label: '⚡ Phase 2: OAuth 2.0 Auth Server' },
    { id: 'phase1', label: '🛡️ Phase 1: Core IAM & RBAC' },
  ];

  return (
    <div style={{ flex: 1, padding: '2.5rem 1.5rem', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            ACTIVE AUTHENTICATED SESSION
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Welcome, <span className="gradient-text">{currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}` : currentUser?.username}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
            Managed by Enterprise Spring Security IAM Core Server (Phase 1)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={handleRefresh}
            className="btn-secondary"
            disabled={refreshing}
            style={{ padding: '0.6rem 1rem', fontSize: '0.875rem' }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{refreshing ? 'Syncing...' : 'Sync Session'}</span>
          </button>
          <button
            onClick={logout}
            className="btn-danger"
            style={{ padding: '0.6rem 1rem', fontSize: '0.875rem' }}
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}

      {/* Architecture Phase Switcher Navigation */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActivePhase(tab.id);
              setSearchParams({ tab: tab.id });
            }}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              border: activePhase === tab.id ? '1px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.08)',
              background: activePhase === tab.id ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.02)',
              color: activePhase === tab.id ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: activePhase === tab.id ? 600 : 500,
              fontSize: '0.875rem',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Phase 1: Core IAM & RBAC Foundation */}
      {(activePhase === 'all' || activePhase === 'phase1') && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            
            {/* Profile Card */}
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  boxShadow: '0 4px 15px rgba(56, 189, 248, 0.3)'
                }}>
                  {currentUser?.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{currentUser?.username}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{currentUser?.email}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>User ID</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>#{currentUser?.id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Account Status</span>
                  <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                    <CheckCircle2 size={12} /> Active &amp; Verified
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Created At</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleString() : 'Just now'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Password Hash</span>
                  <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                    BCrypt-2a (12 Rounds)
                  </span>
                </div>
              </div>
            </div>

            {/* Roles & Authorities Card */}
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Fingerprint size={20} color="#38bdf8" />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Roles &amp; Granted Authorities</h2>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  Assigned Roles
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {currentUser?.roles && currentUser.roles.length > 0 ? (
                    currentUser.roles.map((r, i) => (
                      <span key={i} className="badge badge-cyan" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                        {r}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>None</span>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  Granted Authorities / Permissions
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {currentUser?.authorities && currentUser.authorities.length > 0 ? (
                    currentUser.authorities.map((a, i) => (
                      <span key={i} className="badge badge-indigo" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                        {a}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>None</span>
                  )}
                </div>
              </div>
            </div>

            {/* Server Health & Specs */}
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Server size={20} color="#10b981" />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>IAM Engine Status</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Backend Engine</span>
                  <span>Spring Boot 3.3.4</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Security Layer</span>
                  <span>Spring Security 6 + Auth Server</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>IAM Version</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{summaryData?.iamVersion || '1.0.0-phase3'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>OIDC Status</span>
                  <span style={{ color: '#a78bfa' }}>OpenID Connect 1.0 Active</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Database</span>
                  <span style={{ color: '#34d399' }}>PostgreSQL / JPA</span>
                </div>
              </div>
            </div>

          </div>

          {/* Active Phase 1 Features Checklist */}
          <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={20} color="#10b981" />
              <span>Active Phase 1 Security Controls</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {summaryData?.featuresActive ? (
                summaryData.featuresActive.map((feature, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <CheckCircle2 size={16} color="#34d399" />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{feature}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>Loading security controls...</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Phase 5: Multi-Factor Authentication (MFA / TOTP) */}
      {(activePhase === 'all' || activePhase === 'mfa') && (
        <div style={{ marginBottom: '2rem' }}>
          <MfaSettings />
        </div>
      )}

      {/* Phase 4: Session & Token Management */}
      {(activePhase === 'all' || activePhase === 'session') && (
        <div style={{ marginBottom: '2rem' }}>
          <SessionManagement />
        </div>
      )}

      {/* Phase 3: OpenID Connect 1.0 (OIDC) Identity Layer */}
      {(activePhase === 'all' || activePhase === 'oidc') && (
        <div style={{ marginBottom: '2rem' }}>
          <OpenIdConnectPlayground />
        </div>
      )}

      {/* Phase 2: OAuth 2.0 Authorization Server Interactive Playground */}
      {(activePhase === 'all' || activePhase === 'phase2') && (
        <OAuth2Playground />
      )}

      {/* Phase 6: Admin & Security Management (Administrators only) */}
      {isAdmin && activePhase === 'admin' && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'overview', label: '📊 Overview' },
              { id: 'users', label: '👥 User Management' },
              { id: 'roles', label: '🛡️ Roles & Permissions' },
              { id: 'events', label: '📋 Security Events' },
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setAdminSubTab(sub.id)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '6px',
                  border: adminSubTab === sub.id ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: adminSubTab === sub.id ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  color: adminSubTab === sub.id ? '#ffffff' : '#94a3b8',
                  fontSize: '0.8125rem',
                  fontWeight: adminSubTab === sub.id ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {adminSubTab === 'overview' && <AdminDashboardOverview onNavigateTab={setAdminSubTab} />}
          {adminSubTab === 'users' && <AdminUserManagement />}
          {adminSubTab === 'roles' && <AdminRoleManagement />}
          {adminSubTab === 'events' && <AdminSecurityEvents />}
        </div>
      )}

    </div>
  );
}
