import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', textAlign: 'center' }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        background: 'rgba(244, 63, 94, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
        border: '1px solid rgba(244, 63, 94, 0.25)'
      }}>
        <ShieldAlert size={32} color="#fb7185" />
      </div>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>404 - Page Not Found</h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', marginBottom: '2rem' }}>
        The requested resource does not exist on this IAM server or you lack authorization to access it.
      </p>
      <Link to="/" className="btn-primary">
        <ArrowLeft size={16} />
        <span>Return to Safety</span>
      </Link>
    </div>
  );
}
