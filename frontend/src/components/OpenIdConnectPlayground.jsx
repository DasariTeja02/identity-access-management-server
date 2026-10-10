import React, { useState, useEffect } from 'react';
import { oidcService, oauth2Service } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function OpenIdConnectPlayground() {
  const { user } = useAuth();

  // Active tab inside OIDC section
  const [activeTab, setActiveTab] = useState('identity'); // 'identity' | 'flow' | 'inspector' | 'discovery' | 'security'

  // Discovery metadata state
  const [discoveryData, setDiscoveryData] = useState(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  // OIDC Session / Token state
  const [idToken, setIdToken] = useState(() => sessionStorage.getItem('oidc_id_token') || '');
  const [accessToken, setAccessToken] = useState(() => sessionStorage.getItem('oidc_access_token') || '');
  const [decodedIdToken, setDecodedIdToken] = useState(null);

  // UserInfo state
  const [userInfoData, setUserInfoData] = useState(null);
  const [userInfoLoading, setUserInfoLoading] = useState(false);
  const [userInfoError, setUserInfoError] = useState(null);

  // Interactive Flow parameters state
  const [pkceVerifier, setPkceVerifier] = useState('');
  const [pkceChallenge, setPkceChallenge] = useState('');
  const [flowNonce, setFlowNonce] = useState('');
  const [flowState, setFlowState] = useState('');
  const [selectedScopes, setSelectedScopes] = useState(['openid', 'profile', 'email']);
  const [authUrl, setAuthUrl] = useState('');

  // Security test states
  const [securityTestResult, setSecurityTestResult] = useState(null);
  const [securityTesting, setSecurityTesting] = useState(false);

  // Decode JWT helper
  const parseJwt = (token) => {
    try {
      if (!token || typeof token !== 'string') return null;
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.warn('Could not parse JWT:', e);
      return null;
    }
  };

  // On mount or when idToken changes, parse claims
  useEffect(() => {
    if (idToken) {
      const parsed = parseJwt(idToken);
      setDecodedIdToken(parsed);
    } else {
      setDecodedIdToken(null);
    }
  }, [idToken]);

  // Load discovery metadata on mount
  useEffect(() => {
    fetchDiscovery();
    initPkceParams();
  }, []);

  const fetchDiscovery = async () => {
    setDiscoveryLoading(true);
    try {
      const data = await oidcService.getDiscoveryMetadata();
      setDiscoveryData(data);
    } catch (err) {
      console.error('Failed to fetch OIDC discovery:', err);
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const initPkceParams = async () => {
    try {
      const { verifier, challenge } = await oidcService.generatePkce();
      const nonce = 'n-' + oidcService.generateRandomString(16);
      const state = 's-' + oidcService.generateRandomString(16);

      setPkceVerifier(verifier);
      setPkceChallenge(challenge);
      setFlowNonce(nonce);
      setFlowState(state);

      const redirectUri = window.location.origin + '/oauth2/callback';
      const scopes = selectedScopes.join('%20');
      const url = `${window.location.origin}/oauth2/authorize?response_type=code&client_id=iam-web-client&scope=${scopes}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code_challenge=${challenge}&code_challenge_method=S256&nonce=${nonce}&state=${state}`;

      setAuthUrl(url);
    } catch (err) {
      console.error('PKCE generation error:', err);
    }
  };

  const updateScopes = (scope) => {
    let next;
    if (selectedScopes.includes(scope)) {
      if (scope === 'openid') return; // openid is mandatory for OIDC
      next = selectedScopes.filter((s) => s !== scope);
    } else {
      next = [...selectedScopes, scope];
    }
    setSelectedScopes(next);

    const redirectUri = window.location.origin + '/oauth2/callback';
    const scopesStr = next.join('%20');
    const url = `${window.location.origin}/oauth2/authorize?response_type=code&client_id=iam-web-client&scope=${scopesStr}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&code_challenge=${pkceChallenge}&code_challenge_method=S256&nonce=${flowNonce}&state=${flowState}`;

    setAuthUrl(url);
  };

  // Initiate real OIDC login redirect
  const handleStartOidcLogin = () => {
    sessionStorage.setItem('oidc_code_verifier', pkceVerifier);
    sessionStorage.setItem('oidc_state', flowState);
    sessionStorage.setItem('oidc_nonce', flowNonce);

    window.location.href = authUrl;
  };

  // Requirement 15: Fetch UserInfo action
  const handleFetchUserInfo = async (tokenToUse = accessToken) => {
    if (!tokenToUse) {
      setUserInfoError({
        status: 400,
        message: 'No active access token available. Complete the OIDC login flow first.',
      });
      return;
    }

    setUserInfoLoading(true);
    setUserInfoError(null);
    try {
      const data = await oidcService.getUserInfo(tokenToUse);
      setUserInfoData(data);
    } catch (err) {
      console.error('UserInfo error:', err);
      const status = err.response?.status || 500;
      const errorData = err.response?.data;
      setUserInfoError({
        status,
        message: errorData?.error_description || errorData?.error || err.message || 'Request failed',
        raw: errorData,
      });
    } finally {
      setUserInfoLoading(false);
    }
  };

  // Security test helpers
  const runSecurityTest = async (testType) => {
    setSecurityTesting(true);
    setSecurityTestResult(null);

    try {
      if (testType === 'no_token') {
        try {
          await oidcService.getUserInfo('');
          setSecurityTestResult({
            success: false,
            message: 'Unexpected success: Request without token should have been rejected!',
          });
        } catch (err) {
          setSecurityTestResult({
            success: true,
            status: err.response?.status || 401,
            test: 'UserInfo without Access Token',
            expected: '401 Unauthorized',
            result: `Passed: Server correctly rejected request with HTTP ${err.response?.status || 401}`,
            details: err.response?.data,
          });
        }
      } else if (testType === 'invalid_token') {
        try {
          await oidcService.getUserInfo('invalid.jwt.token.signature.12345');
          setSecurityTestResult({
            success: false,
            message: 'Unexpected success: Request with forged token should have been rejected!',
          });
        } catch (err) {
          setSecurityTestResult({
            success: true,
            status: err.response?.status || 401,
            test: 'UserInfo with Forged/Invalid Token',
            expected: '401 Unauthorized (invalid_token)',
            result: `Passed: Server correctly rejected token with HTTP ${err.response?.status || 401}`,
            details: err.response?.data,
          });
        }
      } else if (testType === 'm2m_token') {
        // M2M tokens have client_credentials scopes (no 'openid')
        try {
          const m2m = await oauth2Service.requestClientCredentialsToken('backend-service', 'Secret123!', 'read write');
          if (m2m?.access_token) {
            try {
              await oidcService.getUserInfo(m2m.access_token);
              setSecurityTestResult({
                success: false,
                message: 'Unexpected: Token without openid scope should not be accepted at /userinfo',
              });
            } catch (err) {
              setSecurityTestResult({
                success: true,
                status: err.response?.status || 403,
                test: 'UserInfo with OAuth2 Token lacking "openid" scope',
                expected: '401/403 Client Error (insufficient_scope)',
                result: `Passed: Server rejected token without openid scope with HTTP ${err.response?.status || 403}`,
                details: err.response?.data,
              });
            }
          }
        } catch (err) {
          setSecurityTestResult({
            success: false,
            message: 'Could not obtain test M2M token: ' + err.message,
          });
        }
      }
    } finally {
      setSecurityTesting(false);
    }
  };

  const handleClearOidcSession = () => {
    sessionStorage.removeItem('oidc_id_token');
    sessionStorage.removeItem('oidc_access_token');
    sessionStorage.removeItem('oidc_refresh_token');
    setIdToken('');
    setAccessToken('');
    setDecodedIdToken(null);
    setUserInfoData(null);
    setUserInfoError(null);
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Header & Concept Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          marginBottom: '2rem',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.75rem' }}>🆔</span>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
                OpenID Connect 1.0 (OIDC) Identity Layer
              </h2>
              <span className="badge badge-primary">Phase 3 Complete</span>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', margin: 0, maxWidth: '820px', fontSize: '0.92rem', lineHeight: 1.6 }}>
              OpenID Connect extends our OAuth 2.0 Authorization Server into a complete Identity Provider. It provides signed{' '}
              <strong style={{ color: '#a78bfa' }}>ID Tokens</strong>, a standard{' '}
              <strong style={{ color: '#a78bfa' }}>/userinfo</strong> endpoint, and dynamic discovery metadata to reliably answer:{' '}
              <em>"Who is the authenticated user?"</em>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {idToken ? (
              <button onClick={handleClearOidcSession} className="btn btn-outline" style={{ fontSize: '0.82rem' }}>
                Clear OIDC Session
              </button>
            ) : (
              <button onClick={handleStartOidcLogin} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                🚀 Start OIDC Login
              </button>
            )}
          </div>
        </div>

        {/* Quick architecture diagram pill */}
        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.85rem 1.25rem',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            fontSize: '0.82rem',
            color: '#cbd5e1',
          }}
        >
          <span>
            <strong>Flow:</strong> React SPA ➔ Authorization Request (PKCE + Nonce) ➔ IAM Login ➔ Code Exchange ➔{' '}
            <span style={{ color: '#38bdf8' }}>ID Token</span> + <span style={{ color: '#34d399' }}>Access Token</span> ➔{' '}
            <span style={{ color: '#fbbf24' }}>UserInfo</span>
          </span>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            Issuer: <code>{discoveryData?.issuer || 'http://localhost:8080'}</code>
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'identity', label: '👤 Identity Profile & UserInfo', icon: '👤' },
          { id: 'flow', label: '⚡ Interactive OIDC Flow (PKCE)', icon: '⚡' },
          { id: 'inspector', label: '🔍 ID Token Inspector', icon: '🔍' },
          { id: 'discovery', label: '🌐 OIDC Discovery Document', icon: '🌐' },
          { id: 'security', label: '🛡️ OIDC Security Tester', icon: '🛡️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.25rem',
              background: activeTab === tab.id ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? '#f8fafc' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '0.9rem',
              borderRadius: '6px 6px 0 0',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: IDENTITY PROFILE & LIVE USERINFO */}
      {activeTab === 'identity' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Identity Profile Card (Requirement 14) */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc' }}>OIDC Authenticated Identity</h3>
              {decodedIdToken ? (
                <span className="badge badge-success">OIDC Verified</span>
              ) : (
                <span className="badge badge-outline">In-Session / Pending</span>
              )}
            </div>

            {decodedIdToken ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: '#ffffff',
                    }}
                  >
                    {(decodedIdToken.name || decodedIdToken.sub || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                      {decodedIdToken.name || decodedIdToken.preferred_username || decodedIdToken.sub}
                    </h4>
                    <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                      @{decodedIdToken.preferred_username || decodedIdToken.sub}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ padding: '0.6rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.75rem' }}>Subject (sub)</span>
                    <strong style={{ color: '#38bdf8' }}>{decodedIdToken.sub}</strong>
                  </div>
                  <div style={{ padding: '0.6rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.75rem' }}>Email Verified</span>
                    <strong style={{ color: decodedIdToken.email_verified ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {decodedIdToken.email ? (decodedIdToken.email_verified ? '✓ Verified' : 'Unverified') : 'Not granted'}
                    </strong>
                  </div>
                  <div style={{ padding: '0.6rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.75rem' }}>Email Claim</span>
                    <code>{decodedIdToken.email || '—'}</code>
                  </div>
                  <div style={{ padding: '0.6rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.75rem' }}>Auth Time</span>
                    <span>
                      {decodedIdToken.auth_time ? new Date(decodedIdToken.auth_time * 1000).toLocaleTimeString() : '—'}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '1rem', padding: '0.6rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.75rem' }}>Issuer (iss)</span>
                  <code style={{ fontSize: '0.8rem', color: '#a78bfa' }}>{decodedIdToken.iss}</code>
                </div>

                {decodedIdToken.nonce && (
                  <div style={{ marginTop: '0.5rem', padding: '0.6rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '0.75rem' }}>Nonce Verified</span>
                    <code style={{ fontSize: '0.8rem' }}>{decodedIdToken.nonce}</code>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.6 }}>🔐</div>
                <h4 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>No OIDC ID Token in Browser Storage</h4>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Click below to execute the live OpenID Connect authorization code flow with PKCE and receive a signed ID Token.
                </p>
                <button onClick={handleStartOidcLogin} className="btn btn-primary" style={{ width: '100%' }}>
                  Authenticate via OpenID Connect
                </button>
              </div>
            )}
          </div>

          {/* UserInfo Endpoint Demonstration (Requirement 15) */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc' }}>UserInfo Endpoint Live Caller</h3>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>
                  <code>GET /userinfo</code> with Bearer Access Token
                </span>
              </div>
              <button
                onClick={() => handleFetchUserInfo(accessToken)}
                disabled={userInfoLoading || !accessToken}
                className="btn btn-primary"
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
              >
                {userInfoLoading ? 'Calling...' : 'Fetch UserInfo'}
              </button>
            </div>

            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              The UserInfo endpoint securely returns identity claims for the authenticated user from the existing IAM PostgreSQL repository,
              filtered strictly by the granted scopes (<code>openid</code>, <code>profile</code>, <code>email</code>).
            </p>

            {userInfoError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '0.85rem',
                  borderRadius: '6px',
                  color: 'var(--color-danger)',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                <strong>HTTP {userInfoError.status}:</strong> {userInfoError.message}
              </div>
            )}

            {userInfoData ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span className="badge badge-success">HTTP 200 OK</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>Content-Type: application/json</span>
                </div>
                <pre
                  style={{
                    background: '#090d16',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.82rem',
                    color: '#38bdf8',
                    overflowX: 'auto',
                    maxHeight: '260px',
                  }}
                >
                  {JSON.stringify(userInfoData, null, 2)}
                </pre>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.85rem',
                }}
              >
                {!accessToken
                  ? 'Access token required. Complete the OIDC flow to retrieve a token.'
                  : 'Click "Fetch UserInfo" above to query /userinfo.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE OIDC FLOW (PKCE + NONCE) */}
      {activeTab === 'flow' && (
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc' }}>RFC 7636 PKCE & OIDC Nonce Generator</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
            Browser-based public clients must use the <strong>Authorization Code Flow with PKCE (S256)</strong> to prevent authorization code interception attacks.
            The client secret is never stored or exposed in frontend code.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {/* Scopes selector */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
                Requested OIDC Scopes
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['openid', 'profile', 'email', 'read', 'write'].map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => updateScopes(scope)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      border: selectedScopes.includes(scope) ? '1px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: selectedScopes.includes(scope) ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                      color: selectedScopes.includes(scope) ? '#c4b5fd' : 'var(--color-text-secondary)',
                      cursor: scope === 'openid' ? 'default' : 'pointer',
                    }}
                  >
                    {scope === 'openid' ? '✓ openid (Required)' : (selectedScopes.includes(scope) ? `✓ ${scope}` : `+ ${scope}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* PKCE values */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Cryptographic Parameters
                </label>
                <button onClick={initPkceParams} className="btn btn-outline" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                  Regenerate
                </button>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                <div><strong>Method:</strong> S256</div>
                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <strong>Code Challenge:</strong> <code>{pkceChallenge}</code>
                </div>
                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <strong>Nonce:</strong> <code>{flowNonce}</code>
                </div>
              </div>
            </div>
          </div>

          {/* Generated Authorization URL */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
              Generated Authorization Request URL
            </label>
            <div style={{ background: '#090d16', padding: '0.85rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)', wordBreak: 'break-all', fontSize: '0.8rem', color: '#a78bfa' }}>
              {authUrl}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={handleStartOidcLogin} className="btn btn-primary">
              🚀 Launch Authorization Code + PKCE Flow
            </button>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
              Redirects to IAM Server ➔ Prompts for login if unauthenticated ➔ Returns to /oauth2/callback
            </span>
          </div>
        </div>
      )}

      {/* TAB 3: ID TOKEN INSPECTOR */}
      {activeTab === 'inspector' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>OIDC ID Token Claims Inspector</h3>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                Standard RS256-signed JWT representing the authenticated session identity.
              </p>
            </div>
            {idToken && <span className="badge badge-success">JWT RS256 Verified</span>}
          </div>

          {decodedIdToken ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', color: '#a78bfa', marginBottom: '0.5rem' }}>Standard OIDC Protocol Claims</h4>
                <div style={{ background: '#090d16', borderRadius: '8px', padding: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.82rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ color: 'var(--color-text-secondary)', padding: '0.3rem 0' }}><code>iss</code> (Issuer)</td>
                        <td style={{ color: '#38bdf8' }}>{decodedIdToken.iss}</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--color-text-secondary)', padding: '0.3rem 0' }}><code>sub</code> (Subject)</td>
                        <td style={{ color: '#38bdf8' }}>{decodedIdToken.sub}</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--color-text-secondary)', padding: '0.3rem 0' }}><code>aud</code> (Audience)</td>
                        <td style={{ color: '#38bdf8' }}>{Array.isArray(decodedIdToken.aud) ? decodedIdToken.aud.join(', ') : decodedIdToken.aud}</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--color-text-secondary)', padding: '0.3rem 0' }}><code>exp</code> (Expires)</td>
                        <td>{new Date(decodedIdToken.exp * 1000).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--color-text-secondary)', padding: '0.3rem 0' }}><code>iat</code> (Issued At)</td>
                        <td>{new Date(decodedIdToken.iat * 1000).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--color-text-secondary)', padding: '0.3rem 0' }}><code>auth_time</code></td>
                        <td>{decodedIdToken.auth_time ? new Date(decodedIdToken.auth_time * 1000).toLocaleString() : 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--color-text-secondary)', padding: '0.3rem 0' }}><code>nonce</code></td>
                        <td><code>{decodedIdToken.nonce || 'N/A'}</code></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', color: '#34d399', marginBottom: '0.5rem' }}>Decoded JSON Claims Object</h4>
                <pre
                  style={{
                    background: '#090d16',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.8rem',
                    color: '#e2e8f0',
                    overflowX: 'auto',
                    maxHeight: '260px',
                  }}
                >
                  {JSON.stringify(decodedIdToken, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 1rem 0' }}>
                No active ID Token available to inspect. Complete the interactive OIDC login flow to view decoded claims.
              </p>
              <button onClick={handleStartOidcLogin} className="btn btn-primary">
                Authenticate via OIDC
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DISCOVERY METADATA */}
      {activeTab === 'discovery' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>OpenID Connect Discovery Document</h3>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                Live response from <code>/.well-known/openid-configuration</code>
              </p>
            </div>
            <button onClick={fetchDiscovery} disabled={discoveryLoading} className="btn btn-outline" style={{ fontSize: '0.82rem' }}>
              {discoveryLoading ? 'Refreshing...' : 'Refresh Metadata'}
            </button>
          </div>

          {discoveryData ? (
            <pre
              style={{
                background: '#090d16',
                padding: '1.25rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.82rem',
                color: '#38bdf8',
                overflowX: 'auto',
                maxHeight: '400px',
              }}
            >
              {JSON.stringify(discoveryData, null, 2)}
            </pre>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
              <p style={{ color: 'var(--color-text-secondary)' }}>Loading discovery document from server...</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: OIDC SECURITY TESTER (Requirement 18) */}
      {activeTab === 'security' && (
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc' }}>OpenID Connect Security Verification Tests</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
            Execute automated live security checks against the OIDC endpoints to verify token validation, scope enforcement, and rejection of unauthorized calls.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#f8fafc' }}>Test 1: Missing Token</h4>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Calls <code>GET /userinfo</code> with no Authorization header. Expected: <code>401 Unauthorized</code>.
              </p>
              <button
                onClick={() => runSecurityTest('no_token')}
                disabled={securityTesting}
                className="btn btn-outline"
                style={{ width: '100%', fontSize: '0.82rem' }}
              >
                Test Missing Token
              </button>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#f8fafc' }}>Test 2: Forged Token</h4>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Calls <code>GET /userinfo</code> with an invalid signature. Expected: <code>401 Unauthorized</code>.
              </p>
              <button
                onClick={() => runSecurityTest('invalid_token')}
                disabled={securityTesting}
                className="btn btn-outline"
                style={{ width: '100%', fontSize: '0.82rem' }}
              >
                Test Forged Token
              </button>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#f8fafc' }}>Test 3: Missing "openid" Scope</h4>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Calls <code>GET /userinfo</code> with token lacking <code>openid</code>. Expected: <code>401/403</code> error.
              </p>
              <button
                onClick={() => runSecurityTest('m2m_token')}
                disabled={securityTesting}
                className="btn btn-outline"
                style={{ width: '100%', fontSize: '0.82rem' }}
              >
                Test Lacking Scope
              </button>
            </div>
          </div>

          {securityTestResult && (
            <div
              style={{
                background: securityTestResult.success ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: securityTestResult.success ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className={securityTestResult.success ? 'badge badge-success' : 'badge badge-danger'}>
                  {securityTestResult.success ? '✓ Assertion Passed' : '✗ Failed'}
                </span>
                <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{securityTestResult.test}</strong>
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>
                {securityTestResult.result}
              </p>
              {securityTestResult.details && (
                <pre
                  style={{
                    background: '#090d16',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    color: '#cbd5e1',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(securityTestResult.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
