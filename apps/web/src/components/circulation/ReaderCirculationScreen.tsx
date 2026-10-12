import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  LoanDto,
  ReservationDto,
  LoanStatus,
  ReservationStatus,
  WalletDto,
  WalletTransactionDto,
  FineDto,
  FineStatus,
  LedgerDirection,
} from '@library/contracts';
import { Card, KpiCard } from '../ui/Card';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { TextInput, FormField } from '../ui/Input';
import { Chip, StatusBadge } from '../ui/Pill';
import { LoadingState, EmptyState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import {
  BookOpen,
  Clock,
  Barcode,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Calendar,
  Wallet,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Plus,
  ShieldAlert,
} from 'lucide-react';

interface ReaderCirculationScreenProps {
  onBrowseCatalog?: () => void;
}

export const ReaderCirculationScreen: React.FC<ReaderCirculationScreenProps> = ({
  onBrowseCatalog,
}) => {
  const { currentOrg, currentLibrary, user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeLoans, setActiveLoans] = useState<LoanDto[]>([]);
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [stats, setStats] = useState({
    activeLoansCount: 0,
    maxActiveLoans: 5,
    pendingReservationsCount: 0,
    maxPendingReservations: 3,
  });

  // Wallet & Fines
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDto[]>([]);
  const [fines, setFines] = useState<FineDto[]>([]);
  const [totalOutstandingFines, setTotalOutstandingFines] = useState(0);

  // Top-Up Modal
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('250');
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [isPayingFineId, setIsPayingFineId] = useState<string | null>(null);

  const orgId = currentOrg?.organization.organizationId;
  const libraryId = currentLibrary?.libraryId;

  const loadData = useCallback(async () => {
    if (!orgId || !libraryId) return;
    setLoading(true);

    try {
      const [circRes, walletRes, txRes, finesRes] = await Promise.all([
        api.circulation.getMyCirculation(orgId, libraryId),
        api.wallet.getMyWallet(orgId, libraryId).catch(() => null),
        api.wallet.getMyTransactions(orgId, libraryId).catch(() => ({ items: [], total: 0, balance: 0 })),
        api.fines.getFines(orgId, libraryId, { readerUserId: user?.userId }).catch(() => ({ items: [], total: 0, totalOutstanding: 0 })),
      ]);

      setActiveLoans(circRes.activeLoans);
      setReservations(circRes.reservations);
      setStats(circRes.stats);
      if (walletRes) setWallet(walletRes);
      setTransactions(txRes.items);
      setFines(finesRes.items);
      setTotalOutstandingFines(finesRes.totalOutstanding);
    } catch (err: any) {
      showToast(err.message || 'Failed to load borrowing and financial history', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, libraryId, user?.userId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExtendLoan = async (loanId: string, title: string) => {
    if (!orgId || !libraryId) return;
    try {
      const updated = await api.circulation.extendLoan(orgId, libraryId, loanId);
      showToast(`Loan extended! New due date: ${new Date(updated.dueAt).toLocaleDateString()}`, 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Could not extend loan', 'error');
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (!orgId || !libraryId) return;
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      await api.circulation.cancelReservation(orgId, libraryId, reservationId);
      showToast('Reservation cancelled', 'info');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Could not cancel reservation', 'error');
    }
  };

  const handleTopUp = async () => {
    const num = parseFloat(topUpAmount);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid top-up amount greater than 0', 'error');
      return;
    }
    if (!orgId || !libraryId) return;

    setIsToppingUp(true);
    try {
      const res = await api.wallet.topUp(orgId, libraryId, {
        amount: num,
        notes: `Simulated Wallet Top-Up (${wallet?.currencyCode || 'INR'} ${num.toFixed(2)})`,
      });
      setWallet(res.wallet);
      showToast(
        `Wallet credited with ${res.wallet.currencyCode} ${num.toFixed(2)}! New balance: ${res.wallet.currencyCode} ${res.wallet.balance.toFixed(2)}`,
        'success',
      );
      setShowTopUpModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Top-up transaction failed', 'error');
    } finally {
      setIsToppingUp(false);
    }
  };

  const handlePayFine = async (fineId: string) => {
    if (!orgId || !libraryId) return;
    setIsPayingFineId(fineId);
    try {
      const res = await api.fines.payFine(orgId, libraryId, fineId);
      showToast(
        `Fine settled! Remaining wallet balance: ${wallet?.currencyCode || 'INR'} ${res.newWalletBalance.toFixed(2)}`,
        'success',
      );
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to settle fine from wallet', 'error');
    } finally {
      setIsPayingFineId(null);
    }
  };

  const pendingHolds = reservations.filter((r) =>
    [ReservationStatus.WAITLISTED, ReservationStatus.ALLOCATED, ReservationStatus.READY_FOR_PICKUP].includes(r.status),
  );

  const unpaidFines = fines.filter((f) => f.status === FineStatus.UNPAID);
  const currency = wallet?.currencyCode || 'INR';
  const currentBalance = wallet?.balance ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header */}
      <div className="page-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={24} color="var(--accent)" /> My Loans, Holds & Wallet
          </h1>
          <p>
            Track your borrowed physical books, manage renewals, hold deadlines, and wallet ledger
          </p>
        </div>
        <div className="head-actions" style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            onClick={() => setShowTopUpModal(true)}
            iconLeft={<Plus size={15} />}
          >
            Top Up Wallet
          </Button>
          {onBrowseCatalog && (
            <Button variant="primary" onClick={onBrowseCatalog} iconLeft={<Sparkles size={15} />}>
              Explore Catalog
            </Button>
          )}
        </div>
      </div>

      {/* 2. Reader Quota & Financial Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
        }}
      >
        <KpiCard
          label="Active Loans Limit"
          value={`${stats.activeLoansCount} / ${stats.maxActiveLoans}`}
          caption={`${stats.maxActiveLoans - stats.activeLoansCount} loan slot(s) remaining`}
          icon={<BookOpen size={20} />}
        />
        <KpiCard
          label="Pending Holds Quota"
          value={`${stats.pendingReservationsCount} / ${stats.maxPendingReservations}`}
          caption={`${stats.maxPendingReservations - stats.pendingReservationsCount} hold slot(s) remaining`}
          icon={<Clock size={20} />}
        />
        <KpiCard
          label="Wallet Balance"
          value={`${currency} ${currentBalance.toFixed(2)}`}
          caption="Append-only debit/credit ledger"
          icon={<Wallet size={20} />}
        />
        <KpiCard
          label="Outstanding Fines"
          value={`${currency} ${totalOutstandingFines.toFixed(2)}`}
          caption={totalOutstandingFines > 0 ? `${unpaidFines.length} unpaid fine(s)` : 'Clear of dues'}
          icon={<Receipt size={20} color={totalOutstandingFines > 0 ? 'var(--status-danger-text)' : undefined} />}
        />
      </div>

      {/* 3. Ready for Pickup Banner (if any holds are ready) */}
      {pendingHolds.some((h) => h.status === ReservationStatus.READY_FOR_PICKUP) && (
        <Card
          style={{
            background: 'var(--status-warning-bg)',
            borderColor: 'var(--status-warning-border)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <Flame size={24} color="var(--status-warning-text)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: 'var(--status-warning-text)', fontSize: '14px' }}>
              You have books ready for pickup!
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text)', marginTop: '2px' }}>
              Please visit the circulation desk before the 72-hour countdown expires to claim your copies.
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingState message="Loading your loans, holds, and wallet ledger..." />
      ) : (
        <>
          {/* 4. Active Loans Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Barcode size={18} color="var(--accent)" /> Active Loans ({activeLoans.length})
              </h2>
            </div>

            {activeLoans.length === 0 ? (
              <EmptyState
                title="You have no active loans"
                description="Explore our catalog and borrow physical books from your library branch."
                action={onBrowseCatalog ? { label: 'Browse Catalog', onClick: onBrowseCatalog } : undefined}
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '16px',
                }}
              >
                {activeLoans.map((loan) => {
                  const dueDate = new Date(loan.dueAt);
                  const isOverdue = loan.isOverdue || dueDate.getTime() < Date.now();
                  const canRenew = !isOverdue && loan.extensionCount < 2;

                  return (
                    <Card
                      key={loan.loanId}
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        borderColor: isOverdue ? 'var(--status-danger-border)' : undefined,
                        background: isOverdue ? 'var(--status-danger-bg)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{loan.bookTitle}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{loan.authorName}</div>
                        </div>
                        <StatusBadge
                          status={isOverdue ? 'Overdue' : 'Active'}
                        />
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '10px 12px',
                          background: 'var(--canvas-subtle)',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Barcode:</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{loan.barcode}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Checked Out:</span>
                          <span>{new Date(loan.checkedOutAt).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: isOverdue ? 700 : 500, color: isOverdue ? 'var(--status-danger-text)' : undefined }}>
                          <span>Due Date:</span>
                          <span>{dueDate.toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Renewals Used:</span>
                          <span>{loan.extensionCount} / 2</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                        <Button
                          size="sm"
                          variant="secondary"
                          iconLeft={<RotateCcw size={14} />}
                          disabled={!canRenew}
                          onClick={() => handleExtendLoan(loan.loanId, loan.bookTitle)}
                          title={
                            isOverdue
                              ? 'Overdue loans cannot be extended'
                              : loan.extensionCount >= 2
                              ? 'Maximum renewals reached'
                              : 'Extend due date by 7 days'
                          }
                        >
                          {canRenew ? 'Renew (+7 Days)' : loan.extensionCount >= 2 ? 'Max Renewals' : 'Overdue'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Holds & Reservations Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--accent)" /> My Holds & Reservations ({pendingHolds.length})
              </h2>
            </div>

            {pendingHolds.length === 0 ? (
              <EmptyState
                title="No active holds"
                description="When books are currently checked out, place a hold to reserve the next available copy."
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '16px',
                }}
              >
                {pendingHolds.map((res) => {
                  const isReady = res.status === ReservationStatus.READY_FOR_PICKUP;
                  const hoursLeft = res.pickupDeadlineAt
                    ? Math.max(0, Math.round((new Date(res.pickupDeadlineAt).getTime() - Date.now()) / (1000 * 60 * 60)))
                    : null;

                  return (
                    <Card
                      key={res.reservationId}
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        borderColor: isReady ? 'var(--status-warning-border)' : undefined,
                        background: isReady ? 'var(--status-warning-bg)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{res.bookTitle}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{res.authorName}</div>
                        </div>
                        <StatusBadge
                          status={
                            isReady
                              ? 'Ready'
                              : res.status === ReservationStatus.ALLOCATED
                              ? 'Allocated'
                              : `Waitlist #${res.queuePosition || 1}`
                          }
                        />
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '10px 12px',
                          background: 'var(--canvas-subtle)',
                          borderRadius: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Reserved Date:</span>
                          <span>{new Date(res.createdAt).toLocaleDateString()}</span>
                        </div>

                        {isReady && hoursLeft !== null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--status-warning-text)' }}>
                            <span>Pickup Deadline:</span>
                            <span>{hoursLeft > 0 ? `${hoursLeft} hours remaining` : 'EXPIRED'}</span>
                          </div>
                        )}

                        {res.assignedBarcode && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Allocated Copy:</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{res.assignedBarcode}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancelReservation(res.reservationId)}
                        >
                          Cancel Hold
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. Outstanding Fines & Liabilities */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={18} color="var(--accent)" /> Outstanding Fines & Debt Liabilities ({unpaidFines.length})
              </h2>
            </div>

            {unpaidFines.length === 0 ? (
              <Card style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>
                <CheckCircle2 size={32} color="var(--status-success-text)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700, color: 'var(--fg)' }}>No outstanding fines!</div>
                <div style={{ fontSize: '13px' }}>Your library account has zero fee liability.</div>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {unpaidFines.map((fine) => {
                  const canPay = currentBalance >= fine.outstandingAmount;
                  const isPaying = isPayingFineId === fine.fineId;

                  return (
                    <Card
                      key={fine.fineId}
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        borderColor: 'var(--status-danger-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'var(--status-danger-bg)',
                            color: 'var(--status-danger-text)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ShieldAlert size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>
                            {fine.fineType.replace(/_/g, ' ')}
                            {fine.bookTitle && <span style={{ color: 'var(--muted)', fontWeight: 500 }}> — {fine.bookTitle}</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                            Assessed on {fine.fineDate || new Date(fine.createdAt).toLocaleDateString()} • Original amount: {currency} {fine.amount.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--status-danger-text)' }}>
                            {currency} {fine.outstandingAmount.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {canPay ? 'Payable from wallet' : 'Insufficient balance'}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!canPay || isPaying}
                          onClick={() => handlePayFine(fine.fineId)}
                        >
                          {isPaying ? 'Processing...' : canPay ? 'Pay from Wallet' : 'Top Up to Pay'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* 7. Wallet Transaction Ledger (Append-Only) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={18} color="var(--accent)" /> Wallet Transaction Ledger ({transactions.length})
              </h2>
            </div>

            {transactions.length === 0 ? (
              <EmptyState
                title="No wallet transactions"
                description="Simulate a top-up to add funds for fines, reservation holds, and library fees."
              />
            ) : (
              <Card style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--canvas-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date & Time</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Direction</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Transaction Type</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Amount</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Notes / Idempotency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const isCredit = tx.direction === LedgerDirection.CREDIT;
                      return (
                        <tr
                          key={tx.transactionId}
                          style={{ borderBottom: '1px solid var(--border)' }}
                        >
                          <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '12px' }}>
                            {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: isCredit ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
                                color: isCredit ? 'var(--status-success-text)' : 'var(--status-danger-text)',
                              }}
                            >
                              {isCredit ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                              {tx.direction}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            {tx.transactionType.replace(/_/g, ' ')}
                          </td>
                          <td
                            style={{
                              padding: '12px 16px',
                              fontWeight: 800,
                              color: isCredit ? 'var(--status-success-text)' : 'var(--status-danger-text)',
                            }}
                          >
                            {isCredit ? '+' : '-'}{tx.currencyCode} {tx.amount.toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '12px' }}>
                            {tx.notes || tx.idempotencyKey}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Top-Up Simulated Dialog */}
      <Dialog
        isOpen={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        title="Simulated Wallet Top-Up"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Add test funds to your branch pocket wallet. Fines and library service payments are deducted from this balance.
          </p>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Select Amount ({currency})
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {['100', '250', '500', '1000'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTopUpAmount(preset)}
                  className={`btn ${topUpAmount === preset ? 'primary' : 'secondary'}`}
                  style={{ padding: '8px', fontSize: '13px', fontWeight: 700 }}
                >
                  ₹{preset}
                </button>
              ))}
            </div>
          </div>

          <FormField label="Or Enter Custom Amount" htmlFor="topup-amount">
            <TextInput
              id="topup-amount"
              type="number"
              min="1"
              step="1"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="e.g. 350"
            />
          </FormField>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--canvas-subtle)',
              border: '1px solid var(--border)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <CreditCard size={18} color="var(--accent)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>Simulated UPI / NetBanking Gateway</div>
              <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
                No real payment gateway is integrated. Credits balance immediately.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Button variant="ghost" onClick={() => setShowTopUpModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={isToppingUp} onClick={handleTopUp}>
              {isToppingUp ? 'Crediting...' : `Add ${currency} ${parseFloat(topUpAmount || '0').toFixed(2)}`}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
