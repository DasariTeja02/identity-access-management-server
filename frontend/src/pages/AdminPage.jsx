import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldAlert, 
  Users, 
  Shield, 
  FileText, 
  LayoutDashboard, 
  ArrowLeft 
} from 'lucide-react';
import AdminDashboardOverview from '../components/admin/AdminDashboardOverview';
import AdminUserManagement from '../components/admin/AdminUserManagement';
import AdminRoleManagement from '../components/admin/AdminRoleManagement';
import AdminSecurityEvents from '../components/admin/AdminSecurityEvents';

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');

  const isAdmin = user?.roles?.some(r => r.includes('ADMIN'));

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'users', 'roles', 'events'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  if (!isAdmin) {
    return (
      <div style={{ flex: 1, padding: '3rem 1.5rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f87171', marginBottom: '0.5rem' }}>
            403 — Access Forbidden
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            Administrative privileges required. You do not possess the <code>ROLE_ADMIN</code> role required to access the IAM Administration Control Plane.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary"
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}
          >
            Return to User Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: '2.5rem 1.5rem', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#a855f7', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7', display: 'inline-block' }}></span>
            ENTERPRISE ADMINISTRATION CONTROL PLANE (PHASE 6)
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            IAM <span className="gradient-text">Administration & Security</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
            Identity governance, account lifecycle, session revocation, and security audit log analysis
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="btn-secondary"
          style={{ padding: '0.6rem 1rem', fontSize: '0.875rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Admin Subtabs Navigation */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        {[
          { id: 'overview', label: '📊 Security Overview', icon: LayoutDashboard },
          { id: 'users', label: '👥 User Accounts & Status', icon: Users },
          { id: 'roles', label: '🛡️ Roles & Permissions', icon: Shield },
          { id: 'events', label: '📋 Security Audit Logs', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                border: isActive ? '1px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.08)',
                background: isActive ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.875rem',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <AdminDashboardOverview onNavigateTab={handleTabChange} />
      )}

      {activeTab === 'users' && (
        <AdminUserManagement />
      )}

      {activeTab === 'roles' && (
        <AdminRoleManagement />
      )}

      {activeTab === 'events' && (
        <AdminSecurityEvents />
      )}

    </div>
  );
}
