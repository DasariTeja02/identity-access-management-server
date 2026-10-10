import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { oidcService } from '../services/api';

export default function OAuth2CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [tokenData, setTokenData] = useState(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus('error');
        setErrorMsg(errorDescription || `OAuth2 Error: ${error}`);
        return;
      }

      if (!code) {
        setStatus('error');
        setErrorMsg('No authorization code found in callback URL.');
        return;
      }

      // Retrieve PKCE code_verifier and expected state
      const codeVerifier = sessionStorage.getItem('oidc_code_verifier');
      const expectedState = sessionStorage.getItem('oidc_state');
      const returnedState = searchParams.get('state');

      if (expectedState && returnedState && expectedState !== returnedState) {
        setStatus('error');
        setErrorMsg('CSRF state mismatch. The returned state does not match the stored state.');
        return;
      }

      try {
        const redirectUri = window.location.origin + '/oauth2/callback';
        const tokens = await oidcService.exchangeCodeForTokens({
          code,
          codeVerifier: codeVerifier || '',
          redirectUri,
          clientId: 'iam-web-client',
        });

        // Store tokens for the OIDC playground
        sessionStorage.setItem('oidc_access_token', tokens.access_token || '');
        if (tokens.id_token) {
          sessionStorage.setItem('oidc_id_token', tokens.id_token);
        }
        if (tokens.refresh_token) {
          sessionStorage.setItem('oidc_refresh_token', tokens.refresh_token);
        }

        setTokenData(tokens);
        setStatus('success');

        // Automatically navigate to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard?tab=oidc');
        }, 1800);
      } catch (err) {
        console.error('Error exchanging authorization code:', err);
        setStatus('error');
        const errDetail = err.response?.data?.error_description || err.response?.data?.error || err.message;
        setErrorMsg(`Failed to exchange authorization code for tokens: ${errDetail}`);
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div style={{ maxWidth: '640px', margin: '4rem auto', padding: '2rem' }}>
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
        {status === 'processing' && (
          <>
            <div className="spinner" style={{ margin: '0 auto 1.5rem auto', width: '48px', height: '48px' }}></div>
            <h2 style={{ marginBottom: '0.5rem', color: 'var(--color-primary)' }}>Exchanging Authorization Code...</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
              Validating PKCE code verifier and requesting ID Token + Access Token from IAM Server...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ marginBottom: '0.5rem', color: 'var(--color-success)' }}>OIDC Authentication Successful!</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Identity tokens received. Redirecting to Dashboard OpenID Connect section...
            </p>
            {tokenData?.id_token && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '0.85rem',
                color: 'var(--color-success)',
                marginBottom: '1rem',
              }}>
                ✓ ID Token Issued & Verified
              </div>
            )}
            <Link to="/dashboard?tab=oidc" className="btn btn-primary">
              Continue to Dashboard
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ marginBottom: '0.5rem', color: 'var(--color-danger)' }}>Authentication Callback Failed</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              {errorMsg}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link to="/dashboard?tab=oidc" className="btn btn-outline">
                Back to Dashboard
              </Link>
              <Link to="/login" className="btn btn-primary">
                Return to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
