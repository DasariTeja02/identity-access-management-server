import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Plus, 
  Users, 
  Key, 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle,
  Lock,
  Layers
} from 'lucide-react';
import { adminService } from '../../services/api';

export default function AdminRoleManagement() {
  const [roles, setRoles] = useState([]);
  const [authorities, setAuthorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Create role modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedAuthorities, setSelectedAuthorities] = useState([]);
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rolesRes, authRes] = await Promise.all([
        adminService.getRoles(),
        adminService.getAuthorities()
      ]);
      if (rolesRes.success) {
        setRoles(rolesRes.data || []);
      }
      if (authRes.success) {
        setAuthorities(authRes.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch roles & permissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      setError('Role name cannot be empty');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      let formattedName = newRoleName.trim().toUpperCase();
      if (!formattedName.startsWith('ROLE_')) {
        formattedName = 'ROLE_' + formattedName;
      }

      await adminService.createRole({
        name: formattedName,
        description: newRoleDesc.trim(),
        authorities: selectedAuthorities,
      });

      setNotification(`Role ${formattedName} created successfully.`);
      setCreateModalOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setSelectedAuthorities([]);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to create role');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
            Roles & Permissions Governance
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
            Configure RBAC roles, define security scopes, and inspect user mapping
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={fetchData}
            className="btn-secondary"
            disabled={loading}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="btn-primary"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
          >
            <Plus size={16} />
            <span>Create Role</span>
          </button>
        </div>
      </div>

      {notification && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '0.875rem' }}>
          {notification}
        </div>
      )}

      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Roles Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {roles.map((r) => {
          const isAdmin = r.name.includes('ADMIN');
          return (
            <div 
              key={r.id || r.name} 
              className="glass-panel" 
              style={{ 
                padding: '1.5rem', 
                borderRadius: '14px',
                border: isAdmin ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: isAdmin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                    color: isAdmin ? '#ef4444' : '#0ea5e9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Shield size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                      {r.name}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {r.userCount ?? 0} active users assigned
                    </div>
                  </div>
                </div>

                <span style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: isAdmin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                  color: isAdmin ? '#f87171' : '#38bdf8'
                }}>
                  {isAdmin ? 'ADMINISTRATIVE' : 'STANDARD'}
                </span>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0 0 1rem 0', minHeight: '40px' }}>
                {r.description || 'No description provided.'}
              </p>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Assigned Authorities ({r.authorities?.length || 0})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {r.authorities && r.authorities.length > 0 ? (
                    r.authorities.map(auth => (
                      <span key={auth} style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#cbd5e1'
                      }}>
                        {auth}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>No granular authorities</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* System Authorities Table */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Key size={18} color="#38bdf8" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
            Registered Security Authorities
          </h3>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
          Fine-grained authorities enforced across IAM REST endpoints and method security
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Authority / Scope</th>
                <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Description</th>
                <th style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {authorities.map((a) => (
                <tr key={a.id || a.name} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>
                    {a.name}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>
                    {a.description || 'System permission'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#cbd5e1'
                    }}>
                      {a.name.startsWith('admin') ? 'ADMINISTRATIVE' : 'STANDARD'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Role Modal */}
      {createModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{
            maxWidth: '520px',
            width: '100%',
            padding: '1.75rem',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
              Create New Security Role
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
              Define a new RBAC role and grant specific permissions.
            </p>

            <form onSubmit={handleCreateRole} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Role Name (e.g. AUDITOR, SECURITY_OFFICER)
                </label>
                <input
                  type="text"
                  placeholder="AUDITOR"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  required
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
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Will automatically receive prefix <code>ROLE_</code>
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Security and compliance auditor"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
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

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Assign Authorities
                </label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.5rem' }}>
                  {authorities.map(a => {
                    const checked = selectedAuthorities.includes(a.name);
                    return (
                      <label key={a.id || a.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAuthorities(prev => [...prev, a.name]);
                            } else {
                              setSelectedAuthorities(prev => prev.filter(x => x !== a.name));
                            }
                          }}
                        />
                        <span style={{ fontFamily: 'monospace', color: checked ? '#38bdf8' : '#94a3b8' }}>{a.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCreateModalOpen(false)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={creating}
                  style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
                >
                  {creating ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
