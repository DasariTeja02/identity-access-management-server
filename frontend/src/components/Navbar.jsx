import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LogOut, LayoutDashboard, User, KeyRound } from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Brand */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)'
          }}>
            <Shield size={22} color="#ffffff" strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>IAM</span>
              <span className="gradient-text">Core</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
              Identity & Access
            </div>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link 
                to="/dashboard"
                className={isActive('/dashboard') ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
              >
                <LayoutDashboard size={16} />
                Dashboard
              </Link>

              {user?.roles?.some(r => r.includes('ADMIN')) && (
                <Link 
                  to="/admin"
                  className={location.pathname.startsWith('/admin') ? 'btn-primary' : 'btn-secondary'}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    fontSize: '0.875rem',
                    borderColor: 'rgba(168, 85, 247, 0.4)',
                    background: location.pathname.startsWith('/admin') ? 'rgba(168, 85, 247, 0.25)' : 'rgba(168, 85, 247, 0.1)',
                    color: '#c084fc'
                  }}
                >
                  <Shield size={16} color="#c084fc" />
                  Admin
                </Link>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#04101d', fontWeight: 700, fontSize: '0.8rem' }}>
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{user?.username}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--accent-cyan)' }}>
                    {user?.roles?.[0] || 'User'}
                  </span>
                </div>
              </div>

              <button 
                onClick={handleLogout}
                className="btn-danger"
                title="Log Out"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Link 
                to="/login"
                className="btn-secondary"
                style={{ padding: '0.5rem 1.1rem', fontSize: '0.875rem' }}
              >
                <KeyRound size={15} />
                <span>Sign In</span>
              </Link>
              <Link 
                to="/register"
                className="btn-primary"
                style={{ padding: '0.5rem 1.1rem', fontSize: '0.875rem' }}
              >
                <User size={15} />
                <span>Create Account</span>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
