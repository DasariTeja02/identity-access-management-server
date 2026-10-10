import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  Key, 
  Users, 
  Database, 
  Lock, 
  ArrowRight, 
  CheckCircle, 
  Terminal,
  Layers,
  Sparkles
} from 'lucide-react';

export default function WelcomePage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div style={{ flex: 1, padding: '3rem 1.5rem', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '3rem 0 4rem 0' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', borderRadius: '9999px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', marginBottom: '1.5rem' }}>
          <Sparkles size={16} color="#38bdf8" />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.04em' }}>
            PHASE 1 IMPLEMENTED &amp; VERIFIED
          </span>
        </div>

        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>
          Centralized <span className="gradient-text">Identity & Access</span><br />
          Management Platform
        </h1>

        <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '720px', margin: '0 auto 2.5rem auto', lineHeight: 1.6 }}>
          A production-grade, full-stack IAM architecture built on <strong>Spring Boot 3</strong>, 
          <strong> Spring Security 6</strong>, and <strong>React</strong>. Engineered for enterprise RBAC, 
          BCrypt credentials verification, and standard relational database persistence.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn-primary" style={{ padding: '0.9rem 2rem', fontSize: '1rem' }}>
              <span>Enter User Dashboard</span>
              <ArrowRight size={18} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn-primary" style={{ padding: '0.9rem 2rem', fontSize: '1rem' }}>
                <Key size={18} />
                <span>Sign In to IAM</span>
              </Link>
              <Link to="/register" className="btn-secondary" style={{ padding: '0.9rem 2rem', fontSize: '1rem' }}>
                <Users size={18} />
                <span>Create New Account</span>
              </Link>
            </>
          )}
        </div>

        {/* Pre-seeded credentials banner */}
        <div className="glass-panel" style={{ maxWidth: '680px', margin: '0 auto', padding: '1.25rem 1.75rem', textAlign: 'left', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#38bdf8', fontWeight: 600, fontSize: '0.875rem' }}>
            <Terminal size={16} />
            <span>Pre-seeded Demo Credentials (for testing)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', fontSize: '0.8125rem' }}>
            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Administrator Role:</div>
              <div>Username: <strong style={{ color: '#f8fafc' }}>admin</strong></div>
              <div>Password: <strong style={{ color: '#38bdf8' }}>Admin@123456</strong></div>
            </div>
            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Standard User Role:</div>
              <div>Username: <strong style={{ color: '#f8fafc' }}>testuser</strong></div>
              <div>Password: <strong style={{ color: '#34d399' }}>User@123456</strong></div>
            </div>
          </div>
        </div>
      </section>

      {/* Phase 1 Features Grid */}
      <section style={{ margin: '3rem 0' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, textAlign: 'center', marginBottom: '2.5rem' }}>
          Phase 1 Foundation Architecture
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* Card 1 */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Lock size={24} color="#38bdf8" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>BCrypt Password Hashing</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Zero plaintext password persistence. All credentials are cryptographically secured using BCrypt with a standard cost factor of 12.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <ShieldCheck size={24} color="#818cf8" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>RBAC &amp; Authorities</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Normalized many-to-many schema linking Users &rarr; Roles &rarr; Authorities (Permissions) for fine-grained authorization.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Database size={24} color="#34d399" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>PostgreSQL &amp; JPA</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Production schema ready for PostgreSQL with indexes, transactional repositories, entity auditing timestamps, and dev/test profiles.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Layers size={24} color="#fbbf24" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Strict Input Validation</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Jakarta Bean Validation ensures username syntax, RFC-compliant email formatting, duplicate prevention, and strong password policies.
            </p>
          </div>
        </div>
      </section>

      {/* Roadmap overview */}
      <section className="glass-panel" style={{ padding: '2.5rem', marginTop: '3rem' }}>
        <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={20} color="#38bdf8" />
          <span>Platform Roadmap</span>
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Phase 1 provides the bedrock. Subsequent phases will systematically layer on advanced identity protocols:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <span className="badge badge-cyan" style={{ marginBottom: '0.5rem' }}>Phase 1 - Complete</span>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Full-Stack Foundation</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Spring Boot + React + BCrypt + RBAC</div>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span className="badge badge-indigo" style={{ marginBottom: '0.5rem' }}>Phase 2 - Next</span>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>OAuth 2.0 Server</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Auth Code, Client Credentials, Refresh Flow</div>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span className="badge badge-amber" style={{ marginBottom: '0.5rem' }}>Phase 3 - Upcoming</span>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>OIDC &amp; JWT Claims</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>ID Tokens, Custom Claims, Keystore</div>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span className="badge badge-emerald" style={{ marginBottom: '0.5rem' }}>Phases 5-8</span>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Redis, MFA, Admin Suite</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Session Caching, TOTP, Docker Deploy</div>
          </div>
        </div>
      </section>
    </div>
  );
}
