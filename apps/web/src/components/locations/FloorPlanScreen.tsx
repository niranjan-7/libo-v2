import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  FloorPlanResponse,
  RackDetailResponse,
} from '@library/contracts';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, StatusBadge } from '../ui/Pill';
import { LoadingState, EmptyState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import {
  MapPin,
  CheckCircle2,
  RefreshCw,
  BookOpen,
} from 'lucide-react';

interface FloorPlanScreenProps {
  initialRackCode?: string;
  onSelectBook?: (bookId: string) => void;
}

export const FloorPlanScreen: React.FC<FloorPlanScreenProps> = ({
  initialRackCode,
  onSelectBook,
}) => {
  const { currentOrg, currentLibrary } = useAuth();
  const { showToast } = useToast();

  const [floorPlan, setFloorPlan] = useState<FloorPlanResponse | null>(null);
  const [selectedRackCode, setSelectedRackCode] = useState<string>(initialRackCode || 'A');
  const [rackDetails, setRackDetails] = useState<RackDetailResponse | null>(null);

  const [selectedShelfNumber, setSelectedShelfNumber] = useState<number | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [loadingRack, setLoadingRack] = useState(false);

  // 1. Fetch Published Floor Plan
  const fetchFloorPlan = async () => {
    if (!currentOrg || !currentLibrary) return;
    setLoadingMap(true);
    try {
      const data = await api.floorPlan.getFloorPlan(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        1,
      );
      setFloorPlan(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load floor plan', 'error');
    } finally {
      setLoadingMap(false);
    }
  };

  useEffect(() => {
    fetchFloorPlan();
  }, [currentOrg, currentLibrary]);

  // If initialRackCode changes externally, select it
  useEffect(() => {
    if (initialRackCode) {
      setSelectedRackCode(initialRackCode);
    }
  }, [initialRackCode]);

  // 2. Fetch Selected Rack Shelves
  useEffect(() => {
    if (!currentOrg || !currentLibrary || !selectedRackCode) return;

    setLoadingRack(true);
    api.floorPlan
      .getRackShelves(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        selectedRackCode,
      )
      .then((data) => {
        setRackDetails(data);
        // By default select the first shelf that has copies, or shelf 1
        const shelfWithBooks = data.shelves.find((s) => s.totalCopies > 0);
        setSelectedShelfNumber(shelfWithBooks ? shelfWithBooks.shelfNumber : 1);
      })
      .catch((err: any) => {
        showToast(err.message || `Failed to load rack ${selectedRackCode}`, 'error');
      })
      .finally(() => {
        setLoadingRack(false);
      });
  }, [currentOrg, currentLibrary, selectedRackCode, showToast]);

  const activeShelf = rackDetails?.shelves.find((s) => s.shelfNumber === selectedShelfNumber);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Screen Header */}
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
            Floor Map & Zones
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
            Published spatial layout for <strong>{currentLibrary?.name}</strong>. Select any physical rack fixture to inspect shelves and physical titles.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Chip active>Level 1 &bull; Main Stacks</Chip>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchFloorPlan}
            disabled={loadingMap}
            iconLeft={<RefreshCw size={14} className={loadingMap ? 'spin' : ''} />}
          >
            Refresh Map
          </Button>
        </div>
      </div>

      {loadingMap ? (
        <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
          <LoadingState message="Rendering published floor plan and spatial layouts..." />
        </div>
      ) : !floorPlan || floorPlan.fixtures.length === 0 ? (
        <EmptyState
          title="No Floor Plan Published"
          description="No active floor plan or rack fixtures found for this library branch."
          action={{
            label: 'Refresh Map',
            onClick: fetchFloorPlan,
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
          {/* LEFT: Interactive Floor Plan Canvas */}
          <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} style={{ color: 'var(--accent)' }} />
                <strong style={{ fontSize: '16px', color: 'var(--text)' }}>
                  {floorPlan.floorName} &bull; Reading & Stacks
                </strong>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Canvas: {floorPlan.canvasWidth} &times; {floorPlan.canvasHeight} px
              </span>
            </div>

            {/* Map Legend */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                padding: '8px 12px',
                background: 'var(--canvas)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)' }} />
                <span>Selected Rack</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                <span>Contains Available Copies</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--border)' }} />
                <span>No Copies</span>
              </div>
            </div>

            {/* Spatial Grid representation */}
            <div
              style={{
                position: 'relative',
                background: 'var(--canvas)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '24px',
                minHeight: '380px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(2, 1fr)',
                gap: '20px',
              }}
            >
              {floorPlan.fixtures.map((fixture) => {
                const rackCode = fixture.linkedRackCode || 'A';
                const isSelected = selectedRackCode.toUpperCase() === rackCode.toUpperCase();
                const availCopies = fixture.availableCopiesCount || 0;
                const hasCopies = availCopies > 0;

                return (
                  <button
                    key={fixture.elementId}
                    onClick={() => setSelectedRackCode(rackCode)}
                    style={{
                      background: isSelected
                        ? 'color-mix(in srgb, var(--accent) 15%, var(--surface))'
                        : 'var(--surface)',
                      border: isSelected
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                      position: 'relative',
                      minHeight: '120px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                          FIXTURE #{rackCode}
                        </span>
                        <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>
                          Rack {rackCode}
                        </h3>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={16} style={{ color: 'var(--accent)' }} />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: hasCopies ? '#10b981' : 'var(--muted)',
                        }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: hasCopies ? '#10b981' : 'var(--muted)' }}>
                        {availCopies} {availCopies === 1 ? 'copy' : 'copies'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>
              * Visual spatial layout coordinates decoupled from logical database records.
            </div>
          </Card>

          {/* RIGHT: Rack & Shelf Contents Inspector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Card style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Logical Location Record
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', margin: '2px 0 0 0' }}>
                    {rackDetails ? `${rackDetails.rackName}` : `Rack ${selectedRackCode}`}
                  </h2>
                </div>
                <Chip active>Rack Code: F1-R{selectedRackCode}</Chip>
              </div>

              {loadingRack ? (
                <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
                  <LoadingState message={`Loading shelves for Rack ${selectedRackCode}...`} />
                </div>
              ) : !rackDetails ? (
                <p style={{ color: 'var(--muted)' }}>Select a rack on the map to inspect its shelf contents.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Shelves List Tabs */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                      SELECT SHELF (1 - 6):
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                      {rackDetails.shelves.map((shelf) => {
                        const isCurrent = shelf.shelfNumber === selectedShelfNumber;
                        const hasBooks = shelf.totalCopies > 0;

                        return (
                          <button
                            key={shelf.shelfLocationId}
                            onClick={() => setSelectedShelfNumber(shelf.shelfNumber)}
                            style={{
                              padding: '10px 4px',
                              borderRadius: '8px',
                              border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)',
                              background: isCurrent
                                ? 'var(--accent)'
                                : hasBooks
                                ? 'var(--surface)'
                                : 'var(--canvas)',
                              color: isCurrent ? '#fff' : hasBooks ? 'var(--text)' : 'var(--muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '2px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 800 }}>S{shelf.shelfNumber}</span>
                            <span style={{ fontSize: '10px', opacity: 0.9 }}>
                              {shelf.totalCopies} bks
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Shelf Contents */}
                  {activeShelf && (
                    <div
                      style={{
                        padding: '16px',
                        background: 'var(--canvas)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <strong style={{ fontSize: '15px', color: 'var(--text)' }}>
                            Shelf {activeShelf.shelfNumber} ({activeShelf.shelfCode})
                          </strong>
                          <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)' }}>
                            {activeShelf.uniqueTitlesCount} unique titles &bull; {activeShelf.totalCopies} physical copies
                          </span>
                        </div>
                        <StatusBadge
                          status={activeShelf.availableCopies > 0 ? 'AVAILABLE' : 'LOANED'}
                        />
                      </div>

                      {activeShelf.copies.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                          No books are currently placed on Shelf {activeShelf.shelfNumber}.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {activeShelf.copies.map((copy) => (
                            <div
                              key={copy.copyId}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '10px',
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                                <strong
                                  style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    color: 'var(--text)',
                                    fontFamily: 'var(--font-heading)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {copy.bookTitle}
                                </strong>
                                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                  by {copy.authorName || 'Author'} &bull; {copy.format}
                                </span>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                    {copy.barcode}
                                  </span>
                                  <StatusBadge status={copy.status} />
                                </div>
                              </div>

                              {onSelectBook && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  iconLeft={<BookOpen size={13} />}
                                  onClick={() => onSelectBook(copy.bookId)}
                                >
                                  View
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
