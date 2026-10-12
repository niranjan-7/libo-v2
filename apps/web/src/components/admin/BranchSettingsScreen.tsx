import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { CirculationPolicyDto, ReviewPolicyConfigDto, OrgRole } from '@library/contracts';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { FormField, TextInput } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { LoadingState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import {
  Settings,
  Save,
  Clock,
  ShieldAlert,
  Coins,
  Library,
  MessageSquare,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const BranchSettingsScreen: React.FC = () => {
  const { currentOrg, currentLibrary, currentRole } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingCirc, setSavingCirc] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

  // Circulation Policy State
  const [circPolicy, setCircPolicy] = useState<CirculationPolicyDto>({
    loanPeriodDays: 21,
    extensionIncrementDays: 7,
    maxExtensions: 2,
    maxActiveLoans: 5,
    maxPendingReservations: 3,
    pickupWindowHours: 72,
    dailyOverdueFineRate: 10,
    currencyCode: 'INR',
  });

  // Review Policy State
  const [reviewPolicy, setReviewPolicy] = useState<ReviewPolicyConfigDto>({
    requireBorrowHistory: false,
    minAccountAgeDays: 0,
  });

  const orgId = currentOrg?.organization.organizationId;
  const libraryId = currentLibrary?.libraryId;
  const isStaff = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;

  const loadPolicies = useCallback(async () => {
    if (!orgId || !libraryId) return;
    setLoading(true);
    try {
      const [cp, rp] = await Promise.all([
        api.circulation.getPolicy(orgId, libraryId),
        api.community.getPolicy(orgId, libraryId).catch(() => ({
          requireBorrowHistory: false,
          minAccountAgeDays: 0,
        })),
      ]);
      setCircPolicy(cp);
      setReviewPolicy(rp);
    } catch (err: any) {
      showToast(err.message || 'Failed to load branch configuration', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, libraryId, showToast]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const handleSaveCircPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !libraryId || !isStaff) return;
    setSavingCirc(true);
    try {
      const updated = await api.circulation.updatePolicy(orgId, libraryId, circPolicy);
      setCircPolicy(updated);
      showToast('Circulation policy updated successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update circulation policy', 'error');
    } finally {
      setSavingCirc(false);
    }
  };

  const handleSaveReviewPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !libraryId || !isStaff) return;
    setSavingReview(true);
    try {
      const updated = await api.community.updatePolicy(orgId, libraryId, reviewPolicy);
      setReviewPolicy(updated);
      showToast('Community review policy updated successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update review policy', 'error');
    } finally {
      setSavingReview(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
        <LoadingState message="Loading branch settings & policies..." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, margin: '0 0 6px 0' }}>
            Branch Settings & Policies
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
            Configure lending rules, fine rates, holding deadlines, and social review gates for <strong>{currentLibrary?.name}</strong>.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadPolicies}
          iconLeft={<RefreshCw size={14} />}
        >
          Refresh Settings
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Left: Circulation & Financial Lending Rules */}
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Clock size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Circulation Rules</h2>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Loan duration, hold limits, and renewals</span>
            </div>
          </div>

          <form onSubmit={handleSaveCircPolicy} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label="Loan Period (Days)">
                <TextInput
                  type="number"
                  value={circPolicy.loanPeriodDays}
                  onChange={(e) => setCircPolicy({ ...circPolicy, loanPeriodDays: parseInt(e.target.value, 10) || 1 })}
                  min={1}
                  max={120}
                  disabled={!isStaff}
                />
              </FormField>

              <FormField label="Extension Increment (Days)">
                <TextInput
                  type="number"
                  value={circPolicy.extensionIncrementDays}
                  onChange={(e) => setCircPolicy({ ...circPolicy, extensionIncrementDays: parseInt(e.target.value, 10) || 1 })}
                  min={1}
                  max={60}
                  disabled={!isStaff}
                />
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label="Max Extensions Allowed">
                <TextInput
                  type="number"
                  value={circPolicy.maxExtensions}
                  onChange={(e) => setCircPolicy({ ...circPolicy, maxExtensions: parseInt(e.target.value, 10) || 0 })}
                  min={0}
                  max={10}
                  disabled={!isStaff}
                />
              </FormField>

              <FormField label="Active Loan Limit / Reader">
                <TextInput
                  type="number"
                  value={circPolicy.maxActiveLoans}
                  onChange={(e) => setCircPolicy({ ...circPolicy, maxActiveLoans: parseInt(e.target.value, 10) || 1 })}
                  min={1}
                  max={50}
                  disabled={!isStaff}
                />
              </FormField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label="Pending Hold Limit / Reader">
                <TextInput
                  type="number"
                  value={circPolicy.maxPendingReservations}
                  onChange={(e) => setCircPolicy({ ...circPolicy, maxPendingReservations: parseInt(e.target.value, 10) || 1 })}
                  min={1}
                  max={20}
                  disabled={!isStaff}
                />
              </FormField>

              <FormField label="Hold Pickup Window (Hours)">
                <TextInput
                  type="number"
                  value={circPolicy.pickupWindowHours}
                  onChange={(e) => setCircPolicy({ ...circPolicy, pickupWindowHours: parseInt(e.target.value, 10) || 12 })}
                  min={12}
                  max={336}
                  disabled={!isStaff}
                />
              </FormField>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label="Overdue Daily Fine Rate">
                <TextInput
                  type="number"
                  step="0.5"
                  value={circPolicy.dailyOverdueFineRate}
                  onChange={(e) => setCircPolicy({ ...circPolicy, dailyOverdueFineRate: parseFloat(e.target.value) || 0 })}
                  min={0}
                  disabled={!isStaff}
                />
              </FormField>

              <FormField label="Currency Code">
                <TextInput
                  value={circPolicy.currencyCode}
                  onChange={(e) => setCircPolicy({ ...circPolicy, currencyCode: e.target.value.toUpperCase() })}
                  maxLength={5}
                  disabled={!isStaff}
                />
              </FormField>
            </div>

            {isStaff && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Button type="submit" variant="primary" disabled={savingCirc} iconLeft={<Save size={15} />}>
                  {savingCirc ? 'Saving...' : 'Save Circulation Rules'}
                </Button>
              </div>
            )}
          </form>
        </Card>

        {/* Right: Review Policy & Branch Meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Review Gating Policy */}
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'color-mix(in srgb, #f59e0b 15%, var(--surface))', color: '#f59e0b' }}>
                <MessageSquare size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Review Eligibility Gating</h2>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Anti-spam controls for ratings & reviews</span>
              </div>
            </div>

            <form onSubmit={handleSaveReviewPolicy} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--canvas)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '13px' }}>Require Borrow History</strong>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Only readers who have borrowed an edition of this book can publish reviews.
                  </span>
                </div>
                <Switch
                  checked={reviewPolicy.requireBorrowHistory}
                  onChange={(checked) => setReviewPolicy({ ...reviewPolicy, requireBorrowHistory: checked })}
                  disabled={!isStaff}
                />
              </div>

              <FormField label="Minimum Account Age (Days)">
                <TextInput
                  type="number"
                  value={reviewPolicy.minAccountAgeDays}
                  onChange={(e) => setReviewPolicy({ ...reviewPolicy, minAccountAgeDays: parseInt(e.target.value, 10) || 0 })}
                  min={0}
                  max={365}
                  disabled={!isStaff}
                />
              </FormField>

              {isStaff && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <Button type="submit" variant="primary" disabled={savingReview} iconLeft={<Save size={15} />}>
                    {savingReview ? 'Saving...' : 'Save Review Policy'}
                  </Button>
                </div>
              )}
            </form>
          </Card>

          {/* Branch Information */}
          <Card style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <Library size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Branch Metadata</h2>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Tenant database entity record</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>Branch Name:</span>
                <strong>{currentLibrary?.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>Branch Slug:</span>
                <code>{currentLibrary?.slug}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)' }}>Local Timezone:</span>
                <span>{currentLibrary?.timezone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: 'var(--muted)' }}>Branch Status:</span>
                <span className="pill green">{currentLibrary?.status}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
