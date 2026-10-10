import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AlertBanner from '../components/AlertBanner';
import { KeyRound, Lock, User, Eye, EyeOff, Loader2, ShieldCheck, Key, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const { login, verifyMfaChallenge } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // MFA Challenge State
  const [mfaChallenge, setMfaChallenge] = useState(null); // { token, username }
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setError({ message: 'Please enter both username/email and password.' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await login({ usernameOrEmail: usernameOrEmail.trim(), password });
      if (response && response.mfaRequired) {
        setMfaChallenge({
          token: response.mfaChallengeToken,
          username: usernameOrEmail.trim(),
        });
        setTotpCode('');
        setRecoveryCode('');
        setUseRecovery(false);
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError({
        message: err.message || 'Authentication failed. Please verify your credentials.',
        details: err.validationErrors,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!useRecovery && (!totpCode || totpCode.trim().length !== 6)) {
      setError({ message: 'Please enter a valid 6-digit verification code.' });
      return;
    }
    if (useRecovery && !recoveryCode.trim()) {
      setError({ message: 'Please enter a backup recovery code.' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verifyMfaChallenge(
        mfaChallenge.token,
        useRecovery ? null : totpCode.trim(),
        useRecovery ? recoveryCode.trim().toUpperCase() : null
      );
      navigate(from, { replace: true });
    } catch (err) {
      setError({
        message: err.message || 'Verification failed. Please check the code and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelMfa = () => {
    setMfaChallenge(null);
    setTotpCode('');
    setRecoveryCode('');
    setUseRecovery(false);
    setError(null);
  };

  const fillDemoAccount = (u, p) => {
    setUsernameOrEmail(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1.5rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem 2rem' }}>
        
        {/* Error Alert */}
        {error && (
          <AlertBanner 
            type="error" 
            message={error.message} 
            details={error.details} 
            onClose={() => setError(null)} 
          />
        )}

        {!mfaChallenge ? (
          /* STEP 1: Username & Password Authentication */
          <>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 0 20px rgba(56, 189, 248, 0.35)'
              }}>
                <KeyRound size={24} color="#ffffff" />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
                Sign In to IAM
              </h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Enter your credentials to access the IAM portal
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="usernameOrEmail">
                  Username or Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="usernameOrEmail"
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="e.g. admin or testuser"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                  <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" htmlFor="password" style={{ marginBottom: 0 }}>
                    Password
                  </label>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            {/* Quick Demo Credentials Autofill */}
            <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', fontWeight: 600 }}>
                Quick Demo Autofill
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('admin', 'Admin@123456')}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                >
                  Fill Admin
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoAccount('testuser', 'User@123456')}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                >
                  Fill Test User
                </button>
              </div>
            </div>

            {/* Sign Up Link */}
            <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'underline' }}>
                Sign Up
              </Link>
            </div>
          </>
        ) : (
          /* STEP 2: Multi-Factor Authentication Challenge */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 0 24px rgba(139, 92, 246, 0.4)'
              }}>
                <ShieldCheck size={28} color="#ffffff" />
              </div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
                Verify Your Identity
              </h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {useRecovery
                  ? 'Enter one of your 10-character backup recovery codes'
                  : 'Enter the 6-digit code from your authenticator app'}
              </p>
            </div>

            <form onSubmit={handleMfaSubmit}>
              {!useRecovery ? (
                <div className="form-group">
                  <label className="form-label" htmlFor="totpCode" style={{ textAlign: 'center', display: 'block' }}>
                    Security Code
                  </label>
                  <input
                    id="totpCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="form-input"
                    style={{
                      fontSize: '1.75rem',
                      letterSpacing: '0.4em',
                      textAlign: 'center',
                      fontWeight: 700,
                      padding: '0.75rem',
                      fontFamily: 'monospace',
                    }}
                    placeholder="------"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label" htmlFor="recoveryCode">
                    Recovery Code
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="recoveryCode"
                      type="text"
                      className="form-input"
                      style={{
                        paddingLeft: '2.5rem',
                        fontFamily: 'monospace',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}
                      placeholder="XXXXX-XXXXX"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                      disabled={loading}
                      autoFocus
                    />
                    <Key size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Recovery codes are single-use and will be permanently consumed upon entry.
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Verify Identity</span>
                )}
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setUseRecovery(!useRecovery);
                    setError(null);
                  }}
                  className="btn-secondary"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  {useRecovery ? 'Use Authenticator App Code' : 'Use Recovery Code'}
                </button>

                <button
                  type="button"
                  onClick={cancelMfa}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    marginTop: '0.25rem',
                  }}
                >
                  <ArrowLeft size={14} /> Cancel & Return to Login
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
