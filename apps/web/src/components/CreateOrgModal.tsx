import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, X, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateOrgModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { createOrganization } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [initialLibraryName, setInitialLibraryName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [error, setError] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !slug.trim()) {
      setError('Organization name and slug are required.');
      return;
    }

    setIsProvisioning(true);
    try {
      await createOrganization({
        name: name.trim(),
        slug: slug.trim(),
        initialLibraryName: initialLibraryName.trim() || undefined,
        timezone,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to provision organization.');
    } finally {
      setIsProvisioning(false);
    }
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
        maxWidth: '500px',
        padding: '28px',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          disabled={isProvisioning}
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
            <Building2 size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Create New Organization</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Provisions a dedicated PostgreSQL tenant database
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
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
              Organization Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Cambridge Institute of Science"
              disabled={isProvisioning}
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
              URL Slug
            </label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="e.g. cambridge-institute"
              disabled={isProvisioning}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '9px',
                border: '1px solid var(--border)',
                background: 'var(--canvas)',
                color: 'var(--text)',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
            />
            <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              Alphanumeric characters and hyphens only.
            </small>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
              Initial Library Branch Name (Optional)
            </label>
            <input
              type="text"
              value={initialLibraryName}
              onChange={(e) => setInitialLibraryName(e.target.value)}
              placeholder="e.g. Central Campus Library"
              disabled={isProvisioning}
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

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
              Default Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={isProvisioning}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '9px',
                border: '1px solid var(--border)',
                background: 'var(--canvas)',
                color: 'var(--text)',
              }}
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="UTC">UTC (Universal)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isProvisioning}
              className="btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProvisioning}
              className="btn primary"
            >
              {isProvisioning ? 'Provisioning Tenant Database...' : 'Create & Provision Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
