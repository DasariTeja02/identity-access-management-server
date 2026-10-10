import React from 'react';
import { ShieldCheck, Database, Lock, Server } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border-subtle)', background: 'rgba(7, 9, 14, 0.9)', padding: '2.5rem 1.5rem', marginTop: 'auto' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
        
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <ShieldCheck size={18} color="#38bdf8" />
            <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Enterprise IAM Core Server</span>
            <span className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>Phase 1 Foundation</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Centralized Identity, Authentication, and Access Management Architecture.
          </p>
        </div>

        {/* Tech Stack Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span className="badge badge-indigo" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Server size={12} /> Spring Boot 3.3
          </span>
          <span className="badge badge-emerald" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Lock size={12} /> BCrypt (Cost 12)
          </span>
          <span className="badge badge-cyan" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Database size={12} /> PostgreSQL / JPA
          </span>
          <span className="badge badge-amber" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            React 18 + Vite
          </span>
        </div>
      </div>
    </footer>
  );
}
