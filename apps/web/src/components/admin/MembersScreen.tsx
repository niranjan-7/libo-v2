import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { OrgRole } from '@library/contracts';
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
} from 'lucide-react';

interface MembersScreenProps {
  onOpenInviteModal?: () => void;
}

export const MembersScreen: React.FC<MembersScreenProps> = ({ onOpenInviteModal }) => {
  const { currentOrg, currentRole } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<
    Array<{
      userId: string;
      email: string;
      displayName: string;
      role: string;
      status: string;
      joinedAt: string;
    }>
  >([]);
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

  const orgId = currentOrg?.organization.organizationId;
  const isStaff = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [membersList, invitesList] = await Promise.all([
        api.organizations.getMembers(orgId),
        isStaff ? api.organizations.getInvitations(orgId) : Promise.resolve([]),
      ]);
      setMembers(membersList);
      setInvitations(invitesList);
    } catch (err: any) {
      showToast(err.message || 'Failed to load organization members', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, isStaff, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
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
            Invitations ({invitations.length})
          </Chip>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
          <LoadingState message="Loading organization directory..." />
        </div>
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
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
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
                            <strong style={{ display: 'block', color: 'var(--text)' }}>
                              {m.displayName}
                            </strong>
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
                    </tr>
                  ))}
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
    </div>
  );
};
