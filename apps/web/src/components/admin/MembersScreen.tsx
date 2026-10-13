import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { OrgRole, ReaderAccessRequestDto, OrganizationMemberDto } from '@library/contracts';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, StatusBadge } from '../ui/Pill';
import { LoadingState, EmptyState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  Copy,
  Check,
  X,
  UserCheck,
  UserX,
  UserCog,
} from 'lucide-react';

interface MembersScreenProps {
  onOpenInviteModal?: () => void;
  initialTab?: 'members' | 'invitations' | 'requests';
  navigationNonce?: number;
  highlightRequestId?: string | null;
}

export const MembersScreen: React.FC<MembersScreenProps> = ({
  onOpenInviteModal,
  initialTab = 'requests',
  navigationNonce,
  highlightRequestId,
}) => {
  const { currentOrg, currentLibrary, currentRole, activeLibrary, user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'requests'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, navigationNonce]);

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [members, setMembers] = useState<OrganizationMemberDto[]>([]);
  const [selectedMemberForEdit, setSelectedMemberForEdit] = useState<OrganizationMemberDto | null>(null);
  const [editRole, setEditRole] = useState<'ADMIN' | 'LIBRARIAN' | 'READER'>('READER');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [invitations, setInvitations] = useState<
    Array<{
      invitationId: string;
      email: string;
      proposedRole: string;
      targetLibraryId?: string | null;
      expiresAt: string;
      acceptedAt?: string | null;
      createdAt: string;
    }>
  >([]);
  const [accessRequests, setAccessRequests] = useState<ReaderAccessRequestDto[]>([]);

  const orgId = currentOrg?.organization.organizationId || activeLibrary?.organizationId;
  const libraryId = currentLibrary?.libraryId || activeLibrary?.libraryId;
  const isStaff = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [membersList, invitesList, requestsList] = await Promise.all([
        api.organizations.getMembers(orgId),
        isStaff ? api.organizations.getInvitations(orgId) : Promise.resolve([]),
        libraryId ? api.libraries.getAccessRequests(orgId, libraryId) : Promise.resolve([]),
      ]);
      setMembers(membersList);
      setInvitations(invitesList);
      setAccessRequests(requestsList);
    } catch (err: any) {
      showToast(err.message || 'Failed to load organization members or access requests', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, libraryId, isStaff, showToast]);

  const handleApprove = async (requestId: string) => {
    if (!orgId || !libraryId) return;
    setProcessingId(requestId);
    try {
      await api.libraries.approveAccessRequest(orgId, libraryId, requestId);
      showToast('Applicant has been granted active reader access to this library.', 'success');
      setAccessRequests((prev) =>
        prev.map((r) => (r.requestId === requestId ? { ...r, status: 'APPROVED' } : r)),
      );
      // Refresh member list in background
      api.organizations.getMembers(orgId).then((m) => setMembers(m)).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Could not approve reader request.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!orgId || !libraryId) return;
    const reason = window.prompt('Optional rejection reason (or leave blank):');
    if (reason === null) return; // User cancelled prompt

    setProcessingId(requestId);
    try {
      await api.libraries.rejectAccessRequest(orgId, libraryId, requestId, {
        reason: reason.trim() || undefined,
      });
      showToast('Applicant access request was declined.', 'warning');
      setAccessRequests((prev) =>
        prev.map((r) =>
          r.requestId === requestId
            ? { ...r, status: 'REJECTED', rejectionReason: reason.trim() || undefined }
            : r,
        ),
      );
    } catch (err: any) {
      showToast(err.message || 'Could not reject reader request.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const canEditMember = (member: OrganizationMemberDto) => {
    // Cannot edit oneself
    if (member.userId === user?.userId) return false;

    // Organization Owners can edit any other member's access
    if (currentRole === OrgRole.OWNER) return true;

    // Organization Admins can only edit Librarians and Readers/Members; cannot edit Owner or other Admins
    if (currentRole === OrgRole.ADMIN) {
      const isTargetOwnerOrAdmin = member.role === OrgRole.OWNER || member.role === OrgRole.ADMIN;
      return !isTargetOwnerOrAdmin;
    }

    return false;
  };

  const handleOpenEditModal = (member: OrganizationMemberDto) => {
    setSelectedMemberForEdit(member);
    const roleVal: 'ADMIN' | 'LIBRARIAN' | 'READER' =
      member.role === OrgRole.ADMIN
        ? 'ADMIN'
        : member.role === 'LIBRARIAN'
        ? 'LIBRARIAN'
        : 'READER';
    setEditRole(roleVal);
    setEditStatus((member.status as 'ACTIVE' | 'SUSPENDED') || 'ACTIVE');
  };

  const handleSaveAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !selectedMemberForEdit) return;

    setIsSavingAccess(true);
    try {
      const updated = await api.organizations.updateMemberAccess(
        orgId,
        selectedMemberForEdit.userId,
        {
          role: editRole,
          status: editStatus,
        },
      );
      showToast(
        `Successfully updated access permissions for ${selectedMemberForEdit.displayName}.`,
        'success',
      );
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === selectedMemberForEdit.userId
            ? { ...m, role: updated.role, status: updated.status }
            : m,
        ),
      );
      setSelectedMemberForEdit(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to update member access.', 'error');
    } finally {
      setIsSavingAccess(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData, navigationNonce]);

  useEffect(() => {
    if (highlightRequestId && activeTab === 'requests' && accessRequests.length > 0) {
      const el = document.getElementById(`req-row-${highlightRequestId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightRequestId, activeTab, accessRequests]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, margin: '0 0 6px 0' }}>
            Members & Access Management
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
            Manage staff roles, reader access, and membership invitations for <strong>{currentOrg?.organization.name}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
            iconLeft={<RefreshCw size={14} className={loading ? 'spin' : ''} />}
          >
            Refresh
          </Button>
          {isStaff && onOpenInviteModal && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenInviteModal}
              iconLeft={<UserPlus size={14} />}
            >
              Invite Member
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <Chip
          active={activeTab === 'requests'}
          onClick={() => setActiveTab('requests')}
          style={{ cursor: 'pointer' }}
        >
          Reader Access Requests ({accessRequests.filter((r) => r.status === 'PENDING').length} Pending)
        </Chip>
        <Chip
          active={activeTab === 'members'}
          onClick={() => setActiveTab('members')}
          style={{ cursor: 'pointer' }}
        >
          Active Members ({members.length})
        </Chip>
        {isStaff && (
          <Chip
            active={activeTab === 'invitations'}
            onClick={() => setActiveTab('invitations')}
            style={{ cursor: 'pointer' }}
          >
            Staff Invitations ({invitations.length})
          </Chip>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
          <LoadingState message="Loading organization directory and access requests..." />
        </div>
      ) : activeTab === 'requests' ? (
        accessRequests.length === 0 ? (
          <EmptyState
            title="No Access Requests"
            description="No reader access requests have been submitted for this library branch yet."
          />
        ) : (
          <Card style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--canvas)', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Applicant</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Applicant Note</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Requested On</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accessRequests.map((req) => {
                    const isPending = req.status === 'PENDING';
                    const isApproved = req.status === 'APPROVED';
                    const isRejected = req.status === 'REJECTED';
                    const isProcessing = processingId === req.requestId;
                    const isHighlighted = req.requestId === highlightRequestId;

                    return (
                      <tr
                        key={req.requestId}
                        id={`req-row-${req.requestId}`}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'all 0.25s ease',
                          background: isHighlighted
                            ? 'color-mix(in srgb, var(--accent) 16%, var(--surface))'
                            : isPending
                            ? 'color-mix(in srgb, var(--accent-soft) 25%, transparent)'
                            : 'transparent',
                          boxShadow: isHighlighted ? 'inset 4px 0 0 var(--accent)' : 'none',
                        }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: isApproved ? 'var(--success-soft)' : 'var(--accent-soft)',
                                color: isApproved ? 'var(--success)' : 'var(--accent)',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 700,
                                fontSize: '12px',
                              }}
                            >
                              {req.applicantName ? req.applicantName.charAt(0).toUpperCase() : 'R'}
                            </div>
                            <div>
                              <strong style={{ display: 'block', color: 'var(--text)' }}>
                                {req.applicantName}
                              </strong>
                              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                {req.applicantEmail}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', maxWidth: '300px' }}>
                          {req.notes ? (
                            <span style={{ color: 'var(--text)', fontStyle: 'italic', fontSize: '12px' }}>
                              "{req.notes}"
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>None provided</span>
                          )}
                          {req.rejectionReason && (
                            <div style={{ color: 'var(--danger-text)', fontSize: '11px', marginTop: '4px' }}>
                              Feedback: {req.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            className={`pill ${
                              isApproved ? 'green' : isPending ? 'yellow' : 'red'
                            }`}
                            style={{ fontSize: '11px' }}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--muted)' }}>
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          {isPending ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleApprove(req.requestId)}
                                disabled={isProcessing}
                                iconLeft={<UserCheck size={14} />}
                                style={{
                                  background: 'var(--success)',
                                  borderColor: 'transparent',
                                  color: 'var(--success-text)',
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleReject(req.requestId)}
                                disabled={isProcessing}
                                iconLeft={<UserX size={14} />}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: '11px',
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : isApproved ? (
                            <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>
                              Active Member
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                              Declined
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : activeTab === 'members' ? (
        members.length === 0 ? (
          <EmptyState
            title="No Members Found"
            description="No active memberships found in this organization."
          />
        ) : (
          <Card style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--canvas)', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Member</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Role</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Joined Date</th>
                    {(currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN) && (
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const isSelf = m.userId === user?.userId;
                    const editable = canEditMember(m);

                    return (
                      <tr
                        key={m.userId}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'var(--accent-soft)',
                                color: 'var(--accent)',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 700,
                                fontSize: '12px',
                              }}
                            >
                              {m.displayName ? m.displayName.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong style={{ color: 'var(--text)' }}>
                                  {m.displayName}
                                </strong>
                                {isSelf && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      background: 'var(--canvas)',
                                      border: '1px solid var(--border)',
                                      borderRadius: '4px',
                                      padding: '1px 5px',
                                      color: 'var(--muted)',
                                    }}
                                  >
                                    You
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                {m.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            className={`pill ${
                              m.role === OrgRole.OWNER
                                ? 'green'
                                : m.role === OrgRole.ADMIN
                                ? 'blue'
                                : m.role === 'LIBRARIAN'
                                ? 'purple'
                                : 'yellow'
                            }`}
                            style={{ fontSize: '11px' }}
                          >
                            <Shield size={11} style={{ marginRight: '4px' }} />
                            {m.role}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <StatusBadge status={m.status as any} />
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--muted)' }}>
                          {new Date(m.joinedAt).toLocaleDateString()}
                        </td>
                        {(currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN) && (
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            {editable ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEditModal(m)}
                                iconLeft={<UserCog size={13} />}
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                              >
                                Edit Access
                              </Button>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                {isSelf ? 'Self' : 'Protected'}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : (
        /* Invitations Tab */
        invitations.length === 0 ? (
          <EmptyState
            title="No Active Invitations"
            description="All issued invitations have been accepted or expired."
            action={
              onOpenInviteModal
                ? {
                    label: 'Invite Member Now',
                    onClick: onOpenInviteModal,
                  }
                : undefined
            }
          />
        ) : (
          <Card style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--canvas)', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Invited Email</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Proposed Role</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Expires</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Sent On</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => {
                    const isAccepted = !!inv.acceptedAt;
                    const isExpired = !isAccepted && new Date() > new Date(inv.expiresAt);
                    const statusLabel = isAccepted ? 'ACCEPTED' : isExpired ? 'EXPIRED' : 'PENDING';

                    return (
                      <tr key={inv.invitationId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Mail size={15} style={{ color: 'var(--muted)' }} />
                            <strong style={{ color: 'var(--text)' }}>{inv.email}</strong>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className="pill blue" style={{ fontSize: '11px' }}>
                            {inv.proposedRole}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            className={`pill ${
                              statusLabel === 'ACCEPTED'
                                ? 'green'
                                : statusLabel === 'PENDING'
                                ? 'blue'
                                : 'yellow'
                            }`}
                            style={{ fontSize: '11px' }}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--muted)' }}>
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--muted)' }}>
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* Edit Member Access Modal */}
      {selectedMemberForEdit && (
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
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingAccess) {
              setSelectedMemberForEdit(null);
            }
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
              padding: '28px',
              position: 'relative',
            }}
          >
            <button
              onClick={() => !isSavingAccess && setSelectedMemberForEdit(null)}
              disabled={isSavingAccess}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: isSavingAccess ? 'not-allowed' : 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <UserCog size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Update Member Access</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                  {selectedMemberForEdit.displayName} &bull; {selectedMemberForEdit.email}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAccess} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Role Assignment
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '14px',
                  }}
                >
                  {currentRole === OrgRole.OWNER && (
                    <option value="ADMIN">Admin (Organization & Library Administrator)</option>
                  )}
                  <option value="LIBRARIAN">Librarian (Branch Catalog & Floor Plan Staff)</option>
                  <option value="READER">Reader (Borrower & Catalog Viewer)</option>
                </select>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '6px 0 0 0' }}>
                  {editRole === 'ADMIN' &&
                    'Admins have organizational oversight, member invitation rights, and library management capabilities.'}
                  {editRole === 'LIBRARIAN' &&
                    'Librarians can curate the catalog, manage floor plans, approve loans, and process circulation.'}
                  {editRole === 'READER' &&
                    'Readers can discover books, view floor maps, place reservations, and check out available copies.'}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Membership Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '14px',
                  }}
                >
                  <option value="ACTIVE">Active (Normal Access Granted)</option>
                  <option value="SUSPENDED">Suspended (Access Temporarily Revoked)</option>
                </select>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '6px 0 0 0' }}>
                  {editStatus === 'SUSPENDED'
                    ? 'Suspended members are blocked from signing in to library systems and performing actions.'
                    : 'Active members can access all resources permitted by their assigned role.'}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setSelectedMemberForEdit(null)}
                  disabled={isSavingAccess}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSavingAccess}
                >
                  {isSavingAccess ? 'Updating...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

