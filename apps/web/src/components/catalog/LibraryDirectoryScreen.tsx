import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import { api } from '../../api/client';
import { LibraryDirectoryEntryDto } from '@library/contracts';
import {
  Library,
  Search,
  CheckCircle2,
  Clock,
  Send,
  Building2,
  Globe,
  ArrowRight,
  ShieldAlert,
  X,
  Sparkles,
} from 'lucide-react';

interface Props {
  onSelectLibrary?: (libraryId: string) => void;
  onClose?: () => void;
  embedded?: boolean;
  onCreateOrg?: () => void;
  onJoinInvite?: () => void;
}

export const LibraryDirectoryScreen: React.FC<Props> = ({
  onSelectLibrary,
  onClose,
  embedded = false,
  onCreateOrg,
  onJoinInvite,
}) => {
  const { user, selectActiveLibrary, refreshData } = useAuth();
  const { showToast } = useToast();

  const [libraries, setLibraries] = useState<LibraryDirectoryEntryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'AVAILABLE'>('ALL');

  // Request Access Modal
  const [selectedTargetLib, setSelectedTargetLib] = useState<LibraryDirectoryEntryDto | null>(null);
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  const fetchDirectory = async () => {
    setIsLoading(true);
    try {
      const data = await api.libraries.getDirectory();
      setLibraries(data);
    } catch (err: any) {
      showToast(err.message || 'Could not fetch public libraries directory', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, []);

  const handleEnterLibrary = (lib: LibraryDirectoryEntryDto) => {
    selectActiveLibrary(lib.libraryId);
    if (onSelectLibrary) {
      onSelectLibrary(lib.libraryId);
    }
    showToast(`Now browsing ${lib.name}`, 'success');
    if (onClose) {
      onClose();
    }
  };

  const handleOpenRequestModal = (lib: LibraryDirectoryEntryDto) => {
    setSelectedTargetLib(lib);
    setRequestNotes('');
  };

  const handleSubmitAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetLib) return;

    setIsSubmittingReq(true);
    try {
      await api.libraries.submitAccessRequest(selectedTargetLib.libraryId, {
        notes: requestNotes.trim() || undefined,
      });

      showToast(`Your join request for ${selectedTargetLib.name} has been sent to library staff for approval.`, 'success');

      // Update state locally
      setLibraries((prev) =>
        prev.map((item) =>
          item.libraryId === selectedTargetLib.libraryId
            ? { ...item, membershipStatus: 'PENDING' }
            : item,
        ),
      );

      setSelectedTargetLib(null);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Could not submit access request.', 'error');
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const filteredLibraries = libraries.filter((lib) => {
    const matchesSearch =
      lib.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lib.organizationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lib.slug.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'ACTIVE') return lib.membershipStatus === 'ACTIVE';
    if (filterStatus === 'PENDING') return lib.membershipStatus === 'PENDING';
    if (filterStatus === 'AVAILABLE') return lib.membershipStatus === 'NONE' || lib.membershipStatus === 'REJECTED';

    return true;
  });

  return (
    <div style={{ padding: embedded ? '0' : '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 1. Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Library size={22} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Explore & Discover Libraries</h1>
          </div>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '13px', lineHeight: 1.5 }}>
            Browse libraries across institutions and campuses. Request membership access to start borrowing books.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="btn secondary"
            style={{ padding: '8px 14px', fontSize: '12px' }}
          >
            <X size={16} /> Close Directory
          </button>
        )}
      </div>

      {/* 2. Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--muted)' }}
          />
          <input
            type="text"
            placeholder="Search by library name, campus, or slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '9px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '13px',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {(['ALL', 'ACTIVE', 'PENDING', 'AVAILABLE'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className="btn"
              style={{
                padding: '8px 12px',
                fontSize: '11px',
                fontWeight: filterStatus === st ? 700 : 500,
                background: filterStatus === st ? 'var(--accent)' : 'var(--surface)',
                color: filterStatus === st ? '#fff' : 'var(--text)',
                borderColor: filterStatus === st ? 'var(--accent)' : 'var(--border)',
              }}
            >
              {st === 'ALL' && 'All Libraries'}
              {st === 'ACTIVE' && 'My Libraries'}
              {st === 'PENDING' && 'Pending Approval'}
              {st === 'AVAILABLE' && 'Join Available'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Libraries Grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <Sparkles className="animate-spin" size={28} style={{ margin: '0 auto 12px' }} />
          <div>Discovering active libraries across the platform...</div>
        </div>
      ) : filteredLibraries.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <Building2 size={36} color="var(--muted)" style={{ margin: '0 auto 10px' }} />
          <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>No libraries found</h3>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>
            {searchTerm
              ? `No library matched "${searchTerm}". Try a different search term.`
              : 'No libraries currently available under the selected filter.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '18px',
          }}
        >
          {filteredLibraries.map((lib) => {
            const isApproved = lib.membershipStatus === 'ACTIVE';
            const isPending = lib.membershipStatus === 'PENDING';
            const isRejected = lib.membershipStatus === 'REJECTED';

            return (
              <div
                key={lib.libraryId}
                style={{
                  background: 'var(--surface)',
                  border: isApproved ? '2px solid var(--success)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isApproved ? 'var(--success-soft)' : 'var(--accent-soft)',
                          color: isApproved ? 'var(--success)' : 'var(--accent)',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <Library size={18} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{lib.name}</h3>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {lib.organizationName}
                        </span>
                      </div>
                    </div>

                    {isApproved && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'var(--success)',
                          color: 'var(--success-text)',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircle2 size={12} /> Member
                      </span>
                    )}

                    {isPending && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'var(--warning)',
                          color: 'var(--warning-text)',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        <Clock size={12} /> Pending Approval
                      </span>
                    )}

                    {isRejected && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'var(--danger)',
                          color: 'var(--danger-text)',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        <ShieldAlert size={12} /> Not Approved
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', gap: '14px', margin: '14px 0' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Globe size={13} /> {lib.timezone}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Building2 size={13} /> Slug: {lib.slug}
                    </span>
                  </div>
                </div>

                <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  {isApproved ? (
                    <button
                      onClick={() => handleEnterLibrary(lib)}
                      className="btn primary"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '10px 14px',
                        background: 'var(--success)',
                        color: 'var(--success-text)',
                        borderColor: 'transparent',
                        fontWeight: 700,
                      }}
                    >
                      Enter Library <ArrowRight size={15} />
                    </button>
                  ) : isPending ? (
                    <button
                      disabled
                      className="btn"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '10px 14px',
                        opacity: 0.7,
                        cursor: 'not-allowed',
                      }}
                    >
                      <Clock size={15} /> Request Under Review
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenRequestModal(lib)}
                      className="btn primary"
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '10px 14px',
                        fontWeight: 700,
                      }}
                    >
                      <Send size={14} /> {isRejected ? 'Re-apply for Membership' : 'Request Access to Join'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Optional Institutional Admin Notice */}
      {(onCreateOrg || onJoinInvite) && (
        <div
          style={{
            marginTop: '36px',
            padding: '20px',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--border)',
            background: 'var(--canvas)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>
              Are you an institutional administrator or head of library?
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              Set up a new library organization with a dedicated database partition, or redeem a staff invitation token.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {onCreateOrg && (
              <button
                type="button"
                onClick={onCreateOrg}
                className="btn primary"
                style={{ padding: '8px 14px', fontSize: '12px' }}
              >
                <Building2 size={14} /> Create Organization
              </button>
            )}
            {onJoinInvite && (
              <button
                type="button"
                onClick={onJoinInvite}
                className="btn secondary"
                style={{ padding: '8px 14px', fontSize: '12px' }}
              >
                Join with Staff Token
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Request Access Modal */}
      {selectedTargetLib && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setSelectedTargetLib(null)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Send size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Request Library Access</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  Applying to <strong>{selectedTargetLib.name}</strong> ({selectedTargetLib.organizationName})
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitAccessRequest}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
                  Applicant
                </label>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--canvas)',
                    border: '1px solid var(--border)',
                    fontSize: '12px',
                    color: 'var(--text)',
                  }}
                >
                  <strong>{user?.displayName || 'Reader'}</strong> ({user?.email})
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
                  Optional Note for Staff
                </label>
                <textarea
                  rows={3}
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="e.g. Student ID #, department, research area, or why you'd like access..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--canvas)',
                    color: 'var(--text)',
                    fontSize: '12px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTargetLib(null)}
                  disabled={isSubmittingReq}
                  className="btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReq}
                  className="btn primary"
                >
                  {isSubmittingReq ? 'Submitting...' : 'Send Access Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
