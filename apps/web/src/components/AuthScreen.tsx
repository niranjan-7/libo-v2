import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogIn, UserPlus, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, register, acceptInvite, error, clearError } = useAuth();
  const [tab, setTab] = useState<'login' | 'register' | 'invite'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleTabChange = (newTab: 'login' | 'register' | 'invite') => {
    setTab(newTab);
    setFormError(null);
    clearError();
    setSuccessMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!email || !password) {
      setFormError('Please fill in both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setFormError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!email || !password || !displayName) {
      setFormError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, displayName);
      setSuccessMessage('Account created successfully! You are now logged in.');
    } catch (err: any) {
      setFormError(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!inviteToken) {
      setFormError('Please enter an invitation token.');
      return;
    }

    setIsSubmitting(true);
    try {
      await acceptInvite(inviteToken.trim());
      setSuccessMessage('Invitation accepted successfully! Joining organization...');
    } catch (err: any) {
      setFormError(err.message || 'Failed to accept invitation. Token may be invalid or expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeError = formError || error;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'var(--canvas)',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        padding: '36px 32px',
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'var(--accent)',
            color: '#fff',
            display: 'inline-grid',
            placeItems: 'center',
            marginBottom: '14px',
            boxShadow: '0 8px 20px color-mix(in srgb, var(--accent) 30%, transparent)',
          }}>
            <BookOpen size={28} />
          </div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: '0 0 6px',
            color: 'var(--text)',
          }}>
            Library Platform
          </h1>
          <p style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}>
            Multi-tenant control plane & dedicated PostgreSQL tenant databases
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '6px',
          background: 'var(--canvas)',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '24px',
        }}>
          <button
            type="button"
            onClick={() => handleTabChange('login')}
            style={{
              padding: '8px 12px',
              borderRadius: '9px',
              border: 'none',
              background: tab === 'login' ? 'var(--surface)' : 'transparent',
              color: tab === 'login' ? 'var(--text)' : 'var(--muted)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: tab === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('register')}
            style={{
              padding: '8px 12px',
              borderRadius: '9px',
              border: 'none',
              background: tab === 'register' ? 'var(--surface)' : 'transparent',
              color: tab === 'register' ? 'var(--text)' : 'var(--muted)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: tab === 'register' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('invite')}
            style={{
              padding: '8px 12px',
              borderRadius: '9px',
              border: 'none',
              background: tab === 'invite' ? 'var(--surface)' : 'transparent',
              color: tab === 'invite' ? 'var(--text)' : 'var(--muted)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: tab === 'invite' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Join via Invite
          </button>
        </div>

        {/* Error Alert */}
        {activeError && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: 'var(--danger)',
            color: 'var(--danger-text)',
            padding: '12px 14px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13px',
            lineHeight: 1.45,
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>{activeError}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: 'var(--success)',
            color: 'var(--success-text)',
            padding: '12px 14px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13px',
            lineHeight: 1.45,
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>{successMessage}</div>
          </div>
        )}

        {/* Form: Login */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="librarian@example.com"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              />
            </div>
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              <LogIn size={16} />
              {isSubmitting ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Form: Register */}
        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
                Full Name / Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Dr. Eleanor Vance"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="eleanor@university.edu"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              />
            </div>
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
                Password (min. 8 characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              <UserPlus size={16} />
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Form: Invite */}
        {tab === 'invite' && (
          <form onSubmit={handleAcceptInvite}>
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
                Invitation Token
              </label>
              <input
                type="text"
                required
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="Paste your 64-character invite token here"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
              />
              <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', marginTop: '6px' }}>
                Note: You must be signed in to join an organization using an invitation token.
              </small>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              <KeyRound size={16} />
              {isSubmitting ? 'Verifying Token...' : 'Join Organization'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
