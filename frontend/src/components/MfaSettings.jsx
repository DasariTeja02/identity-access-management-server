import React, { useState, useEffect, useCallback } from 'react';
import { mfaService, adminMfaService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AlertBanner from './AlertBanner';
import {
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Key,
  Copy,
  Check,
  Download,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  ShieldX
} from 'lucide-react';

export default function MfaSettings() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');

  // Status state
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Enrollment Wizard state
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStep, setEnrollStep] = useState(1); // 1: QR & Secret, 2: Verify Code, 3: Show Recovery Codes
  const [enrollData, setEnrollData] = useState(null); // { secret, otpAuthUri, qrCodeDataUri }
  const [verifyCode, setVerifyCode] = useState('');
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [generatedRecoveryCodes, setGeneratedRecoveryCodes] = useState([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Disable MFA Modal state
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  // Regenerate Recovery Codes Modal state
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenCode, setRegenCode] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [newRegenCodes, setNewRegenCodes] = useState(null);

  // Admin user list state
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await mfaService.getStatus();
      if (res && res.data) {
        setStatus(res.data);
      }
    } catch (err) {
      setError({ message: err.message || 'Failed to fetch MFA status.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdminUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setAdminLoading(true);
      const res = await adminMfaService.getAllUsers();
      if (res && res.data) {
        setAdminUsers(res.data);
      }
    } catch (err) {
      console.error('Error loading admin MFA users:', err);
    } finally {
      setAdminLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadStatus();
    if (isAdmin) {
      loadAdminUsers();
    }
  }, [loadStatus, loadAdminUsers, isAdmin]);

  // Start Enrollment Wizard
  const handleStartEnrollment = async () => {
    setEnrollLoading(true);
    setError(null);
    try {
      const res = await mfaService.enroll();
      if (res && res.data) {
        setEnrollData(res.data);
        setEnrollStep(1);
        setEnrolling(true);
        setVerifyCode('');
        setGeneratedRecoveryCodes([]);
      }
    } catch (err) {
      setError({ message: err.message || 'Failed to initialize MFA enrollment.' });
    } finally {
      setEnrollLoading(false);
    }
  };

  // Verify Enrollment Code
  const handleVerifyEnrollment = async (e) => {
    e.preventDefault();
    if (!verifyCode.trim() || verifyCode.trim().length !== 6) {
      setError({ message: 'Please enter a valid 6-digit verification code.' });
      return;
    }

    setEnrollLoading(true);
    setError(null);
    try {
      const res = await mfaService.verifyEnrollment(verifyCode.trim());
      if (res && res.data && res.data.recoveryCodes) {
        setGeneratedRecoveryCodes(res.data.recoveryCodes);
        setEnrollStep(3); // Go to recovery codes display
        await loadStatus();
        if (isAdmin) loadAdminUsers();
      }
    } catch (err) {
      setError({ message: err.message || 'Failed to verify enrollment code. Ensure your device time is accurate.' });
    } finally {
      setEnrollLoading(false);
    }
  };

  // Finish Enrollment
  const handleFinishEnrollment = () => {
    setEnrolling(false);
    setEnrollStep(1);
    setEnrollData(null);
    setGeneratedRecoveryCodes([]);
    setSuccessMsg('MFA has been successfully configured and activated on your account.');
  };

  // Disable MFA
  const handleDisableMfa = async (e) => {
    e.preventDefault();
    if (!disablePassword && !disableCode) {
      setError({ message: 'Please enter your password or current authenticator code to confirm.' });
      return;
    }

    setDisableLoading(true);
    setError(null);
    try {
      await mfaService.disableMfa(disablePassword || null, disableCode || null);
      setShowDisableModal(false);
      setDisablePassword('');
      setDisableCode('');
      setSuccessMsg('MFA has been successfully disabled.');
      await loadStatus();
      if (isAdmin) loadAdminUsers();
    } catch (err) {
      setError({ message: err.message || 'Failed to disable MFA. Please verify your credentials.' });
    } finally {
      setDisableLoading(false);
    }
  };

  // Regenerate Recovery Codes
  const handleRegenerateCodes = async (e) => {
    e.preventDefault();
    if (!regenPassword && !regenCode) {
      setError({ message: 'Please enter your password or current authenticator code to confirm.' });
      return;
    }

    setRegenLoading(true);
    setError(null);
    try {
      const res = await mfaService.regenerateRecoveryCodes(regenPassword || null, regenCode || null);
      if (res && res.data) {
        setNewRegenCodes(res.data);
        setRegenPassword('');
        setRegenCode('');
        await loadStatus();
        if (isAdmin) loadAdminUsers();
      }
    } catch (err) {
      setError({ message: err.message || 'Failed to regenerate recovery codes.' });
    } finally {
      setRegenLoading(false);
    }
  };

  // Admin Reset MFA
  const handleAdminReset = async () => {
    if (!resetTargetUser) return;
    setResetLoading(true);
    try {
      await adminMfaService.resetUserMfa(resetTargetUser.userId);
      setSuccessMsg(`MFA for user '${resetTargetUser.username}' has been securely reset. Active sessions revoked.`);
      setResetTargetUser(null);
      await loadAdminUsers();
      if (resetTargetUser.userId === user?.id) {
        await loadStatus();
      }
    } catch (err) {
      setError({ message: err.message || 'Failed to reset user MFA.' });
    } finally {
      setResetLoading(false);
    }
  };

  // Helpers to copy and download recovery codes
  const copyToClipboard = (text, type = 'secret') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const downloadRecoveryCodes = (codes) => {
    const content = `IAM SERVER - MFA RECOVERY CODES\nGenerated: ${new Date().toISOString()}\nUser: ${user?.username}\n\nIMPORTANT: Keep these one-time codes safe and confidential. Each code can only be used once.\n\n` +
      codes.join('\n') + '\n';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `iam-mfa-recovery-codes-${user?.username}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(139, 92, 246, 0.35)'
              }}>
                <ShieldCheck size={20} color="#ffffff" />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Multi-Factor Authentication (TOTP)
              </h2>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Protect your account using RFC 6238 Time-based One-Time Passwords (compatible with Google Authenticator, Authy, 1Password)
            </p>
          </div>

          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <AlertBanner
          type="error"
          message={error.message}
          details={error.details}
          onClose={() => setError(null)}
        />
      )}

      {successMsg && (
        <AlertBanner
          type="success"
          message={successMsg}
          onClose={() => setSuccessMsg(null)}
        />
      )}

      {/* ENROLLMENT WIZARD MODAL / CARD */}
      {enrolling && enrollData && (
        <div className="glass-panel" style={{ padding: '2rem', border: '1px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                MFA Enrollment Wizard — Step {enrollStep} of 3
              </span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.25rem 0 0 0' }}>
                {enrollStep === 1 && 'Step 1: Scan QR Code with Authenticator App'}
                {enrollStep === 2 && 'Step 2: Verify 6-Digit Authenticator Code'}
                {enrollStep === 3 && 'Step 3: Save Your One-Time Recovery Codes'}
              </h3>
            </div>
            {enrollStep !== 3 && (
              <button
                type="button"
                onClick={() => setEnrolling(false)}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              >
                Cancel
              </button>
            )}
          </div>

          {/* STEP 1: QR & Secret */}
          {enrollStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
                {/* QR Code */}
                <div style={{
                  background: '#ffffff',
                  padding: '1rem',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  border: '2px solid rgba(255,255,255,0.2)'
                }}>
                  <img
                    src={enrollData.qrCodeDataUri}
                    alt="Authenticator QR Code"
                    style={{ width: '200px', height: '200px', display: 'block' }}
                  />
                </div>

                {/* Instructions & Secret */}
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    1. Open your Authenticator app
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                    Scan this QR code with <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, or <strong>Authy</strong>.
                  </p>

                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    2. Or enter the secret key manually
                  </h4>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(0, 0, 0, 0.35)',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '1rem'
                  }}>
                    <code style={{ fontFamily: 'monospace', fontSize: '1.05rem', letterSpacing: '0.1em', color: 'var(--accent-cyan)', flex: 1 }}>
                      {enrollData.secret}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(enrollData.secret, 'secret')}
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      {copiedSecret ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setEnrollStep(2)}
                  className="btn-primary"
                  style={{ padding: '0.6rem 1.5rem' }}
                >
                  Continue to Verification →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Verify Code */}
          {enrollStep === 2 && (
            <form onSubmit={handleVerifyEnrollment} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '450px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Enter the 6-digit confirmation code generated by your authenticator app to verify setup and enable MFA.
                </p>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="form-input"
                    style={{
                      fontSize: '2rem',
                      letterSpacing: '0.4em',
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '0.75rem',
                      fontFamily: 'monospace',
                    }}
                    placeholder="------"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/[^0-9]/g, ''))}
                    disabled={enrollLoading}
                    autoFocus
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setEnrollStep(1)}
                  className="btn-secondary"
                  disabled={enrollLoading}
                >
                  ← Back to QR
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={enrollLoading || verifyCode.length !== 6}
                >
                  {enrollLoading ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <span>Verify & Enable MFA</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Show Recovery Codes */}
          {enrollStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <CheckCircle2 size={24} color="#10b981" />
                <div>
                  <div style={{ fontWeight: 700, color: '#10b981' }}>MFA Enabled Successfully!</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Save these 8 one-time backup recovery codes in a secure location. You will need them if you ever lose access to your authenticator app.
                  </div>
                </div>
              </div>

              {/* Recovery Codes Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)'
              }}>
                {generatedRecoveryCodes.map((code, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '1rem',
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      color: 'var(--accent-cyan)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      textAlign: 'center'
                    }}
                  >
                    {code}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedRecoveryCodes.join('\n'), 'codes')}
                    className="btn-secondary"
                  >
                    {copiedCodes ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                    <span>{copiedCodes ? 'Copied All Codes' : 'Copy All Codes'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadRecoveryCodes(generatedRecoveryCodes)}
                    className="btn-secondary"
                  >
                    <Download size={16} />
                    <span>Download (.txt)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleFinishEnrollment}
                  className="btn-primary"
                  style={{ padding: '0.6rem 1.75rem' }}
                >
                  I Have Saved My Codes
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CURRENT STATUS DASHBOARD CARD */}
      {!enrolling && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            
            {/* MFA Status Indicator */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 600 }}>
                MFA Status
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: status?.enabled ? '#10b981' : '#ef4444',
                  boxShadow: status?.enabled ? '0 0 10px #10b981' : '0 0 10px #ef4444'
                }} />
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: status?.enabled ? '#10b981' : 'var(--text-primary)' }}>
                  {status?.enabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
                {status?.enabled ? 'Account protected with TOTP secondary factor' : 'Account protected with password only'}
              </p>
            </div>

            {/* Authenticator App */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 600 }}>
                Authenticator App
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {status?.enabled ? 'Configured' : 'Not Configured'}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
                {status?.enrolledAt ? `Enrolled: ${new Date(status.enrolledAt).toLocaleDateString()}` : 'RFC 6238 Standard (30s time-step)'}
              </p>
            </div>

            {/* Recovery Codes Remaining */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 600 }}>
                Recovery Codes
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: status?.enabled ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                {status?.enabled ? `${status.recoveryCodesRemaining} remaining` : 'None generated'}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
                {status?.enabled ? 'Hashed securely in PostgreSQL' : 'Generated upon MFA enrollment'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
            {!status?.enabled ? (
              <button
                type="button"
                onClick={handleStartEnrollment}
                disabled={enrollLoading}
                className="btn-primary"
                style={{ padding: '0.65rem 1.75rem' }}
              >
                {enrollLoading ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Preparing Enrollment...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Enable MFA</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowRegenModal(true)}
                  className="btn-secondary"
                >
                  <RefreshCw size={16} />
                  <span>Regenerate Recovery Codes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDisableModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <ShieldAlert size={16} />
                  <span>Disable MFA</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* DISABLE MFA MODAL */}
      {showDisableModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}>
                <AlertTriangle size={24} color="#ef4444" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
                Disable Multi-Factor Authentication
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Strong re-authentication is required. Enter your current password or 6-digit authenticator code.
              </p>
            </div>

            <form onSubmit={handleDisableMfa}>
              <div className="form-group">
                <label className="form-label" htmlFor="disablePassword">Current Password</label>
                <input
                  id="disablePassword"
                  type="password"
                  className="form-input"
                  placeholder="Enter your account password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  disabled={disableLoading}
                />
              </div>

              <div style={{ textAlign: 'center', margin: '0.75rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                — OR —
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="disableCode">Current 6-Digit TOTP Code</label>
                <input
                  id="disableCode"
                  type="text"
                  maxLength={6}
                  className="form-input"
                  placeholder="e.g. 123456"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={disableLoading}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowDisableModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  disabled={disableLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ef4444',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  disabled={disableLoading || (!disablePassword && !disableCode)}
                >
                  {disableLoading ? 'Disabling...' : 'Confirm Disable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGENERATE RECOVERY CODES MODAL */}
      {showRegenModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '2rem' }}>
            {!newRegenCodes ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'rgba(14, 165, 233, 0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.75rem',
                    border: '1px solid rgba(14, 165, 233, 0.3)'
                  }}>
                    <RefreshCw size={24} color="#0ea5e9" />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
                    Regenerate Recovery Codes
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    This will invalidate all current recovery codes. Enter your password or TOTP code to confirm.
                  </p>
                </div>

                <form onSubmit={handleRegenerateCodes}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="regenPassword">Current Password</label>
                    <input
                      id="regenPassword"
                      type="password"
                      className="form-input"
                      placeholder="Enter password"
                      value={regenPassword}
                      onChange={(e) => setRegenPassword(e.target.value)}
                      disabled={regenLoading}
                    />
                  </div>

                  <div style={{ textAlign: 'center', margin: '0.75rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    — OR —
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="regenCode">Current 6-Digit TOTP Code</label>
                    <input
                      id="regenCode"
                      type="text"
                      maxLength={6}
                      className="form-input"
                      placeholder="e.g. 123456"
                      value={regenCode}
                      onChange={(e) => setRegenCode(e.target.value.replace(/[^0-9]/g, ''))}
                      disabled={regenLoading}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowRegenModal(false)}
                      className="btn-secondary"
                      style={{ flex: 1 }}
                      disabled={regenLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{ flex: 1 }}
                      disabled={regenLoading || (!regenPassword && !regenCode)}
                    >
                      {regenLoading ? 'Generating...' : 'Regenerate Codes'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '0.5rem' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
                    New Recovery Codes Generated
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Old recovery codes have been revoked. Store these 8 new codes in a secure location.
                  </p>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.5rem',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  {newRegenCodes.map((code, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: 'var(--accent-cyan)',
                        padding: '0.4rem',
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: '4px'
                      }}
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newRegenCodes.join('\n'), 'regen')}
                    className="btn-secondary"
                  >
                    {copiedCodes ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    <span>{copiedCodes ? 'Copied' : 'Copy All'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadRecoveryCodes(newRegenCodes)}
                    className="btn-secondary"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowRegenModal(false);
                      setNewRegenCodes(null);
                    }}
                    className="btn-primary"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMIN MFA VISIBILITY SECTION */}
      {isAdmin && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  ROLE_ADMIN
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Organization MFA Management & Compliance
                </h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                Administrators can monitor MFA enrollment across all accounts and securely reset compromised MFA instances. Secrets are never exposed.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAdminUsers}
              disabled={adminLoading}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            >
              <RefreshCw size={14} style={{ animation: adminLoading ? 'spin 1s linear infinite' : 'none' }} />
              <span>Refresh Users</span>
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>User ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Username</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Email</th>
                  <th style={{ padding: '0.75rem 1rem' }}>MFA Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Enrolled At</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Recovery Codes</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((u) => (
                  <tr key={u.userId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>#{u.userId}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{u.username}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        className="badge"
                        style={{
                          background: u.mfaEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                          color: u.mfaEnabled ? '#10b981' : 'var(--text-muted)',
                          border: u.mfaEnabled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(100, 116, 139, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.mfaEnabled ? '#10b981' : '#64748b' }} />
                        {u.mfaEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                      {u.enrolledAt ? new Date(u.enrolledAt).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {u.mfaEnabled ? `${u.recoveryCodesRemaining} remaining` : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      {u.mfaEnabled && (
                        <button
                          type="button"
                          onClick={() => setResetTargetUser(u)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#ef4444',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Reset MFA
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ADMIN RESET CONFIRMATION MODAL */}
          {resetTargetUser && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem'
            }}>
              <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <ShieldX size={36} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
                    Confirm Admin MFA Reset
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Are you sure you want to reset MFA for user <strong>{resetTargetUser.username}</strong>?
                  </p>
                </div>

                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1.5rem',
                  lineHeight: 1.5
                }}>
                  Security Consequences:
                  <ul style={{ margin: '0.35rem 0 0 1.25rem', padding: 0 }}>
                    <li>Revokes existing TOTP secret</li>
                    <li>Invalidates all recovery codes</li>
                    <li>Terminates all active user sessions</li>
                    <li>Forces user to re-enroll</li>
                  </ul>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setResetTargetUser(null)}
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    disabled={resetLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminReset}
                    style={{
                      flex: 1,
                      padding: '0.6rem 1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#ef4444',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Resetting...' : 'Yes, Reset MFA'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
