import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { OrgRole } from '@library/contracts';
import { UserPlus, X, AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteMemberModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { currentOrg, inviteMember } = useAuth();
  const [email, setEmail] = useState('');
  const [proposedRole, setProposedRole] = useState<OrgRole>(OrgRole.MEMBER);
  const [targetLibraryId, setTargetLibraryId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await inviteMember({
        email: email.trim(),
        proposedRole,
        targetLibraryId: targetLibraryId || undefined,
      });
      setGeneratedToken(res.token);
    } catch (err: any) {
      setError(err.message || 'Failed to generate invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setGeneratedToken(null);
    setEmail('');
    setProposedRole(OrgRole.MEMBER);
    setTargetLibraryId('');
    setError(null);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(4px)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 100,
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        width: '100%',
        maxWidth: '480px',
        padding: '28px',
        position: 'relative',
      }}>
        <button
          onClick={handleReset}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'grid',
            placeItems: 'center',
          }}>
            <UserPlus size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Invite Organization Member</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Invite a collaborator to {currentOrg?.organization.name}
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            gap: '8px',
            background: 'var(--danger)',
            color: 'var(--danger-text)',
            padding: '10px 14px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '12px',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <div>{error}</div>
          </div>
        )}

        {generatedToken ? (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--success)',
              color: 'var(--success-text)',
              padding: '12px 14px',
              borderRadius: '10px',
              marginBottom: '16px',
              fontSize: '13px',
              fontWeight: 700,
            }}>
              <CheckCircle2 size={18} />
              <div>Invitation successfully generated!</div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 10px' }}>
              Share this secure invitation token with <strong>{email}</strong>. The recipient can redeem it under "Join via Invite".
            </p>

            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              background: 'var(--canvas)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '8px 12px',
              marginBottom: '20px',
            }}>
              <input
                type="text"
                readOnly
                value={generatedToken}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleCopy}
                className="btn"
                style={{ padding: '6px 10px', fontSize: '11px' }}
              >
                {copied ? <Check size={14} color="var(--success-text)" /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleReset}
                className="btn primary"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
                Colleague's Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@institution.edu"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '9px',
                  border: '1px solid var(--border)',
                  background: 'var(--canvas)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
                Proposed Role
              </label>
              <select
                value={proposedRole}
                onChange={(e) => setProposedRole(e.target.value as OrgRole)}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '9px',
                  border: '1px solid var(--border)',
                  background: 'var(--canvas)',
                  color: 'var(--text)',
                }}
              >
                <option value={OrgRole.MEMBER}>Member (Reader Access)</option>
                <option value={OrgRole.ADMIN}>Admin (Branch Management & Circulation)</option>
              </select>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
                Assign Initial Library Branch (Optional)
              </label>
              <select
                value={targetLibraryId}
                onChange={(e) => setTargetLibraryId(e.target.value)}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '9px',
                  border: '1px solid var(--border)',
                  background: 'var(--canvas)',
                  color: 'var(--text)',
                }}
              >
                <option value="">-- No specific branch --</option>
                {currentOrg?.libraries.map((lib) => (
                  <option key={lib.libraryId} value={lib.libraryId}>
                    {lib.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="btn"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn primary"
              >
                {isSubmitting ? 'Generating Invite...' : 'Generate Invitation Token'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
