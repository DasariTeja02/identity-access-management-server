import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  ShieldAlert, 
  UserCheck, 
  UserX, 
  Eye, 
  RotateCcw, 
  Shield, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw,
  Edit2
} from 'lucide-react';
import { adminService } from '../../services/api';
import ConfirmModal from './ConfirmModal';
import AdminUserDetailModal from './AdminUserDetailModal';

export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mfaFilter, setMfaFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modals state
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [selectedUserRoles, setSelectedUserRoles] = useState([]);
  const [allAvailableRoles, setAllAvailableRoles] = useState([]);

  // Confirm modal state
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    isDanger: true,
    action: null,
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page,
        size,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        mfaStatus: mfaFilter || undefined,
        role: roleFilter || undefined,
      };
      const res = await adminService.getUsers(params);
      if (res.success) {
        setUsers(res.data.content || []);
        setTotalElements(res.data.totalElements || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchRolesList = async () => {
    try {
      const res = await adminService.getRoles();
      if (res.success) {
        setAllAvailableRoles(res.data || []);
      }
    } catch (err) {
      console.error('Could not fetch roles list', err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, statusFilter, mfaFilter, roleFilter]);

  useEffect(() => {
    fetchRolesList();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    fetchUsers();
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Action handlers with ConfirmModal
  const handleToggleStatus = (u) => {
    const isEnabling = !u.enabled;
    setConfirmModalConfig({
      isOpen: true,
      title: isEnabling ? `Enable Account: @${u.username}` : `Disable Account: @${u.username}`,
      message: isEnabling
        ? `Are you sure you want to re-enable @${u.username}? They will be permitted to authenticate.`
        : `Disable account for @${u.username}? They will be immediately blocked from authenticating and all active sessions will be terminated.`,
      confirmText: isEnabling ? 'Enable Account' : 'Disable Account',
      isDanger: !isEnabling,
      action: async () => {
        try {
          await adminService.updateUserStatus(u.id, isEnabling);
          showNotification(`Account @${u.username} ${isEnabling ? 'enabled' : 'disabled'} successfully.`);
          fetchUsers();
        } catch (err) {
          setError(err.message || 'Status update failed');
        } finally {
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleToggleLock = (u) => {
    const isLocking = !u.accountLocked;
    setConfirmModalConfig({
      isOpen: true,
      title: isLocking ? `Lock Account: @${u.username}` : `Unlock Account: @${u.username}`,
      message: isLocking
        ? `Lock @${u.username}? Authentication attempts will be rejected until unlocked. Active sessions will be terminated.`
        : `Unlock account for @${u.username}? This resets any failed login counters and restores login capability.`,
      confirmText: isLocking ? 'Lock Account' : 'Unlock Account',
      isDanger: isLocking,
      action: async () => {
        try {
          if (isLocking) {
            await adminService.lockUser(u.id, 'Administrative security lock');
          } else {
            await adminService.unlockUser(u.id);
          }
          showNotification(`Account @${u.username} ${isLocking ? 'locked' : 'unlocked'} successfully.`);
          fetchUsers();
        } catch (err) {
          setError(err.message || 'Lock state change failed');
        } finally {
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleResetMfa = (u) => {
    setConfirmModalConfig({
      isOpen: true,
      title: `Reset MFA Configuration for @${u.username}`,
      message: `Reset multi-factor authentication for @${u.username}? Their existing TOTP authenticator enrollment, secret, and recovery codes will be completely revoked. The user must enroll again if required.`,
      confirmText: 'Reset MFA Credentials',
      isDanger: true,
      action: async () => {
        try {
          await adminService.resetUserMfa(u.id);
          showNotification(`MFA reset for @${u.username}. Previous credentials revoked.`);
          fetchUsers();
        } catch (err) {
          setError(err.message || 'MFA reset failed');
        } finally {
          setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const openRolesModal = (u) => {
    setSelectedUserId(u.id);
    setSelectedUserRoles([...(u.roles || [])]);
    setRolesModalOpen(true);
  };

  const handleSaveRoles = async () => {
    try {
      setError(null);
      await adminService.updateUserRoles(selectedUserId, selectedUserRoles);
      showNotification('User roles updated successfully.');
      setRolesModalOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to update roles');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Title & Stats Ribbon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
            User Account Management
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
            Inspect identities, assign RBAC privileges, enforce account status and reset MFA
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="btn-secondary"
          disabled={loading}
          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
        >
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          <span>Refresh</span>
        </button>
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

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '12px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          
          {/* Search Box */}
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search by username, email or name..."
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

          {/* Status Filter */}
          <div style={{ minWidth: '140px' }}>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
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
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active (Enabled & Unlocked)</option>
              <option value="DISABLED">Disabled</option>
              <option value="LOCKED">Locked</option>
            </select>
          </div>

          {/* MFA Filter */}
          <div style={{ minWidth: '140px' }}>
            <select
              value={mfaFilter}
              onChange={(e) => { setMfaFilter(e.target.value); setPage(0); }}
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
              <option value="">All MFA Status</option>
              <option value="ENABLED">MFA Enabled</option>
              <option value="DISABLED">MFA Disabled</option>
            </select>
          </div>

          {/* Role Filter */}
          <div style={{ minWidth: '140px' }}>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
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
              <option value="">All Roles</option>
              <option value="ROLE_ADMIN">ROLE_ADMIN</option>
              <option value="ROLE_USER">ROLE_USER</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}
          >
            Filter
          </button>
        </form>
      </div>

      {/* User Table */}
      <div className="glass-panel" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>User / Identity</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Roles</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>MFA</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Sessions</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600 }}>Created</th>
                <th style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    No users found matching current filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isLocked = u.accountLocked;
                  const isEnabled = u.enabled;
                  return (
                    <tr 
                      key={u.id} 
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Identity */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                          {u.username}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {u.email}
                        </div>
                      </td>

                      {/* Status Badges */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: isEnabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isEnabled ? '#4ade80' : '#f87171'
                          }}>
                            {isEnabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                          {isLocked && (
                            <span style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24'
                            }}>
                              LOCKED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Roles */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {u.roles?.map(r => (
                            <span key={r} style={{
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: r.includes('ADMIN') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                              color: r.includes('ADMIN') ? '#f87171' : '#38bdf8'
                            }}>
                              {r.replace('ROLE_', '')}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* MFA */}
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: u.mfaEnabled ? 'rgba(168, 85, 247, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                          color: u.mfaEnabled ? '#c084fc' : '#94a3b8'
                        }}>
                          {u.mfaEnabled ? 'ENROLLED' : 'NONE'}
                        </span>
                      </td>

                      {/* Sessions */}
                      <td style={{ padding: '0.875rem 1rem', color: '#94a3b8', fontSize: '0.8125rem' }}>
                        {u.activeSessionCount ?? 0} active
                      </td>

                      {/* Created */}
                      <td style={{ padding: '0.875rem 1rem', color: '#64748b', fontSize: '0.75rem' }}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          
                          {/* Dossier Button */}
                          <button
                            onClick={() => { setSelectedUserId(u.id); setDetailModalOpen(true); }}
                            className="btn-secondary"
                            title="View Security Dossier"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            <Eye size={14} />
                          </button>

                          {/* Lock / Unlock */}
                          <button
                            onClick={() => handleToggleLock(u)}
                            title={isLocked ? 'Unlock Account' : 'Lock Account'}
                            style={{
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              background: isLocked ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: isLocked ? '#4ade80' : '#fbbf24',
                              border: '1px solid transparent',
                              cursor: 'pointer'
                            }}
                          >
                            {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                          </button>

                          {/* Enable / Disable */}
                          <button
                            onClick={() => handleToggleStatus(u)}
                            title={isEnabled ? 'Disable Account' : 'Enable Account'}
                            style={{
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              background: isEnabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                              color: isEnabled ? '#f87171' : '#4ade80',
                              border: '1px solid transparent',
                              cursor: 'pointer'
                            }}
                          >
                            {isEnabled ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>

                          {/* Manage Roles */}
                          <button
                            onClick={() => openRolesModal(u)}
                            className="btn-secondary"
                            title="Manage Assigned Roles"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Reset MFA */}
                          {u.mfaEnabled && (
                            <button
                              onClick={() => handleResetMfa(u)}
                              title="Reset MFA Credentials"
                              style={{
                                padding: '0.35rem 0.5rem',
                                fontSize: '0.75rem',
                                borderRadius: '6px',
                                background: 'rgba(168, 85, 247, 0.15)',
                                color: '#c084fc',
                                border: '1px solid transparent',
                                cursor: 'pointer'
                              }}
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '0.8125rem', color: '#94a3b8' }}>
          <div>
            Showing <b>{users.length}</b> of <b>{totalElements}</b> users (Page {page + 1} of {totalPages})
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

      {/* Role Assignment Modal */}
      {rolesModalOpen && (
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
            maxWidth: '460px',
            width: '100%',
            padding: '1.75rem',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
              Assign Roles to User
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
              Select the RBAC roles to grant to this user. Note that system self-protection rules block revoking the last administrator role.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {allAvailableRoles.map((r) => {
                const checked = selectedUserRoles.includes(r.name);
                return (
                  <label key={r.id || r.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: checked ? 'rgba(14, 165, 233, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                    border: checked ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUserRoles(prev => [...prev, r.name]);
                        } else {
                          setSelectedUserRoles(prev => prev.filter(x => x !== r.name));
                        }
                      }}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#f8fafc' }}>{r.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.description || 'Standard role'}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRolesModalOpen(false)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveRoles}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
              >
                Save Roles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Dossier Modal */}
      <AdminUserDetailModal
        userId={selectedUserId}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onUserModified={fetchUsers}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        isDanger={confirmModalConfig.isDanger}
        onConfirm={confirmModalConfig.action}
        onCancel={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}
