import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  LoanDto,
  ReservationDto,
  LoanStatus,
  ReservationStatus,
} from '@library/contracts';
import { Card, KpiCard } from '../ui/Card';
import { Button } from '../ui/Button';
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

  const orgId = currentOrg?.organization.organizationId;
  const libraryId = currentLibrary?.libraryId;

  const loadData = useCallback(async () => {
    if (!orgId || !libraryId) return;
    setLoading(true);

    try {
      const res = await api.circulation.getMyCirculation(orgId, libraryId);
      setActiveLoans(res.activeLoans);
      setReservations(res.reservations);
      setStats(res.stats);
    } catch (err: any) {
      showToast(err.message || 'Failed to load borrowing history', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, libraryId, showToast]);

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

  const pendingHolds = reservations.filter((r) =>
    [ReservationStatus.WAITLISTED, ReservationStatus.ALLOCATED, ReservationStatus.READY_FOR_PICKUP].includes(r.status),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header */}
      <div className="page-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={24} color="var(--accent)" /> My Loans & Holds
          </h1>
          <p>
            Track your borrowed physical books, manage loan renewals, and monitor hold queue pickup deadlines
          </p>
        </div>
        {onBrowseCatalog && (
          <div className="head-actions">
            <Button variant="primary" onClick={onBrowseCatalog} iconLeft={<Sparkles size={15} />}>
              Explore Catalog
            </Button>
          </div>
        )}
      </div>

      {/* 2. Reader Quota Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
        <LoadingState message="Loading your loans and holds..." />
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {activeLoans.map((loan) => {
                  const isOverdue = loan.isOverdue || (new Date(loan.dueAt).getTime() < Date.now());
                  const daysLeft = Math.round((new Date(loan.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                  return (
                    <Card key={loan.loanId} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{loan.bookTitle}</div>
                          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                            {loan.authorName} &bull; {loan.editionLabel}
                          </div>
                        </div>

                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: isOverdue ? 'var(--status-error-bg)' : 'var(--status-success-bg)',
                            color: isOverdue ? 'var(--status-error-text)' : 'var(--status-success-text)',
                          }}
                        >
                          {isOverdue ? `Overdue by ${Math.abs(daysLeft)}d` : `${daysLeft} days left`}
                        </span>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Due Date:</span>
                          <span style={{ fontWeight: 700, color: isOverdue ? 'var(--status-error-text)' : 'inherit' }}>
                            {new Date(loan.dueAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Renewals:</span>
                          <span>{loan.extensionCount} / 2 used</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleExtendLoan(loan.loanId, loan.bookTitle)}
                          disabled={isOverdue || loan.extensionCount >= 2}
                          iconLeft={<RotateCcw size={14} />}
                        >
                          {loan.extensionCount >= 2 ? 'Max Renewals Used' : isOverdue ? 'Cannot Renew Overdue' : 'Renew (+7 Days)'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Holds & Waitlist Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--accent)" /> Reserved Holds ({pendingHolds.length})
            </h2>

            {pendingHolds.length === 0 ? (
              <Card style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                You have no active book holds or reservations.
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {pendingHolds.map((res) => {
                  const isReady = res.status === ReservationStatus.READY_FOR_PICKUP;
                  const isAllocated = res.status === ReservationStatus.ALLOCATED;
                  const isWaitlisted = res.status === ReservationStatus.WAITLISTED;

                  let hoursLeft = null;
                  if (res.pickupDeadlineAt) {
                    hoursLeft = Math.round((new Date(res.pickupDeadlineAt).getTime() - Date.now()) / (1000 * 60 * 60));
                  }

                  return (
                    <Card
                      key={res.reservationId}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        borderLeft: isReady ? '4px solid var(--status-warning-text)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>{res.bookTitle}</div>
                          <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                            {res.authorName} &bull; {res.editionLabel}
                          </div>
                        </div>

                        {isReady && (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: 'var(--status-warning-bg)',
                              color: 'var(--status-warning-text)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Flame size={12} /> Ready for Pickup
                          </span>
                        )}

                        {isAllocated && (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: 'var(--status-info-bg)',
                              color: 'var(--status-info-text)',
                            }}
                          >
                            Copy Allocated
                          </span>
                        )}

                        {isWaitlisted && (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: 'var(--canvas-subtle)',
                              color: 'var(--muted)',
                            }}
                          >
                            Queue #{res.queuePosition || 1}
                          </span>
                        )}
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
        </>
      )}
    </div>
  );
};
