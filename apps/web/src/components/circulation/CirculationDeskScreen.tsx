import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  LoanDto,
  ReservationDto,
  CirculationDeskStatsResponse,
  CirculationPolicyDto,
  LoanStatus,
  ReservationStatus,
  CopyCondition,
} from '@library/contracts';
import { Card, KpiCard } from '../ui/Card';
import { Button } from '../ui/Button';
import { TextInput, Select, FormField } from '../ui/Input';
import { Chip, StatusBadge } from '../ui/Pill';
import { LoadingState, EmptyState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import { Dialog } from '../ui/Dialog';
import { Tabs } from '../ui/Tabs';
import {
  BookOpen,
  Barcode,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Plus,
  ArrowRightLeft,
  Calendar,
  User,
  ShieldCheck,
  Settings,
  Flame,
  Check,
} from 'lucide-react';

export const CirculationDeskScreen: React.FC = () => {
  const { currentOrg, currentLibrary, user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'loans' | 'reservations'>('loans');
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState<CirculationDeskStatsResponse>({
    activeLoansCount: 0,
    overdueLoansCount: 0,
    readyForPickupCount: 0,
    pendingReservationsCount: 0,
  });

  // Loans
  const [loans, setLoans] = useState<LoanDto[]>([]);
  const [loansTotal, setLoansTotal] = useState(0);
  const [loanSearch, setLoanSearch] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState<'all' | 'ACTIVE' | 'OVERDUE' | 'RETURNED'>('ACTIVE');

  // Reservations
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [resTotal, setResTotal] = useState(0);
  const [resStatusFilter, setResStatusFilter] = useState<'all' | 'WAITLISTED' | 'ALLOCATED' | 'READY_FOR_PICKUP'>('all');

  // Policy
  const [policy, setPolicy] = useState<CirculationPolicyDto | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyForm, setPolicyForm] = useState<CirculationPolicyDto>({
    loanPeriodDays: 21,
    extensionIncrementDays: 7,
    maxExtensions: 2,
    maxActiveLoans: 5,
    maxPendingReservations: 3,
    pickupWindowHours: 72,
    currencyCode: 'INR',
    dailyOverdueFineRate: 10,
  });

  // Action Modals
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutBarcode, setCheckoutBarcode] = useState('');
  const [checkoutReaderId, setCheckoutReaderId] = useState('');
  const [checkoutReservationId, setCheckoutReservationId] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnBarcode, setReturnBarcode] = useState('');
  const [returnCondition, setReturnCondition] = useState<CopyCondition>(CopyCondition.GOOD);
  const [isReturning, setIsReturning] = useState(false);

  const [isSweeping, setIsSweeping] = useState(false);

  const orgId = currentOrg?.organization.organizationId;
  const libraryId = currentLibrary?.libraryId;

  const loadData = useCallback(async () => {
    if (!orgId || !libraryId) return;
    setLoading(true);

    try {
      const [statsRes, loansRes, resRes, policyRes] = await Promise.all([
        api.circulation.getStats(orgId, libraryId),
        api.circulation.getLoans(orgId, libraryId, {
          search: loanSearch || undefined,
          status: loanStatusFilter !== 'all' ? loanStatusFilter : undefined,
          limit: 100,
        }),
        api.circulation.getReservations(orgId, libraryId, {
          status: resStatusFilter !== 'all' ? resStatusFilter : undefined,
          limit: 100,
        }),
        api.circulation.getPolicy(orgId, libraryId),
      ]);

      setStats(statsRes);
      setLoans(loansRes.items);
      setLoansTotal(loansRes.total);
      setReservations(resRes.items);
      setResTotal(resRes.total);
      setPolicy(policyRes);
      setPolicyForm(policyRes);
    } catch (err: any) {
      showToast(err.message || 'Failed to load circulation data', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, libraryId, loanSearch, loanStatusFilter, resStatusFilter, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Checkout Handler
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !libraryId) return;
    if (!checkoutBarcode.trim() || !checkoutReaderId.trim()) {
      showToast('Barcode and Reader ID are required', 'error');
      return;
    }

    setIsCheckingOut(true);
    try {
      const result = await api.circulation.checkout(orgId, libraryId, {
        barcode: checkoutBarcode.trim(),
        readerUserId: checkoutReaderId.trim(),
        reservationId: checkoutReservationId.trim() || undefined,
      });

      showToast(`Checked out "${result.bookTitle}" (Due ${new Date(result.dueAt).toLocaleDateString()})`, 'success');
      setShowCheckoutModal(false);
      setCheckoutBarcode('');
      setCheckoutReaderId('');
      setCheckoutReservationId('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to complete checkout', 'error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Return Handler
  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !libraryId) return;
    if (!returnBarcode.trim()) {
      showToast('Barcode is required', 'error');
      return;
    }

    setIsReturning(true);
    try {
      const result = await api.circulation.returnCopy(orgId, libraryId, {
        barcode: returnBarcode.trim(),
        condition: returnCondition,
      });

      if (result.nextReservation) {
        showToast(
          `Returned! Assigned to next reader (${result.nextReservation.readerUserId.slice(0, 8)}...) on hold.`,
          'info',
        );
      } else {
        showToast(`Copy returned successfully and restored to shelf.`, 'success');
      }

      setShowReturnModal(false);
      setReturnBarcode('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to return copy', 'error');
    } finally {
      setIsReturning(false);
    }
  };

  // Extend Loan
  const handleExtendLoan = async (loanId: string, bookTitle: string) => {
    if (!orgId || !libraryId) return;
    try {
      const updated = await api.circulation.extendLoan(orgId, libraryId, loanId);
      showToast(`Extended "${bookTitle}" (+${policy?.extensionIncrementDays || 7}d). Due: ${new Date(updated.dueAt).toLocaleDateString()}`, 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to extend loan', 'error');
    }
  };

  // Ready for Pickup
  const handleMarkReadyForPickup = async (reservationId: string, bookTitle: string) => {
    if (!orgId || !libraryId) return;
    try {
      const updated = await api.circulation.markReadyForPickup(orgId, libraryId, reservationId, {});
      showToast(`Marked ready for pickup! 72-hour countdown started. (Deadline: ${new Date(updated.pickupDeadlineAt!).toLocaleString()})`, 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to confirm pickup ready', 'error');
    }
  };

  // Cancel Reservation
  const handleCancelReservation = async (reservationId: string) => {
    if (!orgId || !libraryId) return;
    if (!confirm('Are you sure you want to cancel this reservation? Any reserved copy will be reassigned or released.')) return;
    try {
      await api.circulation.cancelReservation(orgId, libraryId, reservationId);
      showToast('Reservation cancelled', 'info');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel reservation', 'error');
    }
  };

  // Run 72-hour Expiry Sweep
  const handleRunExpirySweep = async () => {
    if (!orgId || !libraryId) return;
    setIsSweeping(true);
    try {
      const result = await api.circulation.processExpiries(orgId, libraryId);
      showToast(`Expiry sweep finished: ${result.expiredCount} expired holds released, ${result.reassignedCount} reassigned.`, 'info');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to run expiry sweep', 'error');
    } finally {
      setIsSweeping(false);
    }
  };

  // Save Policy
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !libraryId) return;
    try {
      const updated = await api.circulation.updatePolicy(orgId, libraryId, policyForm);
      setPolicy(updated);
      showToast('Circulation policy updated successfully', 'success');
      setShowPolicyModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update policy', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header & Desk Actions */}
      <div className="page-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ArrowRightLeft size={24} color="var(--accent)" /> Circulation Desk
          </h1>
          <p>
            Process walk-in checkouts, fast returns, 72-hour hold queues, and branch lending policies
          </p>
        </div>
        <div className="head-actions">
          <Button
            variant="secondary"
            onClick={handleRunExpirySweep}
            disabled={isSweeping}
            iconLeft={<Clock size={15} />}
          >
            {isSweeping ? 'Sweeping...' : '72h Expiry Sweep'}
          </Button>

          <Button
            variant="secondary"
            onClick={() => setShowReturnModal(true)}
            iconLeft={<CheckCircle2 size={15} />}
          >
            Fast Return
          </Button>

          <Button
            variant="primary"
            onClick={() => setShowCheckoutModal(true)}
            iconLeft={<Plus size={15} />}
          >
            Walk-in Checkout
          </Button>

          <Button
            variant="ghost"
            onClick={() => setShowPolicyModal(true)}
            iconLeft={<Settings size={15} />}
            aria-label="Circulation policy settings"
          />
        </div>
      </div>

      {/* 2. Circulation KPI Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
        }}
      >
        <KpiCard
          label="Active Loans"
          value={stats.activeLoansCount}
          caption={`Max ${policy?.maxActiveLoans || 5} per reader`}
          icon={<BookOpen size={20} />}
        />
        <KpiCard
          label="Overdue Loans"
          value={stats.overdueLoansCount}
          caption={stats.overdueLoansCount > 0 ? 'Requires follow-up' : 'All loans current'}
          icon={<AlertTriangle size={20} />}
        />
        <KpiCard
          label="Ready for Pickup"
          value={stats.readyForPickupCount}
          caption={`72-hour hold window`}
          icon={<Flame size={20} />}
        />
        <KpiCard
          label="Pending Queue"
          value={stats.pendingReservationsCount}
          caption={`Waitlist & allocated`}
          icon={<Clock size={20} />}
        />
      </div>

      {/* 3. Quick Desk Scanner Bar */}
      <Card
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 20px',
          background: 'var(--canvas-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px' }}>
          <Barcode size={22} color="var(--accent)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>Circulation Desk Barcode Scanner</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Scan copy barcodes to check out or return immediately
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowCheckoutModal(true)}
            iconLeft={<Plus size={14} />}
          >
            Checkout Copy
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowReturnModal(true)}
            iconLeft={<CheckCircle2 size={14} />}
          >
            Return Copy
          </Button>
        </div>
      </Card>

      {/* 4. Tabs: Loans vs Holds Queue */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <Tabs
          tabs={[
            { id: 'loans', label: `Active Loans (${stats.activeLoansCount})` },
            { id: 'reservations', label: `Holds & Waitlist (${stats.readyForPickupCount + stats.pendingReservationsCount})` },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as 'loans' | 'reservations')}
        />

        <Button
          size="sm"
          variant="ghost"
          onClick={loadData}
          iconLeft={<RefreshCw size={14} className={loading ? 'spinning' : ''} />}
        >
          Refresh
        </Button>
      </div>

      {/* TAB 1: LOANS */}
      {activeTab === 'loans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: '1 1 260px' }}>
              <TextInput
                placeholder="Search by barcode, title, or reader..."
                value={loanSearch}
                onChange={(e) => setLoanSearch(e.target.value)}
                prefixIcon={<Search size={16} />}
              />
            </div>

            <div style={{ width: '180px' }}>
              <Select
                value={loanStatusFilter}
                onChange={(e) => setLoanStatusFilter(e.target.value as any)}
              >
                <option value="all">All Loans ({loansTotal})</option>
                <option value="ACTIVE">Active Loans</option>
                <option value="RETURNED">Returned History</option>
              </Select>
            </div>
          </div>

          {loading ? (
            <LoadingState message="Loading active circulation loans..." />
          ) : loans.length === 0 ? (
            <EmptyState
              title="No active loans matching filters"
              description="Use Walk-in Checkout to loan a copy to a reader."
              action={{
                label: 'New Checkout',
                onClick: () => setShowCheckoutModal(true),
              }}
            />
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--canvas-subtle)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px' }}>Copy / Barcode</th>
                      <th style={{ padding: '12px 16px' }}>Book Title & Author</th>
                      <th style={{ padding: '12px 16px' }}>Reader User</th>
                      <th style={{ padding: '12px 16px' }}>Checked Out</th>
                      <th style={{ padding: '12px 16px' }}>Due Date</th>
                      <th style={{ padding: '12px 16px' }}>Extensions</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Desk Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan) => {
                      const isOverdue = loan.isOverdue || (loan.status === LoanStatus.ACTIVE && new Date(loan.dueAt).getTime() < Date.now());
                      const daysLeft = Math.round((new Date(loan.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                      return (
                        <tr
                          key={loan.loanId}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: isOverdue ? 'color-mix(in srgb, var(--status-error-bg) 35%, transparent)' : undefined,
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Barcode size={15} color="var(--accent)" />
                              <span>{loan.barcode}</span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>{loan.editionLabel}</span>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{loan.bookTitle}</div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{loan.authorName || 'Unknown Author'}</div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <User size={14} color="var(--muted)" />
                              <span style={{ fontFamily: 'monospace' }}>{loan.readerUserId.slice(0, 8)}...</span>
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '12px' }}>
                            {new Date(loan.checkedOutAt).toLocaleDateString()}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{new Date(loan.dueAt).toLocaleDateString()}</div>
                            {loan.status === LoanStatus.ACTIVE && (
                              <div style={{ fontSize: '11px', fontWeight: 600, color: isOverdue ? 'var(--status-error-text)' : 'var(--muted)' }}>
                                {isOverdue ? `OVERDUE by ${Math.abs(daysLeft)}d` : `${daysLeft} days left`}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: 'var(--canvas-subtle)',
                            }}>
                              {loan.extensionCount} / {policy?.maxExtensions || 2}
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {loan.status === LoanStatus.ACTIVE ? (
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setReturnBarcode(loan.barcode);
                                    setShowReturnModal(true);
                                  }}
                                >
                                  Return
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleExtendLoan(loan.loanId, loan.bookTitle)}
                                  disabled={isOverdue || loan.extensionCount >= (policy?.maxExtensions || 2)}
                                  title={isOverdue ? 'Cannot extend overdue loan' : 'Extend +7 days'}
                                >
                                  Extend
                                </Button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Returned</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: RESERVATIONS & HOLDS QUEUE */}
      {activeTab === 'reservations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ width: '220px' }}>
              <Select
                value={resStatusFilter}
                onChange={(e) => setResStatusFilter(e.target.value as any)}
              >
                <option value="all">All Statuses ({resTotal})</option>
                <option value="READY_FOR_PICKUP">Ready for Pickup (72h)</option>
                <option value="ALLOCATED">Allocated (Awaiting Placement)</option>
                <option value="WAITLISTED">Waitlisted in FIFO Queue</option>
              </Select>
            </div>
          </div>

          {loading ? (
            <LoadingState message="Loading hold queue..." />
          ) : reservations.length === 0 ? (
            <EmptyState
              title="No reservations found"
              description="Readers can place holds on unavailable titles from the catalog."
            />
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--canvas-subtle)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px' }}>Book Title</th>
                      <th style={{ padding: '12px 16px' }}>Reader</th>
                      <th style={{ padding: '12px 16px' }}>Hold Status</th>
                      <th style={{ padding: '12px 16px' }}>Assigned Copy</th>
                      <th style={{ padding: '12px 16px' }}>Countdown / Created</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Staff Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((res) => {
                      const isReady = res.status === ReservationStatus.READY_FOR_PICKUP;
                      const isAllocated = res.status === ReservationStatus.ALLOCATED;
                      const isWaitlisted = res.status === ReservationStatus.WAITLISTED;

                      let deadlineHoursLeft = null;
                      if (res.pickupDeadlineAt) {
                        deadlineHoursLeft = Math.round(
                          (new Date(res.pickupDeadlineAt).getTime() - Date.now()) / (1000 * 60 * 60),
                        );
                      }

                      return (
                        <tr key={res.reservationId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{res.bookTitle}</div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                              {res.authorName} &bull; {res.editionLabel}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <User size={14} color="var(--muted)" />
                              <span style={{ fontFamily: 'monospace' }}>{res.readerUserId.slice(0, 8)}...</span>
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            {isReady && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: 'var(--status-warning-bg)',
                                color: 'var(--status-warning-text)',
                              }}>
                                <Flame size={12} /> Ready for Pickup
                              </span>
                            )}
                            {isAllocated && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: 'var(--status-info-bg)',
                                color: 'var(--status-info-text)',
                              }}>
                                <Check size={12} /> Allocated (Physical copy ready)
                              </span>
                            )}
                            {isWaitlisted && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: 'var(--canvas-subtle)',
                                color: 'var(--muted)',
                              }}>
                                Waitlist Position #{res.queuePosition || 1}
                              </span>
                            )}
                            {![ReservationStatus.READY_FOR_PICKUP, ReservationStatus.ALLOCATED, ReservationStatus.WAITLISTED].includes(res.status) && (
                              <StatusBadge status={res.status} />
                            )}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            {res.assignedBarcode ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace', fontWeight: 600 }}>
                                <Barcode size={14} color="var(--accent)" />
                                {res.assignedBarcode}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Pending return</span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            {isReady && deadlineHoursLeft !== null && (
                              <div style={{ fontWeight: 700, color: deadlineHoursLeft <= 12 ? 'var(--status-error-text)' : 'var(--status-warning-text)' }}>
                                {deadlineHoursLeft > 0 ? `${deadlineHoursLeft} hours left` : 'EXPIRED'}
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              Requested {new Date(res.createdAt).toLocaleDateString()}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              {isAllocated && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleMarkReadyForPickup(res.reservationId, res.bookTitle)}
                                >
                                  Confirm Ready (Start 72h)
                                </Button>
                              )}

                              {isReady && res.assignedBarcode && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    setCheckoutBarcode(res.assignedBarcode!);
                                    setCheckoutReaderId(res.readerUserId);
                                    setCheckoutReservationId(res.reservationId);
                                    setShowCheckoutModal(true);
                                  }}
                                >
                                  Checkout Now
                                </Button>
                              )}

                              {[ReservationStatus.WAITLISTED, ReservationStatus.ALLOCATED, ReservationStatus.READY_FOR_PICKUP].includes(res.status) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCancelReservation(res.reservationId)}
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* MODAL: Walk-in Checkout */}
      <Dialog
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        title="Walk-in Checkout"
        description="Check out a physical library copy to a member reader."
      >
        <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <FormField label="Physical Copy Barcode" required hint="e.g. CP-00142 (Scan or type)">
            <TextInput
              placeholder="CP-00142"
              value={checkoutBarcode}
              onChange={(e) => setCheckoutBarcode(e.target.value)}
              autoFocus
              required
              prefixIcon={<Barcode size={16} />}
            />
          </FormField>

          <FormField label="Reader User ID" required hint="Reader's account user ID">
            <TextInput
              placeholder="UUID or select active reader"
              value={checkoutReaderId}
              onChange={(e) => setCheckoutReaderId(e.target.value)}
              required
              prefixIcon={<User size={16} />}
            />
          </FormField>

          <FormField label="Linked Reservation ID (Optional)" hint="Automatically filled if checking out from hold queue">
            <TextInput
              placeholder="Optional reservation UUID"
              value={checkoutReservationId}
              onChange={(e) => setCheckoutReservationId(e.target.value)}
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="secondary" onClick={() => setShowCheckoutModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isCheckingOut}>
              {isCheckingOut ? 'Checking out...' : 'Complete Checkout'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: Fast Return */}
      <Dialog
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Fast Return"
        description="Return a loaned physical copy, update condition, and auto-allocate to waitlist if one exists."
      >
        <form onSubmit={handleReturn} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <FormField label="Physical Copy Barcode" required hint="Scan copy barcode">
            <TextInput
              placeholder="e.g. CP-00142"
              value={returnBarcode}
              onChange={(e) => setReturnBarcode(e.target.value)}
              autoFocus
              required
              prefixIcon={<Barcode size={16} />}
            />
          </FormField>

          <FormField label="Inspected Condition">
            <Select
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value as CopyCondition)}
            >
              <option value={CopyCondition.NEW}>New / As Mint</option>
              <option value={CopyCondition.GOOD}>Good (Normal wear)</option>
              <option value={CopyCondition.MINOR_WEAR}>Minor Wear (Noticeable wear)</option>
              <option value={CopyCondition.DAMAGED}>Damaged</option>
            </Select>
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="secondary" onClick={() => setShowReturnModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isReturning}>
              {isReturning ? 'Processing Return...' : 'Confirm Return'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: Branch Circulation Policy */}
      <Dialog
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        title="Branch Circulation Policy"
        description="Configure lending periods, hold expiration window, and extension rules for this library branch."
      >
        <form onSubmit={handleSavePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Standard Loan Period (Days)" required>
              <TextInput
                type="number"
                min="1"
                max="90"
                value={String(policyForm.loanPeriodDays)}
                onChange={(e) => setPolicyForm({ ...policyForm, loanPeriodDays: parseInt(e.target.value, 10) || 21 })}
              />
            </FormField>

            <FormField label="Extension Increment (Days)" required>
              <TextInput
                type="number"
                min="1"
                max="30"
                value={String(policyForm.extensionIncrementDays)}
                onChange={(e) => setPolicyForm({ ...policyForm, extensionIncrementDays: parseInt(e.target.value, 10) || 7 })}
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Max Extensions Allowed" required>
              <TextInput
                type="number"
                min="0"
                max="10"
                value={String(policyForm.maxExtensions)}
                onChange={(e) => setPolicyForm({ ...policyForm, maxExtensions: parseInt(e.target.value, 10) || 2 })}
              />
            </FormField>

            <FormField label="Pickup Window (Hours)" required hint="Default 72 hours">
              <TextInput
                type="number"
                min="1"
                max="168"
                value={String(policyForm.pickupWindowHours)}
                onChange={(e) => setPolicyForm({ ...policyForm, pickupWindowHours: parseInt(e.target.value, 10) || 72 })}
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Active Loans Limit" required>
              <TextInput
                type="number"
                min="1"
                max="20"
                value={String(policyForm.maxActiveLoans)}
                onChange={(e) => setPolicyForm({ ...policyForm, maxActiveLoans: parseInt(e.target.value, 10) || 5 })}
              />
            </FormField>

            <FormField label="Pending Reservations Limit" required>
              <TextInput
                type="number"
                min="1"
                max="10"
                value={String(policyForm.maxPendingReservations)}
                onChange={(e) => setPolicyForm({ ...policyForm, maxPendingReservations: parseInt(e.target.value, 10) || 3 })}
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Currency Code" required>
              <TextInput
                value={policyForm.currencyCode}
                onChange={(e) => setPolicyForm({ ...policyForm, currencyCode: e.target.value.toUpperCase() })}
              />
            </FormField>

            <FormField label="Daily Overdue Fine Rate" required>
              <TextInput
                type="number"
                step="0.5"
                min="0"
                value={String(policyForm.dailyOverdueFineRate)}
                onChange={(e) => setPolicyForm({ ...policyForm, dailyOverdueFineRate: parseFloat(e.target.value) || 0 })}
              />
            </FormField>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="secondary" onClick={() => setShowPolicyModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Branch Policy
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
