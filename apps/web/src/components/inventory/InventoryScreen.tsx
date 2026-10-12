import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  BookCopyDto,
  InventoryStatsResponse,
  CopyStatus,
  CopyCondition,
  OrgRole,
} from '@library/contracts';
import { Card, KpiCard } from '../ui/Card';
import { Button } from '../ui/Button';
import { TextInput, Select, FormField } from '../ui/Input';
import { Chip, StatusBadge } from '../ui/Pill';
import { LoadingState, EmptyState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import { Dialog } from '../ui/Dialog';
import {
  Barcode,
  Search,
  Plus,
  RefreshCw,
  MapPin,
} from 'lucide-react';

interface InventoryScreenProps {
  onSelectBook?: (bookId: string) => void;
  onLocateRack?: (rackCode: string) => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  onSelectBook,
  onLocateRack,
}) => {
  const { currentOrg, currentLibrary, currentRole } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<BookCopyDto[]>([]);
  const [stats, setStats] = useState<InventoryStatsResponse>({
    totalCopies: 0,
    availableCopies: 0,
    loanedCopies: 0,
    exceptionsCount: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');

  // Register Copy Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');
  const [selectedEditionId, setSelectedEditionId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [newCondition, setNewCondition] = useState<CopyCondition>(CopyCondition.NEW);
  const [newStatus, setNewStatus] = useState<CopyStatus>(CopyStatus.AVAILABLE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available Editions & Shelves for the modal
  const [catalogEditions, setCatalogEditions] = useState<{ editionId: string; label: string }[]>([]);
  const [shelfLocations, setShelfLocations] = useState<{ locationId: string; label: string }[]>([]);

  const fetchInventory = useCallback(async () => {
    if (!currentOrg || !currentLibrary) return;

    setLoading(true);
    try {
      const res = await api.inventory.getInventory(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        {
          search: searchTerm || undefined,
          status: statusFilter !== 'all' ? (statusFilter as CopyStatus) : undefined,
          condition: conditionFilter !== 'all' ? (conditionFilter as CopyCondition) : undefined,
          limit: 100,
        },
      );
      setItems(res.items);
      setStats(res.stats);
      setTotal(res.total);
    } catch (err: any) {
      showToast(err.message || 'Failed to load copy inventory', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentOrg, currentLibrary, searchTerm, statusFilter, conditionFilter, showToast]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Load editions and shelves when opening Add Modal
  const openAddModal = async () => {
    if (!currentOrg || !currentLibrary) return;
    setShowAddModal(true);

    try {
      // Fetch catalog works to extract edition IDs
      const catRes = await api.catalog.search(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        { limit: 50 },
      );

      const editionsList: { editionId: string; label: string }[] = [];
      for (const b of catRes.items) {
        if (b.editions && b.editions.length > 0) {
          for (const ed of b.editions) {
            editionsList.push({
              editionId: ed.editionId,
              label: `${b.title} (${ed.editionLabel} - ${ed.format})`,
            });
          }
        }
      }
      setCatalogEditions(editionsList);
      if (editionsList.length > 0 && !selectedEditionId) {
        setSelectedEditionId(editionsList[0].editionId);
      }

      // Fetch Rack A Shelves to extract shelf location IDs
      const rackRes = await api.floorPlan.getRackShelves(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        'A',
      );
      const shelvesList = rackRes.shelves.map((s) => ({
        locationId: s.shelfLocationId,
        label: `Rack A - Shelf ${s.shelfNumber} (${s.shelfCode})`,
      }));
      setShelfLocations(shelvesList);
      if (shelvesList.length > 0 && !selectedLocationId) {
        setSelectedLocationId(shelvesList[0].locationId);
      }
    } catch (err) {
      // Fallback
    }
  };

  const handleCreateCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !currentLibrary) return;

    if (!newBarcode.trim()) {
      showToast('Barcode is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.inventory.createCopy(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        {
          editionId: selectedEditionId,
          barcode: newBarcode.trim().toUpperCase(),
          condition: newCondition,
          status: newStatus,
          homeLocationId: selectedLocationId,
        },
      );

      showToast(`Copy '${newBarcode.toUpperCase()}' registered successfully!`, 'success');
      setShowAddModal(false);
      setNewBarcode('');
      await fetchInventory();
    } catch (err: any) {
      showToast(err.message || 'Failed to register copy', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canManage = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--text)',
              margin: '0 0 6px 0',
            }}
          >
            Copy Inventory
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
            Physical copy tracking, barcodes, conditions, and stock status for <strong>{currentLibrary?.name}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchInventory}
            disabled={loading}
            iconLeft={<RefreshCw size={14} className={loading ? 'spin' : ''} />}
          >
            Refresh
          </Button>

          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={openAddModal}
              iconLeft={<Plus size={14} />}
            >
              Register Copy
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <KpiCard
          label="Total Physical Copies"
          value={stats.totalCopies}
          caption="Tracked barcodes in branch"
        />
        <KpiCard
          label="Available On Shelf"
          value={stats.availableCopies}
          caption="Ready for loan or browsing"
        />
        <KpiCard
          label="Active Loans"
          value={stats.loanedCopies}
          caption="Checked out to readers"
        />
        <KpiCard
          label="Exceptions & Wear"
          value={stats.exceptionsCount}
          caption="Damaged, lost, or withdrawn"
        />
      </div>

      {/* Filters Card */}
      <Card style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center' }}>
        <TextInput
          placeholder="Search by barcode, work title, or location name..."
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          prefixIcon={<Search size={16} />}
        />

        <div style={{ width: '180px' }}>
          <Select
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: CopyStatus.AVAILABLE, label: 'Available' },
              { value: CopyStatus.LOANED, label: 'Loaned' },
              { value: CopyStatus.ON_HOLD, label: 'On Hold' },
              { value: CopyStatus.LOST, label: 'Lost' },
              { value: CopyStatus.DAMAGED, label: 'Damaged' },
            ]}
          />
        </div>

        <div style={{ width: '180px' }}>
          <Select
            value={conditionFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConditionFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Conditions' },
              { value: CopyCondition.NEW, label: 'New' },
              { value: CopyCondition.GOOD, label: 'Good' },
              { value: CopyCondition.MINOR_WEAR, label: 'Minor Wear' },
              { value: CopyCondition.DAMAGED, label: 'Damaged' },
            ]}
          />
        </div>
      </Card>

      {/* Inventory Table */}
      {loading ? (
        <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
          <LoadingState message="Loading physical copy inventory..." />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No Copies Found"
          description="No physical copies match your query. You can register a new copy or clear filters."
          action={
            canManage
              ? {
                  label: 'Register Copy',
                  onClick: openAddModal,
                }
              : undefined
          }
        />
      ) : (
        <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--canvas)' }}>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Barcode</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Work Title & Author</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Edition</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Home Location</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Status</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Condition</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((copy) => {
                const rackMatch = copy.homeLocation?.code.match(/F\d+-R([A-Z])/i);
                const rackCode = rackMatch ? rackMatch[1].toUpperCase() : 'A';

                return (
                  <tr key={copy.copyId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Barcode size={16} style={{ color: 'var(--accent)' }} />
                        <span>{copy.barcode}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <strong
                        style={{
                          display: 'block',
                          fontSize: '14px',
                          color: 'var(--text)',
                          fontFamily: 'var(--font-heading)',
                        }}
                      >
                        {copy.bookTitle}
                      </strong>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {copy.authorName || 'Author'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {copy.editionLabel} &bull; {copy.format}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={14} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                          {copy.homeLocation?.name || copy.homeLocation?.code}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Code: {copy.homeLocation?.code}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={copy.status} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Chip>{copy.condition}</Chip>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {onLocateRack && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onLocateRack(rackCode)}
                            iconLeft={<MapPin size={12} />}
                          >
                            Locate
                          </Button>
                        )}
                        {onSelectBook && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onSelectBook(copy.bookId)}
                          >
                            Details
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
      )}

      {/* Register Physical Copy Modal */}
      <Dialog
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register Physical Copy"
      >
        <form onSubmit={handleCreateCopy} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
            Add a physical book copy to <strong>{currentLibrary?.name}</strong> inventory with unique barcode and home shelf placement.
          </p>

          <FormField label="Conceptual Title & Edition" required>
            <Select
              value={selectedEditionId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedEditionId(e.target.value)}
              options={catalogEditions.map((ed) => ({ value: ed.editionId, label: ed.label }))}
            />
          </FormField>

          <FormField label="Unique Barcode" required hint="Must be unique within this library branch (e.g. CP-00999)">
            <TextInput
              placeholder="e.g. CP-00999"
              value={newBarcode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBarcode(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Home Shelf Location" required>
            <Select
              value={selectedLocationId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedLocationId(e.target.value)}
              options={shelfLocations.map((loc) => ({ value: loc.locationId, label: loc.label }))}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Initial Condition">
              <Select
                value={newCondition}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewCondition(e.target.value as CopyCondition)}
                options={[
                  { value: CopyCondition.NEW, label: 'New' },
                  { value: CopyCondition.GOOD, label: 'Good' },
                  { value: CopyCondition.MINOR_WEAR, label: 'Minor Wear' },
                  { value: CopyCondition.DAMAGED, label: 'Damaged' },
                ]}
              />
            </FormField>

            <FormField label="Initial Status">
              <Select
                value={newStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewStatus(e.target.value as CopyStatus)}
                options={[
                  { value: CopyStatus.AVAILABLE, label: 'Available' },
                  { value: CopyStatus.ON_HOLD, label: 'On Hold' },
                  { value: CopyStatus.LOANED, label: 'Loaned' },
                ]}
              />
            </FormField>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button variant="ghost" type="button" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register Copy'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
