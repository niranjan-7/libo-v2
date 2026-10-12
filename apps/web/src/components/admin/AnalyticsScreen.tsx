import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  CirculationDeskStatsResponse,
  InventoryStatsResponse,
  SystemAuditLogDto,
} from '@library/contracts';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import {
  BarChart3,
  BookOpen,
  ArrowRightLeft,
  Clock,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  RefreshCw,
  Layers,
  Shield,
  Activity,
} from 'lucide-react';

export const AnalyticsScreen: React.FC = () => {
  const { currentOrg, currentLibrary } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [circStats, setCircStats] = useState<CirculationDeskStatsResponse>({
    activeLoansCount: 0,
    overdueLoansCount: 0,
    readyForPickupCount: 0,
    pendingReservationsCount: 0,
  });
  const [invStats, setInvStats] = useState<InventoryStatsResponse>({
    totalCopies: 0,
    availableCopies: 0,
    loanedCopies: 0,
    exceptionsCount: 0,
  });
  const [fineLedger, setFineLedger] = useState({
    totalCount: 0,
    totalOutstanding: 0,
  });
  const [auditLogs, setAuditLogs] = useState<SystemAuditLogDto[]>([]);

  const orgId = currentOrg?.organization.organizationId;
  const libraryId = currentLibrary?.libraryId;

  const loadData = useCallback(async () => {
    if (!orgId || !libraryId) return;
    setLoading(true);
    try {
      const [circRes, invRes, finesRes, auditRes] = await Promise.all([
        api.circulation.getStats(orgId, libraryId),
        api.inventory.getInventory(orgId, libraryId, { limit: 1 }),
        api.fines.getFines(orgId, libraryId, { limit: 1 }),
        api.auditLogs.getAuditLogs(orgId, libraryId, { limit: 8 }),
      ]);
      setCircStats(circRes);
      setInvStats(invRes.stats);
      setFineLedger({
        totalCount: finesRes.total,
        totalOutstanding: finesRes.totalOutstanding,
      });
      setAuditLogs(auditRes.items);
    } catch (err: any) {
      showToast(err.message || 'Failed to load analytics data', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, libraryId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
        <LoadingState message="Generating branch analytics & workload reports..." />
      </div>
    );
  }

  const utilizationRate =
    invStats.totalCopies > 0
      ? Math.round((invStats.loanedCopies / invStats.totalCopies) * 100)
      : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, margin: '0 0 6px 0' }}>
            Branch Analytics & Reports
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
            Operational metrics, physical collection utilization, and audit telemetry for <strong>{currentLibrary?.name}</strong>.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadData}
          iconLeft={<RefreshCw size={14} />}
        >
          Refresh Metrics
        </Button>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Active Loans
            </span>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <ArrowRightLeft size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, margin: '10px 0 4px', color: 'var(--text)' }}>
            {circStats.activeLoansCount}
          </div>
          <span style={{ fontSize: '12px', color: circStats.overdueLoansCount > 0 ? 'var(--danger-text)' : 'var(--muted)' }}>
            {circStats.overdueLoansCount} overdue items
          </span>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Physical Copies
            </span>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <BookOpen size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, margin: '10px 0 4px', color: 'var(--text)' }}>
            {invStats.totalCopies}
          </div>
          <span style={{ fontSize: '12px', color: '#10b981' }}>
            {invStats.availableCopies} available on shelves
          </span>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Holds & Pickups
            </span>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, margin: '10px 0 4px', color: 'var(--text)' }}>
            {circStats.readyForPickupCount}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {circStats.pendingReservationsCount} waitlisted in queue
          </span>
        </Card>

        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Outstanding Debt
            </span>
            <div style={{ padding: '6px', borderRadius: '8px', background: 'color-mix(in srgb, #ef4444 15%, var(--surface))', color: '#ef4444' }}>
              <Receipt size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, margin: '10px 0 4px', color: 'var(--text)' }}>
            ₹{fineLedger.totalOutstanding.toFixed(2)}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {fineLedger.totalCount} fine assessments recorded
          </span>
        </Card>
      </div>

      {/* Main Analytical Visualizations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left: Inventory Breakdown & Capacity */}
        <Card style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 4px 0' }}>Collection Inventory Breakdown</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 20px 0' }}>
            Current distribution of physical book copies across storage states.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Available */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600 }}>Available for Checkout</span>
                <strong>{invStats.availableCopies} ({invStats.totalCopies ? Math.round((invStats.availableCopies / invStats.totalCopies) * 100) : 0}%)</strong>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${invStats.totalCopies ? (invStats.availableCopies / invStats.totalCopies) * 100 : 0}%`, height: '100%', background: '#10b981' }} />
              </div>
            </div>

            {/* Loaned */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600 }}>Currently Loaned Out</span>
                <strong>{invStats.loanedCopies} ({invStats.totalCopies ? Math.round((invStats.loanedCopies / invStats.totalCopies) * 100) : 0}%)</strong>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${invStats.totalCopies ? (invStats.loanedCopies / invStats.totalCopies) * 100 : 0}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
            </div>

            {/* Exceptions (Damaged / Missing / Withdrawn) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600 }}>Damaged, Missing or In-Repair Copies</span>
                <strong>{invStats.exceptionsCount}</strong>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${invStats.totalCopies ? (invStats.exceptionsCount / invStats.totalCopies) * 100 : 0}%`, height: '100%', background: '#ef4444' }} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px', padding: '16px', background: 'var(--canvas)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '13px' }}>Collection Utilization Rate</strong>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Ratio of items currently in active reader circulation</span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)' }}>
              {utilizationRate}%
            </div>
          </div>
        </Card>

        {/* Right: Real-Time Audit Telemetry Feed */}
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>System Audit Trail</h2>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Tenant activity telemetry log</span>
            </div>
            <Activity size={16} color="var(--accent)" />
          </div>

          {auditLogs.length === 0 ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              No audit logs recorded for this branch yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {auditLogs.map((log) => (
                <div
                  key={log.auditId}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--canvas)',
                    border: '1px solid var(--border)',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>
                      {log.action}
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
                    Target: <code>{log.entityType}:{log.entityId ? log.entityId.substring(0, 8) : 'sys'}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
