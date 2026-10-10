import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export default function AlertBanner({ type = 'error', message, details, onClose }) {
  if (!message) return null;

  const isError = type === 'error';
  const isSuccess = type === 'success';

  const borderColor = isError ? 'rgba(244, 63, 94, 0.4)' : isSuccess ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)';
  const bgColor = isError ? 'rgba(244, 63, 94, 0.12)' : isSuccess ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)';
  const iconColor = isError ? '#fb7185' : isSuccess ? '#34d399' : '#38bdf8';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      padding: '0.875rem 1rem',
      backgroundColor: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      marginBottom: '1.25rem',
      fontSize: '0.875rem',
      color: 'var(--text-primary)',
      position: 'relative'
    }}>
      <div style={{ marginTop: '2px', flexShrink: 0 }}>
        {isError && <AlertCircle size={18} color={iconColor} />}
        {isSuccess && <CheckCircle2 size={18} color={iconColor} />}
        {!isError && !isSuccess && <Info size={18} color={iconColor} />}
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: iconColor }}>{message}</div>
        {details && (
          <ul style={{ marginTop: '0.35rem', paddingLeft: '1.2rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {Array.isArray(details) ? (
              details.map((d, i) => <li key={i}>{d}</li>)
            ) : typeof details === 'object' ? (
              Object.entries(details).map(([k, v]) => <li key={k}><strong>{k}</strong>: {v}</li>)
            ) : (
              <li>{details}</li>
            )}
          </ul>
        )}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          style={{ background: 'transparent', color: 'var(--text-muted)', padding: '2px', cursor: 'pointer' }}
          aria-label="Close alert"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
