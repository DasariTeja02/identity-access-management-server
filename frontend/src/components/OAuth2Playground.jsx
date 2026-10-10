import React, { useState, useEffect } from 'react';
import { oauth2Service } from '../services/api';
import AlertBanner from './AlertBanner';
import { 
  Key, 
  Server, 
  ShieldCheck, 
  Terminal, 
  Send, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  FileCode, 
  Copy, 
  RefreshCw,
  ExternalLink,
  Lock,
  Workflow
} from 'lucide-react';

export default function OAuth2Playground() {
  const [activeTab, setActiveTab] = useState('m2m'); // 'm2m', 'clients', 'server', 'authcode'
  
  // Server metadata & clients state
  const [serverInfo, setServerInfo] = useState(null);
  const [clients, setClients] = useState([]);
  const [jwksData, setJwksData] = useState(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // M2M Live Runner state
  const [clientId, setClientId] = useState('backend-service');
  const [clientSecret, setClientSecret] = useState('');
  const [scopes, setScopes] = useState('read write');
  const [m2mLoading, setM2mLoading] = useState(false);
  const [tokenResponse, setTokenResponse] = useState(null);
  const [decodedJwt, setDecodedJwt] = useState(null);
  const [m2mError, setM2mError] = useState(null);

  // Protected Resource Tester state
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceResponse, setResourceResponse] = useState(null);
  const [resourceError, setResourceError] = useState(null);

  // Load metadata on mount
  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      setLoadingMetadata(true);
      const [infoRes, clientsRes] = await Promise.all([
        oauth2Service.getServerInfo(),
        oauth2Service.getClients(),
      ]);
      setServerInfo(infoRes.data);
      setClients(clientsRes.data || []);
    } catch (err) {
      console.error('Error loading OAuth2 metadata:', err);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const fetchJwks = async () => {
    try {
      const data = await oauth2Service.getJwks();
      setJwksData(data);
    } catch (err) {
      console.error('Failed to fetch JWKS:', err);
    }
  };

  // Decode JWT payload & header helper
  const decodeToken = (tokenString) => {
    try {
      const parts = tokenString.split('.');
      if (parts.length === 3) {
        const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return { header, payload, signature: parts[2] };
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Run real Client Credentials Flow
  const handleRequestToken = async (e) => {
    e.preventDefault();
    setM2mLoading(true);
    setM2mError(null);
    setTokenResponse(null);
    setDecodedJwt(null);
    setResourceResponse(null);

    try {
      const res = await oauth2Service.requestClientCredentialsToken(clientId, clientSecret, scopes);
      setTokenResponse(res);
      if (res.access_token) {
        const decoded = decodeToken(res.access_token);
        setDecodedJwt(decoded);
      }
    } catch (err) {
      const errorDetail = err.response?.data?.error_description || err.response?.data?.error || err.message || 'Token request failed';
      setM2mError(`OAuth2 Error: ${errorDetail}`);
    } finally {
      setM2mLoading(false);
    }
  };

  // Call Protected Resource with the issued JWT
  const handleCallProtectedResource = async () => {
    if (!tokenResponse?.access_token) return;
    setResourceLoading(true);
    setResourceError(null);

    try {
      const res = await oauth2Service.callProtectedResource(tokenResponse.access_token);
      setResourceResponse(res);
    } catch (err) {
      setResourceError(err.response?.data?.message || err.message || 'Unauthorized');
    } finally {
      setResourceLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem' }}>
      
      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={18} color="#38bdf8" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>OAuth 2.0 Authorization Server</h2>
            <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>Phase 2 Active</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Integrated Spring Authorization Server with persistent registered clients, JWT access tokens, and live grant flows.
          </p>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('m2m')}
            className={activeTab === 'm2m' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem' }}
          >
            <Cpu size={14} />
            <span>M2M Flow Tester</span>
          </button>
          <button
            onClick={() => setActiveTab('authcode')}
            className={activeTab === 'authcode' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem' }}
          >
            <Workflow size={14} />
            <span>Auth Code &amp; PKCE</span>
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={activeTab === 'clients' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem' }}
          >
            <FileCode size={14} />
            <span>Registered Clients ({clients.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('server')}
            className={activeTab === 'server' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem' }}
          >
            <Server size={14} />
            <span>Endpoints &amp; JWKS</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Client Credentials Flow (M2M) Tester */}
      {activeTab === 'm2m' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            
            {/* Request Card */}
            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Terminal size={18} color="#38bdf8" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Request Access Token</h3>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Executes a live <code>POST /oauth2/token</code> request using the <code>client_credentials</code> grant with HTTP Basic Authentication.
              </p>

              {m2mError && <AlertBanner type="error" message={m2mError} onClose={() => setM2mError(null)} />}

              <form onSubmit={handleRequestToken}>
                <div className="form-group">
                  <label className="form-label">Client ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Client Secret</label>
                  <input
                    type="password"
                    className="form-input"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Enter client secret (e.g. Secret123!)"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Requested Scopes</label>
                  <input
                    type="text"
                    className="form-input"
                    value={scopes}
                    onChange={(e) => setScopes(e.target.value)}
                    placeholder="read write iam.admin"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={m2mLoading}
                >
                  <Send size={15} />
                  <span>{m2mLoading ? 'Negotiating with Authorization Server...' : 'Request Access Token'}</span>
                </button>
              </form>
            </div>

            {/* Token & Resource Execution Card */}
            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={18} color="#10b981" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Issued Token &amp; Protected API</h3>
                </div>
                {tokenResponse && <span className="badge badge-emerald">Token Active</span>}
              </div>

              {!tokenResponse ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 1rem' }}>
                  <Lock size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.875rem' }}>No token generated yet.</p>
                  <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Click "Request Access Token" to execute the real OAuth2 handshake.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Token Metadata
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.8125rem' }}>
                      <div>Type: <strong style={{ color: '#38bdf8' }}>{tokenResponse.token_type}</strong></div>
                      <div>TTL: <strong style={{ color: '#34d399' }}>{tokenResponse.expires_in}s</strong></div>
                      <div>Scope: <strong>{tokenResponse.scope}</strong></div>
                      <div>Format: <strong>Self-Contained JWT</strong></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Raw Access Token (Truncated)
                    </div>
                    <div style={{ background: '#0a0d14', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', maxHeight: '80px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      {tokenResponse.access_token}
                    </div>
                  </div>

                  {/* Button to call protected resource */}
                  <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      onClick={handleCallProtectedResource}
                      className="btn-primary"
                      style={{ width: '100%', fontSize: '0.875rem', padding: '0.6rem' }}
                      disabled={resourceLoading}
                    >
                      <CheckCircle2 size={16} />
                      <span>{resourceLoading ? 'Verifying with Resource Server...' : 'Invoke Protected Resource (GET /api/oauth2/protected/user)'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Decoded JWT Claims Inspector */}
          {decodedJwt && (
            <div style={{ background: 'rgba(0, 0, 0, 0.4)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(56, 189, 248, 0.2)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#38bdf8' }}>
                <FileCode size={18} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Decoded JWT Claims (Header &amp; Payload Inspector)</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', fontWeight: 600 }}>
                    JOSE Header
                  </div>
                  <pre style={{ background: '#07090e', padding: '0.75rem', borderRadius: '6px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid var(--border-subtle)' }}>
                    {JSON.stringify(decodedJwt.header, null, 2)}
                  </pre>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', fontWeight: 600 }}>
                    JWT Claims Set (Payload)
                  </div>
                  <pre style={{ background: '#07090e', padding: '0.75rem', borderRadius: '6px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid var(--border-subtle)' }}>
                    {JSON.stringify(decodedJwt.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Protected Resource Response Viewer */}
          {resourceResponse && (
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                <CheckCircle2 size={18} />
                <span>Resource Server Authorized (200 OK)</span>
              </div>
              <pre style={{ background: '#07090e', padding: '0.75rem', borderRadius: '6px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid var(--border-subtle)' }}>
                {JSON.stringify(resourceResponse, null, 2)}
              </pre>
            </div>
          )}

          {resourceError && (
            <AlertBanner type="error" message={resourceError} onClose={() => setResourceError(null)} />
          )}
        </div>
      )}

      {/* TAB 2: Authorization Code & PKCE Flow Guide */}
      {activeTab === 'authcode' && (
        <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '1.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Workflow size={20} color="#38bdf8" />
            <span>OAuth 2.0 Authorization Code Grant with PKCE</span>
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            The Authorization Code flow provides delegated authorization for browser-based interactive web applications. 
            RFC 7636 Proof Key for Code Exchange (PKCE) ensures that intercepted authorization codes cannot be redeemed by malicious actors.
          </p>

          {/* Step Sequence Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            
            <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9375rem', color: '#38bdf8', marginBottom: '0.35rem' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>1</span>
                <span>Client generates PKCE Code Verifier &amp; Challenge</span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                A cryptographically random <code>code_verifier</code> (32 bytes) is created and hashed using SHA-256 to produce the <code>code_challenge</code>.
              </p>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9375rem', color: '#818cf8', marginBottom: '0.35rem' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>2</span>
                <span>Redirect User to Authorization Endpoint</span>
              </div>
              <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', background: '#0a0d14', padding: '0.6rem 0.8rem', borderRadius: '6px', margin: '0.5rem 0', wordBreak: 'break-all', border: '1px solid var(--border-subtle)' }}>
                GET /oauth2/authorize?response_type=code&amp;client_id=iam-web-client&amp;scope=profile%20read&amp;redirect_uri=http://localhost:5173/oauth2/callback&amp;code_challenge=...&amp;code_challenge_method=S256
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                If the user is not authenticated, Spring Security prompts for user login, then issues a <code>302 Redirect</code> containing the temporary <code>code</code>.
              </p>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9375rem', color: '#34d399', marginBottom: '0.35rem' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>3</span>
                <span>Exchange Code for Access Token + Refresh Token</span>
              </div>
              <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', background: '#0a0d14', padding: '0.6rem 0.8rem', borderRadius: '6px', margin: '0.5rem 0', wordBreak: 'break-all', border: '1px solid var(--border-subtle)' }}>
                POST /oauth2/token (grant_type=authorization_code, code=..., redirect_uri=..., code_verifier=...)
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                The Authorization Server validates the code and proves identity by hashing the <code>code_verifier</code>. Upon success, both an Access Token (15m) and Refresh Token (30d) are issued.
              </p>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9375rem', color: '#fbbf24', marginBottom: '0.35rem' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>4</span>
                <span>Refresh Token Renewal</span>
              </div>
              <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', background: '#0a0d14', padding: '0.6rem 0.8rem', borderRadius: '6px', margin: '0.5rem 0', wordBreak: 'break-all', border: '1px solid var(--border-subtle)' }}>
                POST /oauth2/token (grant_type=refresh_token, refresh_token=...)
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                When the 15-minute access token expires, the client uses the refresh token to obtain a brand new access token without prompting the user.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: Registered Clients Directory */}
      {activeTab === 'clients' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            {clients.map((client) => (
              <div key={client.id} style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>{client.clientName}</h3>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      clientId: {client.clientId}
                    </div>
                  </div>
                  <span className="badge badge-indigo">Persistent DB</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8125rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Grants: </span>
                    {client.grantTypes?.map((g, i) => (
                      <span key={i} className="badge badge-cyan" style={{ fontSize: '0.7rem', marginRight: '0.3rem', padding: '0.15rem 0.45rem' }}>
                        {g}
                      </span>
                    ))}
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Allowed Scopes: </span>
                    {client.scopes?.map((s, i) => (
                      <span key={i} className="badge badge-emerald" style={{ fontSize: '0.7rem', marginRight: '0.3rem', padding: '0.15rem 0.45rem' }}>
                        {s}
                      </span>
                    ))}
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Auth Methods: </span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{client.authMethods?.join(', ')}</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Access Token TTL: </span>
                    <span>{client.accessTokenTtlSeconds} seconds</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>PKCE Required: </span>
                    <span style={{ color: client.requirePkce ? '#34d399' : '#fbbf24' }}>
                      {client.requirePkce ? 'Yes (Enforced)' : 'Optional'}
                    </span>
                  </div>

                  {client.redirectUris?.length > 0 && (
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Redirect URIs:</span>
                      <ul style={{ paddingLeft: '1.2rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
                        {client.redirectUris.map((u, i) => <li key={i}>{u}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Server Endpoints & JWKS */}
      {activeTab === 'server' && (
        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={18} color="#38bdf8" />
              <span>Standard RFC OAuth 2.0 Endpoints</span>
            </h3>
            <button
              onClick={fetchJwks}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
            >
              <RefreshCw size={13} />
              <span>Fetch Live JWKS Public Keys</span>
            </button>
          </div>

          {serverInfo && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#0a0d14', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Authorization Endpoint</div>
                <div style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{serverInfo.authorizationEndpoint}</div>
              </div>
              <div style={{ background: '#0a0d14', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Token Endpoint</div>
                <div style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{serverInfo.tokenEndpoint}</div>
              </div>
              <div style={{ background: '#0a0d14', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>JWKS Keystore Endpoint</div>
                <div style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{serverInfo.jwksUri}</div>
              </div>
              <div style={{ background: '#0a0d14', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Token Revocation Endpoint</div>
                <div style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{serverInfo.revocationEndpoint}</div>
              </div>
            </div>
          )}

          {jwksData && (
            <div>
              <div style={{ fontSize: '0.8125rem', color: '#34d399', fontWeight: 600, marginBottom: '0.35rem' }}>
                Live JWKS Key Set (/oauth2/jwks)
              </div>
              <pre style={{ background: '#07090e', padding: '1rem', borderRadius: '6px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', border: '1px solid var(--border-subtle)' }}>
                {JSON.stringify(jwksData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
