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
  FineDto,
  FineStatus,
  FineType,
  SystemAuditLogDto,
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
  Receipt,
  ShieldAlert,
  Play,
  FileText,
} from 'lucide-react';

export const CirculationDeskScreen: React.FC = () => {
  const { currentOrg, currentLibrary, user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'loans' | 'reservations' | 'fines' | 'audit'>('loans');
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

  // Fines
  const [fines, setFines] = useState<FineDto[]>([]);
  const [finesTotal, setFinesTotal] = useState(0);
  const [finesOutstandingTotal, setFinesOutstandingTotal] = useState(0);
  const [fineStatusFilter, setFineStatusFilter] = useState<'all' | 'UNPAID' | 'PAID' | 'WAIVED'>('all');
  const [showAssessFineModal, setShowAssessFineModal] = useState(false);
  const [assessReaderId, setAssessReaderId] = useState('');
  const [assessFineType, setAssessFineType] = useState<FineType>(FineType.DAMAGE_FEE);
  const [assessAmount, setAssessAmount] = useState('100');
  const [assessNotes, setAssessNotes] = useState('');
  const [isAssessing, setIsAssessing] = useState(false);

  // Waive Fine
  const [showWaiveModal, setShowWaiveModal] = useState(false);
  const [waiveTargetFine, setWaiveTargetFine] = useState<FineDto | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [isWaiving, setIsWaiving] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<SystemAuditLogDto[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);

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
  const [isRunningOverdueSweep, setIsRunningOverdueSweep] = useState(false);

  const orgId = currentOrg?.organization.organizationId;
  const libraryId = currentLibrary?.libraryId;

  const loadData = useCallback(async () => {
    if (!orgId || !libraryId) return;
    setLoading(true);

    try {
      const [statsRes, loansRes, resRes, policyRes, finesRes, auditRes] = await Promise.all([
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
        api.fines.getFines(orgId, libraryId, {
          status: fineStatusFilter !== 'all' ? fineStatusFilter : undefined,
          limit: 100,
        }),
        api.auditLogs.getAuditLogs(orgId, libraryId, { limit: 50 }),
      ]);

      setStats(statsRes);
      setLoans(loansRes.items);
      setLoansTotal(loansRes.total);
      setReservations(resRes.items);
      setResTotal(resRes.total);
      setPolicy(policyRes);
      setPolicyForm(policyRes);
      setFines(finesRes.items);
      setFinesTotal(finesRes.total);
      setFinesOutstandingTotal(finesRes.totalOutstanding);
      setAuditLogs(auditRes.items);
      setAuditTotal(auditRes.total);
    } catch (err: any) {
      showToast(err.message || 'Failed to load circulation desk data', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    orgId,
    libraryId,
    loanSearch,
    loanStatusFilter,
    resStatusFilter,
    fineStatusFilter,
    showToast,
  ]);

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
      const loan = await api.circulation.checkout(orgId, libraryId, {
        barcode: checkoutBarcode.trim(),
        readerUserId: checkoutReaderId.trim(),
        reservationId: checkoutReservationId.trim() || undefined,
      });

      showToast(`Book "${loan.bookTitle}" checked out! Due on ${new Date(loan.dueAt).toLocaleDateString()}`, 'success');
      setShowCheckoutModal(false);
      setCheckoutBarcode('');
      setCheckoutReaderId('');
      setCheckoutReservationId('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Checkout failed', 'error');
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
      const res = await api.circulation.returnCopy(orgId, libraryId, {
        barcode: returnBarcode.trim(),
        condition: returnCondition,
      });

      if (res.nextReservation) {
        showToast(
          `Book returned! Copy assigned to waitlisted reservation #${res.nextReservation.reservationId.slice(0, 8)}. Ready to place on hold shelf.`,
          'info',
        );
      } else {
        showToast(`Book returned successfully. Status: ${res.copyStatus}`, 'success');
      }

      setShowReturnModal(false);
      setReturnBarcode('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Return failed', 'error');
    } finally {
      setIsReturning(false);
    }
  };

  // Confirm Ready for Pickup
  const handleMarkReadyForPickup = async (reservationId: string, bookTitle: string) => {
    if (!orgId || !libraryId) return;
    try {
      const res = await api.circulation.markReadyForPickup(orgId, libraryId, reservationId, {});
      showToast(`Reservation for "${bookTitle}" confirmed ready. 72-hour pickup countdown started!`, 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to mark ready for pickup', 'error');
    }
  };

  // Cancel Hold
  const handleCancelReservation = async (reservationId: string) => {
    if (!orgId || !libraryId) return;
    if (!confirm('Cancel this reservation? Any allocated copy will be released.')) return;
    try {
      await api.circulation.cancelReservation(orgId, libraryId, reservationId);
      showToast('Reservation cancelled and copy released', 'info');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel reservation', 'error');
    }
  };

  // 72h Expiry Sweep
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

  // Overdue Fine Sweep (Idempotent)
  const handleRunOverdueSweep = async () => {
    if (!orgId || !libraryId) return;
    setIsRunningOverdueSweep(true);
    try {
      const result = await api.jobs.runOverdueFines(orgId, libraryId);
      showToast(
        `Overdue sweep completed! ${result.metrics?.finesGeneratedCount || 0} fine(s) generated (${policy?.currencyCode || 'INR'} ${(result.metrics?.totalFineAmount || 0).toFixed(2)}).`,
        'success',
      );
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to execute overdue sweep', 'error');
    } finally {
      setIsRunningOverdueSweep(false);
    }
  };

  // Assess Manual Fine
  const handleAssessFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !libraryId) return;
    const amount = parseFloat(assessAmount);
    if (!assessReaderId.trim() || isNaN(amount) || amount <= 0) {
      showToast('Reader ID and a positive amount are required', 'error');
      return;
    }

    setIsAssessing(true);
    try {
      await api.fines.createManualFine(orgId, libraryId, {
        readerUserId: assessReaderId.trim(),
        fineType: assessFineType,
        amount,
        notes: assessNotes.trim() || undefined,
      });

      showToast(`Fine assessed successfully (${policy?.currencyCode || 'INR'} ${amount.toFixed(2)})`, 'success');
      setShowAssessFineModal(false);
      setAssessReaderId('');
      setAssessNotes('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to assess fine', 'error');
    } finally {
      setIsAssessing(false);
    }
  };

  // Waive Fine
  const handleWaiveFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !libraryId || !waiveTargetFine) return;
    if (!waiveReason.trim()) {
      showToast('A mandatory non-empty waiver reason is required', 'error');
      return;
    }

    setIsWaiving(true);
    try {
      await api.fines.waiveFine(orgId, libraryId, waiveTargetFine.fineId, {
        reason: waiveReason.trim(),
      });

      showToast('Fine waived and recorded in system audit logs', 'success');
      setShowWaiveModal(false);
      setWaiveTargetFine(null);
      setWaiveReason('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to waive fine', 'error');
    } finally {
      setIsWaiving(false);
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

  const currency = policy?.currencyCode || 'INR';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header & Desk Actions */}
      <div className="page-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ArrowRightLeft size={24} color="var(--accent)" /> Circulation Desk
          </h1>
          <p>
            Process walk-in checkouts, fast returns, 72-hour hold queues, member fines, and audit trails
          </p>
        </div>
        <div className="head-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={handleRunOverdueSweep}
            disabled={isRunningOverdueSweep}
            iconLeft={<Play size={14} />}
          >
            {isRunningOverdueSweep ? 'Sweeping...' : 'Run Daily Overdue Sweep'}
          </Button>

          <Button
            variant="secondary"
            onClick={handleRunExpirySweep}
            disabled={isSweeping}
            iconLeft={<Clock size={14} />}
          >
            {isSweeping ? 'Sweeping...' : '72h Expiry Sweep'}
          </Button>

          <Button
            variant="secondary"
            onClick={() => setShowReturnModal(true)}
            iconLeft={<CheckCircle2 size={14} />}
          >
            Fast Return
          </Button>

          <Button
            variant="primary"
            onClick={() => setShowCheckoutModal(true)}
            iconLeft={<Plus size={14} />}
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
          value={String(stats.activeLoansCount)}
          caption="Currently checked out by readers"
          icon={<BookOpen size={20} />}
        />
        <KpiCard
          label="Overdue Loans"
          value={String(stats.overdueLoansCount)}
          caption={stats.overdueLoansCount > 0 ? 'Accruing daily overdue fines' : 'All loans in good standing'}
          icon={<AlertTriangle size={20} color={stats.overdueLoansCount > 0 ? 'var(--status-danger-text)' : undefined} />}
        />
        <KpiCard
          label="Ready on Hold Shelf"
          value={String(stats.readyForPickupCount)}
          caption="72-hour pickup countdown running"
          icon={<Clock size={20} color={stats.readyForPickupCount > 0 ? 'var(--status-warning-text)' : undefined} />}
        />
        <KpiCard
          label="Total Outstanding Fines"
          value={`${currency} ${finesOutstandingTotal.toFixed(2)}`}
          caption={`${finesTotal} fine records in ledger`}
          icon={<Receipt size={20} color={finesOutstandingTotal > 0 ? 'var(--status-danger-text)' : undefined} />}
        />
      </div>

      {/* 3. Barcode Quick Actions Banner */}
      <Card
        style={{
          display: 'flex',
          justifyContent: 'space-between',
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
              Scan copy barcodes to check out, return, or assess fees immediately
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowAssessFineModal(true)}
            iconLeft={<Receipt size={14} />}
          >
            Assess Fine
          </Button>
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

      {/* 4. Tabs: Loans vs Holds Queue vs Fines vs System Audit Logs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
        <Tabs
          tabs={[
            { id: 'loans', label: `Active & Recent Loans (${loansTotal})` },
            { id: 'reservations', label: `Hold Waitlist & Ready Copies (${resTotal})` },
            { id: 'fines', label: `Fines & Waivers (${finesTotal})` },
            { id: 'audit', label: `System Audit Logs (${auditTotal})` },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as any)}
        />
      </div>

      {loading ? (
        <LoadingState message="Loading circulation records..." />
      ) : activeTab === 'loans' ? (
        /* 5. Loans Table View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px' }}>
              <TextInput
                placeholder="Search by title, author, reader ID or barcode..."
                value={loanSearch}
                onChange={(e) => setLoanSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['all', 'ACTIVE', 'OVERDUE', 'RETURNED'] as const).map((st) => (
                <button
                  key={st}
                  className={`btn ${loanStatusFilter === st ? 'primary' : 'ghost'}`}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={() => setLoanStatusFilter(st)}
                >
                  {st === 'all' ? 'All Loans' : st}
                </button>
              ))}
            </div>
          </div>

          {loans.length === 0 ? (
            <EmptyState
              title="No loans matching filter"
              description="Check out a copy using the walk-in checkout button above."
            />
          ) : (
            <Card style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--canvas-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Book Title / Barcode</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Borrower</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Due Date</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Renewals</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan) => {
                      const dueDate = new Date(loan.dueAt);
                      const isOverdue = loan.isOverdue || dueDate.getTime() < Date.now();
                      const isActive = loan.status === LoanStatus.ACTIVE;

                      return (
                        <tr key={loan.loanId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700 }}>{loan.bookTitle}</div>
                            <div style={{ color: 'var(--muted)', fontSize: '12px', fontFamily: 'monospace' }}>
                              {loan.barcode}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <User size={14} color="var(--muted)" />
                              <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                {loan.readerUserId.slice(0, 8)}...
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: isOverdue && isActive ? 700 : 500, color: isOverdue && isActive ? 'var(--status-danger-text)' : undefined }}>
                              {dueDate.toLocaleDateString()}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              Checked out {new Date(loan.checkedOutAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <StatusBadge
                              status={loan.status === LoanStatus.RETURNED ? 'Returned' : isOverdue ? 'Overdue' : 'Active'}
                            />
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>
                            {loan.extensionCount} / 2
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {isActive && (
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
      ) : activeTab === 'reservations' ? (
        /* 6. Holds Queue Table View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {(['all', 'WAITLISTED', 'ALLOCATED', 'READY_FOR_PICKUP'] as const).map((st) => (
              <button
                key={st}
                className={`btn ${resStatusFilter === st ? 'primary' : 'ghost'}`}
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => setResStatusFilter(st)}
              >
                {st === 'all' ? 'All Holds' : st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {reservations.length === 0 ? (
            <EmptyState
              title="No hold reservations matching filter"
              description="Holds are created by readers when all physical copies of a title are on loan."
            />
          ) : (
            <Card style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--canvas-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Title / Edition</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Reader</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Hold Queue State</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Copy</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Countdown / Created</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((res) => {
                      const isReady = res.status === ReservationStatus.READY_FOR_PICKUP;
                      const isAllocated = res.status === ReservationStatus.ALLOCATED;
                      const isWaitlisted = res.status === ReservationStatus.WAITLISTED;

                      const deadlineHoursLeft = res.pickupDeadlineAt
                        ? Math.max(0, Math.round((new Date(res.pickupDeadlineAt).getTime() - Date.now()) / (1000 * 60 * 60)))
                        : null;

                      return (
                        <tr key={res.reservationId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700 }}>{res.bookTitle}</div>
                            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{res.editionLabel}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                              {res.readerUserId.slice(0, 8)}...
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
                                <Flame size={12} /> Ready on Hold Shelf
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
                              <div style={{ fontWeight: 700, color: deadlineHoursLeft <= 12 ? 'var(--status-danger-text)' : 'var(--status-warning-text)' }}>
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
      ) : activeTab === 'fines' ? (
        /* 7. Fines & Waivers Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['all', 'UNPAID', 'PAID', 'WAIVED'] as const).map((st) => (
                <button
                  key={st}
                  className={`btn ${fineStatusFilter === st ? 'primary' : 'ghost'}`}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={() => setFineStatusFilter(st)}
                >
                  {st === 'all' ? 'All Fines' : st}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowAssessFineModal(true)}
              iconLeft={<Plus size={14} />}
            >
              Assess Manual Fine
            </Button>
          </div>

          {fines.length === 0 ? (
            <EmptyState
              title="No fines found"
              description="Overdue fines are accrued automatically by the daily sweep, or assessed manually for damaged/lost books."
            />
          ) : (
            <Card style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--canvas-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Reader ID</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Fine Type / Reason</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Amount</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Outstanding</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date Assessed</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fines.map((f) => {
                      const isUnpaid = f.status === FineStatus.UNPAID;
                      return (
                        <tr key={f.fineId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px' }}>
                            {f.readerUserId.slice(0, 8)}...
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{f.fineType.replace(/_/g, ' ')}</div>
                            {f.bookTitle && (
                              <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
                                Book: {f.bookTitle} ({f.barcode || 'N/A'})
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            {currency} {f.amount.toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: f.outstandingAmount > 0 ? 'var(--status-danger-text)' : 'var(--muted)' }}>
                            {currency} {f.outstandingAmount.toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background:
                                  f.status === FineStatus.PAID
                                    ? 'var(--status-success-bg)'
                                    : f.status === FineStatus.WAIVED
                                    ? 'var(--status-info-bg)'
                                    : 'var(--status-danger-bg)',
                                color:
                                  f.status === FineStatus.PAID
                                    ? 'var(--status-success-text)'
                                    : f.status === FineStatus.WAIVED
                                    ? 'var(--status-info-text)'
                                    : 'var(--status-danger-text)',
                              }}
                            >
                              {f.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '12px' }}>
                            {f.fineDate || new Date(f.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {isUnpaid && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setWaiveTargetFine(f);
                                  setShowWaiveModal(true);
                                }}
                              >
                                Waive Fine
                              </Button>
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
      ) : (
        /* 8. System Audit Logs Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {auditLogs.length === 0 ? (
            <EmptyState
              title="No audit logs available"
              description="Critical administrative actions such as book checkouts, returns, fine waivers, and background sweeps write immutable audit entries."
            />
          ) : (
            <Card style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--canvas-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Timestamp</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Action</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Entity</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Actor User ID</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Audit Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.auditId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '12px' }}>
                          {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'var(--canvas-subtle)',
                              border: '1px solid var(--border)',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                          <strong>{log.entityType}</strong>: {log.entityId ? `${log.entityId.slice(0, 8)}...` : 'N/A'}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--muted)' }}>
                          {log.actorUserId ? `${log.actorUserId.slice(0, 8)}...` : 'SYSTEM'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--muted)' }}>
                          {log.newValue ? JSON.stringify(log.newValue) : '—'}
                        </td>
                      </tr>
                    ))}
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
        title="Walk-in Book Checkout"
        description="Atomically creates an active loan, sets copy status to LOANED, and fulfills linked reservations."
      >
        <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          <FormField label="Physical Copy Barcode" required hint="e.g. CP-00121">
            <TextInput
              placeholder="Scan or enter copy barcode..."
              value={checkoutBarcode}
              onChange={(e) => setCheckoutBarcode(e.target.value)}
              autoFocus
            />
          </FormField>

          <FormField label="Borrower Reader User ID" required hint="Reader central UUID">
            <TextInput
              placeholder="Paste reader UUID..."
              value={checkoutReaderId}
              onChange={(e) => setCheckoutReaderId(e.target.value)}
            />
          </FormField>

          <FormField label="Linked Reservation ID (Optional)" hint="Leave blank for walk-in checkout">
            <TextInput
              placeholder="Optional reservation UUID..."
              value={checkoutReservationId}
              onChange={(e) => setCheckoutReservationId(e.target.value)}
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="secondary" onClick={() => setShowCheckoutModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isCheckingOut}>
              {isCheckingOut ? 'Processing...' : 'Complete Checkout'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: Fast Return */}
      <Dialog
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Physical Copy Return"
        description="Closes active loan, updates copy condition, and checks next reservation in FIFO queue."
      >
        <form onSubmit={handleReturn} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          <FormField label="Physical Copy Barcode" required hint="e.g. CP-00121">
            <TextInput
              placeholder="Scan or enter copy barcode..."
              value={returnBarcode}
              onChange={(e) => setReturnBarcode(e.target.value)}
              autoFocus
            />
          </FormField>

          <FormField label="Inspected Copy Condition" required>
            <Select
              value={returnCondition}
              onChange={(e) => setReturnCondition(e.target.value as CopyCondition)}
            >
              <option value={CopyCondition.NEW}>NEW (Like new condition)</option>
              <option value={CopyCondition.GOOD}>GOOD (Standard wear)</option>
              <option value={CopyCondition.MINOR_WEAR}>MINOR WEAR (Acceptable)</option>
              <option value={CopyCondition.DAMAGED}>DAMAGED (Requires fee / repair)</option>
            </Select>
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="secondary" onClick={() => setShowReturnModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isReturning}>
              {isReturning ? 'Processing...' : 'Complete Return'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: Assess Manual Fine */}
      <Dialog
        isOpen={showAssessFineModal}
        onClose={() => setShowAssessFineModal(false)}
        title="Assess Member Fine / Fee"
        description="Records an UNPAID fine liability on reader account. Can be settled from reader wallet."
      >
        <form onSubmit={handleAssessFine} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          <FormField label="Reader User ID" required hint="Central reader UUID">
            <TextInput
              placeholder="Paste reader UUID..."
              value={assessReaderId}
              onChange={(e) => setAssessReaderId(e.target.value)}
              autoFocus
            />
          </FormField>

          <FormField label="Fine / Fee Category" required>
            <Select
              value={assessFineType}
              onChange={(e) => setAssessFineType(e.target.value as FineType)}
            >
              <option value={FineType.DAMAGE_FEE}>Damage Fee (Cover, spine, or pages torn)</option>
              <option value={FineType.LOST_ITEM}>Lost Book Fee (Replacement cost charge)</option>
              <option value={FineType.MANUAL_CHARGE}>Manual Charge (Administrative / service fee)</option>
            </Select>
          </FormField>

          <FormField label={`Fee Amount (${currency})`} required>
            <TextInput
              type="number"
              step="1"
              min="1"
              value={assessAmount}
              onChange={(e) => setAssessAmount(e.target.value)}
            />
          </FormField>

          <FormField label="Assessment Notes & Rationale">
            <TextInput
              placeholder="e.g. Spine damage noticed on return"
              value={assessNotes}
              onChange={(e) => setAssessNotes(e.target.value)}
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="secondary" onClick={() => setShowAssessFineModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isAssessing}>
              {isAssessing ? 'Recording...' : 'Assess Fine'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: Waive Fine */}
      <Dialog
        isOpen={showWaiveModal}
        onClose={() => setShowWaiveModal(false)}
        title="Waive Fine Debt"
        description="Waiving an assessed fine requires a non-empty audit rationale. Written to system audit logs."
      >
        <form onSubmit={handleWaiveFine} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
          {waiveTargetFine && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'var(--canvas-subtle)',
                border: '1px solid var(--border)',
                fontSize: '13px',
              }}
            >
              <div><strong>Fine:</strong> {waiveTargetFine.fineType.replace(/_/g, ' ')}</div>
              <div><strong>Outstanding Amount:</strong> {currency} {waiveTargetFine.outstandingAmount.toFixed(2)}</div>
              <div><strong>Reader:</strong> {waiveTargetFine.readerUserId}</div>
            </div>
          )}

          <FormField label="Mandatory Waiver Reason" required hint="Must provide an audit reason for waiver">
            <TextInput
              placeholder="e.g. First-time goodwill waiver granted by branch manager"
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              autoFocus
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="secondary" onClick={() => setShowWaiveModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isWaiving}>
              {isWaiving ? 'Waiving...' : 'Confirm Waiver'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: Circulation Policy Settings */}
      <Dialog
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        title="Branch Circulation Policy"
        description="Configure lending periods, hold expiration window, fine rates, and currency for this branch."
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
