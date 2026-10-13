import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import {
  FloorPlanResponse,
  RackDetailResponse,
  LibraryFloorDto,
  CreateFloorRequest,
  FloorCirculationHeatmapResponse,
  RackCirculationHeatmapDto,
} from '@library/contracts';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Chip, StatusBadge } from '../ui/Pill';
import { Dialog } from '../ui/Dialog';
import { FormField, TextInput } from '../ui/Input';
import { LoadingState, EmptyState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import { FloorPlanEditor } from './FloorPlanEditor';
import {
  MapPin,
  CheckCircle2,
  RefreshCw,
  BookOpen,
  Edit3,
  Plus,
  Layers,
  Eye,
  Flame,
  TrendingUp,
  Sparkles,
  BarChart2,
} from 'lucide-react';

interface FloorPlanScreenProps {
  initialRackCode?: string;
  onSelectBook?: (bookId: string) => void;
}

export const FloorPlanScreen: React.FC<FloorPlanScreenProps> = ({
  initialRackCode,
  onSelectBook,
}) => {
  const { currentOrg, currentLibrary, currentRole } = useAuth();
  const { showToast } = useToast();
  const isStaff = currentRole && ['OWNER', 'ADMIN'].includes(currentRole);

  // Floor Selection
  const [floors, setFloors] = useState<LibraryFloorDto[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [loadingFloors, setLoadingFloors] = useState<boolean>(true);

  // Editor vs Viewer Mode
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Add Floor Modal
  const [showAddFloorDialog, setShowAddFloorDialog] = useState<boolean>(false);
  const [newFloorNumber, setNewFloorNumber] = useState<number>(1);
  const [newFloorName, setNewFloorName] = useState<string>('Level 1 - Main Stacks');
  const [newCanvasWidth, setNewCanvasWidth] = useState<number>(1000);
  const [newCanvasHeight, setNewCanvasHeight] = useState<number>(700);
  const [isCreatingFloor, setIsCreatingFloor] = useState<boolean>(false);

  // Viewer Mode Data
  const [floorPlan, setFloorPlan] = useState<FloorPlanResponse | null>(null);
  const [selectedRackCode, setSelectedRackCode] = useState<string>(initialRackCode || 'A');
  const [rackDetails, setRackDetails] = useState<RackDetailResponse | null>(null);
  const [selectedShelfNumber, setSelectedShelfNumber] = useState<number | null>(null);
  const [loadingMap, setLoadingMap] = useState<boolean>(false);
  const [loadingRack, setLoadingRack] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(0.85);

  // Circulation Heatmap Overlay State
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [heatmapTimeRange, setHeatmapTimeRange] = useState<'30d' | '90d' | 'all'>('30d');
  const [heatmapData, setHeatmapData] = useState<FloorCirculationHeatmapResponse | null>(null);
  const [loadingHeatmap, setLoadingHeatmap] = useState<boolean>(false);
  const [hoveredHeatmapRackCode, setHoveredHeatmapRackCode] = useState<string | null>(null);

  // 1. Fetch Floors List
  const fetchFloors = useCallback(async () => {
    if (!currentOrg || !currentLibrary) return;
    setLoadingFloors(true);
    try {
      const data = await api.floorPlan.getFloors(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
      );
      setFloors(data);
      if (data.length > 0 && !selectedFloorId) {
        setSelectedFloorId(data[0].floorId);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load floors', 'error');
    } finally {
      setLoadingFloors(false);
    }
  }, [currentOrg, currentLibrary, selectedFloorId, showToast]);

  useEffect(() => {
    fetchFloors();
  }, [fetchFloors]);

  const selectedFloor = floors.find((f) => f.floorId === selectedFloorId) || floors[0] || null;

  // 2. Fetch Published Floor Plan for Selected Floor
  const fetchPublishedFloorPlan = useCallback(async () => {
    if (!currentOrg || !currentLibrary || !selectedFloor) return;
    setLoadingMap(true);
    try {
      const data = await api.floorPlan.getPublishedFloorPlan(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        selectedFloor.floorId,
      );
      setFloorPlan(data);
      // If no rack selected or previously selected rack not in this floor, pick first available fixture
      if (data.fixtures && data.fixtures.length > 0) {
        const firstRack = data.fixtures.find((f) => f.linkedRackCode);
        if (firstRack && firstRack.linkedRackCode) {
          setSelectedRackCode((prev) => prev || firstRack.linkedRackCode!);
        }
      }
    } catch (err: any) {
      // 404 means unpublished draft only or no version yet
      setFloorPlan(null);
    } finally {
      setLoadingMap(false);
    }
  }, [currentOrg, currentLibrary, selectedFloor]);

  // 2b. Fetch Circulation Heatmap Metrics
  const fetchHeatmap = useCallback(async () => {
    if (!currentOrg || !currentLibrary || !selectedFloor) return;
    setLoadingHeatmap(true);
    try {
      const data = await api.floorPlan.getCirculationHeatmap(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        selectedFloor.floorId,
        heatmapTimeRange,
      );
      setHeatmapData(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load circulation heatmap metrics', 'error');
    } finally {
      setLoadingHeatmap(false);
    }
  }, [currentOrg, currentLibrary, selectedFloor, heatmapTimeRange, showToast]);

  useEffect(() => {
    if (showHeatmap && selectedFloor && !isEditMode) {
      fetchHeatmap();
    }
  }, [showHeatmap, selectedFloor, isEditMode, fetchHeatmap]);

  useEffect(() => {
    if (!isEditMode && selectedFloor) {
      fetchPublishedFloorPlan();
    }
  }, [isEditMode, selectedFloor, fetchPublishedFloorPlan]);

  // If initialRackCode changes externally, select it
  useEffect(() => {
    if (initialRackCode) {
      setSelectedRackCode(initialRackCode);
    }
  }, [initialRackCode]);

  // 3. Fetch Selected Rack Shelves
  useEffect(() => {
    if (!currentOrg || !currentLibrary || !selectedRackCode || isEditMode) return;

    setLoadingRack(true);
    api.floorPlan
      .getRackShelves(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        selectedRackCode,
      )
      .then((data) => {
        setRackDetails(data);
        const shelfWithBooks = data.shelves.find((s) => s.totalCopies > 0);
        setSelectedShelfNumber(shelfWithBooks ? shelfWithBooks.shelfNumber : 1);
      })
      .catch((err: any) => {
        showToast(err.message || `Failed to load rack ${selectedRackCode}`, 'error');
      })
      .finally(() => {
        setLoadingRack(false);
      });
  }, [currentOrg, currentLibrary, selectedRackCode, isEditMode, showToast]);

  // 4. Create New Floor
  const handleCreateFloor = async () => {
    if (!currentOrg || !currentLibrary) return;
    setIsCreatingFloor(true);
    try {
      const payload: CreateFloorRequest = {
        floorNumber: newFloorNumber,
        name: newFloorName,
        canvasWidth: newCanvasWidth,
        canvasHeight: newCanvasHeight,
      };
      const created = await api.floorPlan.createFloor(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
        payload,
      );
      showToast(`Floor ${created.floorNumber} created successfully`, 'success');
      setShowAddFloorDialog(false);
      setFloors((prev) => [...prev, created]);
      setSelectedFloorId(created.floorId);
      setIsEditMode(true); // Open studio directly for the new floor
    } catch (err: any) {
      showToast(err.message || 'Failed to create floor', 'error');
    } finally {
      setIsCreatingFloor(false);
    }
  };

  const activeShelf = rackDetails?.shelves.find((s) => s.shelfNumber === selectedShelfNumber);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Screen Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
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
            Spatial layout for <strong>{currentLibrary?.name}</strong>. Select any physical rack fixture to inspect shelf contents and physical copies.
          </p>
        </div>

        {/* Top Controls: Floor Switcher, Studio Toggle, Refresh */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Floor Selector */}
          {floors.length > 0 && (
            <div style={{ display: 'flex', gap: '6px' }}>
              {floors.map((fl) => {
                const isCurrent = fl.floorId === (selectedFloor?.floorId || '');
                return (
                  <Chip
                    key={fl.floorId}
                    active={isCurrent}
                    onClick={() => {
                      setSelectedFloorId(fl.floorId);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    Level {fl.floorNumber}: {fl.name}
                  </Chip>
                );
              })}
            </div>
          )}

          {/* Add Floor (Staff Only) */}
          {isStaff && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setNewFloorNumber(floors.length + 1);
                setNewFloorName(`Level ${floors.length + 1} - Stacks`);
                setShowAddFloorDialog(true);
              }}
              iconLeft={<Plus size={14} />}
            >
              Add Level
            </Button>
          )}

          {/* Staff Studio Toggle */}
          {isStaff && selectedFloor && (
            <Button
              variant={isEditMode ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setIsEditMode(!isEditMode)}
              iconLeft={isEditMode ? <Eye size={14} /> : <Edit3 size={14} />}
            >
              {isEditMode ? 'Exit Studio' : 'Edit Floor Plan'}
            </Button>
          )}

          {/* Heatmap Toggle Button */}
          {!isEditMode && selectedFloor && (
            <button
              onClick={() => setShowHeatmap((prev) => !prev)}
              className={`heatmap-toggle-btn ${showHeatmap ? 'active' : ''}`}
              title="Toggle Circulation Heatmap Overlay"
            >
              <Flame size={14} className="flame-icon" />
              <span>{showHeatmap ? 'Heatmap: ON' : 'Circulation Heatmap'}</span>
            </button>
          )}

          {/* Heatmap Time Range Filter */}
          {!isEditMode && showHeatmap && (
            <div
              style={{
                display: 'flex',
                gap: '4px',
                background: 'var(--canvas)',
                padding: '3px',
                borderRadius: '999px',
                border: '1px solid var(--border)',
              }}
            >
              <button
                onClick={() => setHeatmapTimeRange('30d')}
                className={`heatmap-time-btn ${heatmapTimeRange === '30d' ? 'active' : ''}`}
              >
                30 Days
              </button>
              <button
                onClick={() => setHeatmapTimeRange('90d')}
                className={`heatmap-time-btn ${heatmapTimeRange === '90d' ? 'active' : ''}`}
              >
                90 Days
              </button>
              <button
                onClick={() => setHeatmapTimeRange('all')}
                className={`heatmap-time-btn ${heatmapTimeRange === 'all' ? 'active' : ''}`}
              >
                All Time
              </button>
            </div>
          )}

          {!isEditMode && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                fetchPublishedFloorPlan();
                if (showHeatmap) fetchHeatmap();
              }}
              disabled={loadingMap || loadingHeatmap}
              iconLeft={<RefreshCw size={14} className={loadingMap || loadingHeatmap ? 'spin' : ''} />}
            >
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Mode 1: Floor Plan Studio (Editor Mode for Staff) */}
      {isEditMode && selectedFloor ? (
        <FloorPlanEditor
          orgId={currentOrg!.organization.organizationId}
          libraryId={currentLibrary!.libraryId}
          floor={selectedFloor}
          onFloorUpdated={() => {
            fetchFloors();
            fetchPublishedFloorPlan();
          }}
          onClose={() => setIsEditMode(false)}
        />
      ) : loadingFloors ? (
        <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
          <LoadingState message="Loading floors and spatial plans..." />
        </div>
      ) : floors.length === 0 ? (
        <EmptyState
          title="No Floor Levels Defined"
          description={
            isStaff
              ? 'No floors have been created for this library yet. Click below to create Level 1.'
              : 'No floor layouts have been configured for this library branch yet.'
          }
          action={
            isStaff
              ? {
                  label: '+ Create Level 1 Floor',
                  onClick: () => setShowAddFloorDialog(true),
                }
              : undefined
          }
        />
      ) : loadingMap ? (
        <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
          <LoadingState message="Rendering published floor map..." />
        </div>
      ) : !floorPlan || !floorPlan.fixtures || floorPlan.fixtures.length === 0 ? (
        <EmptyState
          title={`No Published Layout for ${selectedFloor?.name || 'This Level'}`}
          description={
            isStaff
              ? 'This floor has draft elements or no published version yet. Enter Floor Plan Studio to design and publish the layout.'
              : 'The spatial layout for this floor level is currently undergoing maintenance and has not been published.'
          }
          action={
            isStaff
              ? {
                  label: 'Open Floor Plan Studio',
                  onClick: () => setIsEditMode(true),
                }
              : {
                  label: 'Refresh Map',
                  onClick: fetchPublishedFloorPlan,
                }
          }
        />
      ) : (
        /* Mode 2: Published Reader Viewer Mode */
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '24px', alignItems: 'start' }}>
          {/* LEFT: Spatial Floor Plan Canvas */}
          <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} style={{ color: 'var(--accent)' }} />
                <strong style={{ fontSize: '16px', color: 'var(--text)' }}>
                  {floorPlan.floorName} &bull; Published Interactive Map
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Scale: {Math.round(zoomLevel * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.1).toFixed(1))))}
                >
                  -
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoomLevel((z) => Math.min(1.2, Number((z + 0.1).toFixed(1))))}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Map Legend (Standard vs Circulation Heatmap Mode) */}
            {showHeatmap ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'color-mix(in srgb, #f97316 8%, var(--canvas))',
                  borderRadius: '10px',
                  fontSize: '12px',
                  border: '1px solid color-mix(in srgb, #f97316 26%, var(--border))',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Flame size={15} color="#ef4444" className="flame-icon" />
                  <strong style={{ color: 'var(--text)' }}>Circulation Heatmap ({heatmapTimeRange.toUpperCase()})</strong>
                  <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
                    {heatmapData ? `${heatmapData.totalFloorLoans} total checkouts` : 'Aggregating circulation...'}
                  </span>
                  {heatmapData?.peakRackCode && heatmapData.peakLoanCount > 0 && (
                    <span className="pill red" style={{ fontSize: '10px', padding: '2px 8px' }}>
                      🔥 Hotspot: Rack {heatmapData.peakRackCode} ({heatmapData.peakLoanCount} loans)
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 650 }}>Cool (0)</span>
                  <div className="heatmap-legend-gradient" />
                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 750 }}>
                    Hotspot ({heatmapData?.peakLoanCount || 'Max'})
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '8px 12px',
                  background: 'var(--canvas)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)' }} />
                  <span>Selected Rack</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                  <span>Available Copies</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--border)' }} />
                  <span>No Copies / Loaned</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#334155' }} />
                  <span>Walls & Desks</span>
                </div>
              </div>
            )}

            {/* Scaled Spatial Canvas */}
            <div
              style={{
                position: 'relative',
                background: 'var(--canvas)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                minHeight: '420px',
                overflow: 'auto',
                padding: '16px',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: `${floorPlan.canvasWidth}px`,
                  height: `${floorPlan.canvasHeight}px`,
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top left',
                  background: 'var(--surface)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                }}
              >
                {/* SVG Ambient Radial Heat Aura Layer (Background Layer in Heatmap Mode) */}
                {showHeatmap && (
                  <svg
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: `${floorPlan.canvasWidth}px`,
                      height: `${floorPlan.canvasHeight}px`,
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  >
                    <defs>
                      <filter id="heatGlowBlur" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="30" />
                      </filter>
                      <radialGradient id="grad-hot" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.75" />
                        <stop offset="45%" stopColor="#f97316" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                      </radialGradient>
                      <radialGradient id="grad-warm" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6" />
                        <stop offset="50%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </radialGradient>
                      <radialGradient id="grad-cool" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    {floorPlan.fixtures.map((fixture) => {
                      const rackCode = fixture.linkedRackCode || '';
                      if (!rackCode) return null;
                      const metric = heatmapData?.racks.find(
                        (r) => r.rackCode.toUpperCase() === rackCode.toUpperCase(),
                      );
                      const heatScore = metric?.heatScore || 0;
                      const cx = fixture.x + fixture.width / 2;
                      const cy = fixture.y + fixture.height / 2;
                      const r = Math.max(fixture.width, fixture.height) * 1.35;
                      const gradId =
                        heatScore >= 0.5 ? 'url(#grad-hot)' : heatScore >= 0.2 ? 'url(#grad-warm)' : 'url(#grad-cool)';
                      const opacity = 0.25 + heatScore * 0.6;

                      return (
                        <circle
                          key={`aura-${fixture.elementId}`}
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={gradId}
                          opacity={opacity}
                          filter="url(#heatGlowBlur)"
                        />
                      );
                    })}
                  </svg>
                )}

                {floorPlan.fixtures.map((fixture) => {
                  const rackCode = fixture.linkedRackCode || '';
                  const isRack = fixture.elementType === 'RACK' || (!fixture.elementType && rackCode);
                  const isSelected = isRack && rackCode && selectedRackCode.toUpperCase() === rackCode.toUpperCase();
                  const availCopies = fixture.availableCopiesCount || 0;
                  const hasCopies = availCopies > 0;

                  // Render Non-Rack Elements (Wall, Door, Desk)
                  if (!isRack) {
                    const isWall = fixture.elementType === 'WALL';
                    const isDoor = fixture.elementType === 'DOOR';
                    return (
                      <div
                        key={fixture.elementId}
                        style={{
                          position: 'absolute',
                          left: `${fixture.x}px`,
                          top: `${fixture.y}px`,
                          width: `${fixture.width}px`,
                          height: `${fixture.height}px`,
                          transform: `rotate(${fixture.rotation}deg)`,
                          transformOrigin: 'center center',
                          background: isWall ? '#334155' : isDoor ? '#10b98122' : '#f59e0b22',
                          border: isWall ? 'none' : isDoor ? '1px dashed #10b981' : '1px solid #f59e0b',
                          borderRadius: isDoor ? '0 8px 0 0' : '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          color: isWall ? '#fff' : 'var(--muted)',
                          userSelect: 'none',
                          zIndex: 2,
                        }}
                      >
                        {fixture.label || fixture.elementType}
                      </div>
                    );
                  }

                  // Heatmap Metrics for this Rack
                  const heatMetric = heatmapData?.racks.find(
                    (r) => r.rackCode.toUpperCase() === rackCode.toUpperCase(),
                  );
                  const heatScore = heatMetric?.heatScore || 0;
                  const isPeak =
                    heatmapData?.peakRackCode &&
                    rackCode &&
                    heatmapData.peakRackCode.toUpperCase() === rackCode.toUpperCase() &&
                    heatmapData.peakLoanCount > 0;
                  const loansCount = heatMetric?.totalLoans || 0;

                  // Render Interactive Rack Element
                  return (
                    <button
                      key={fixture.elementId}
                      onClick={() => {
                        if (rackCode) setSelectedRackCode(rackCode);
                      }}
                      onMouseEnter={() => {
                        if (rackCode) setHoveredHeatmapRackCode(rackCode);
                      }}
                      onMouseLeave={() => {
                        setHoveredHeatmapRackCode(null);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${fixture.x}px`,
                        top: `${fixture.y}px`,
                        width: `${fixture.width}px`,
                        height: `${fixture.height}px`,
                        transform: `rotate(${fixture.rotation}deg)`,
                        transformOrigin: 'center center',
                        background: showHeatmap
                          ? isPeak
                            ? 'color-mix(in srgb, #ef4444 26%, var(--surface))'
                            : heatScore >= 0.7
                            ? 'color-mix(in srgb, #ef4444 20%, var(--surface))'
                            : heatScore >= 0.35
                            ? 'color-mix(in srgb, #f97316 18%, var(--surface))'
                            : heatScore >= 0.1
                            ? 'color-mix(in srgb, #f59e0b 14%, var(--surface))'
                            : 'color-mix(in srgb, #10b981 10%, var(--surface))'
                          : isSelected
                          ? 'color-mix(in srgb, var(--accent) 15%, var(--surface))'
                          : 'var(--surface)',
                        border: showHeatmap
                          ? isPeak
                            ? '2.5px solid #ef4444'
                            : isSelected
                            ? '2.5px solid var(--accent)'
                            : heatScore >= 0.7
                            ? '2px solid #ef4444'
                            : heatScore >= 0.35
                            ? '2px solid #f97316'
                            : heatScore >= 0.1
                            ? '1.5px solid #f59e0b'
                            : '1px solid var(--border)'
                          : isSelected
                          ? '2px solid var(--accent)'
                          : '1px solid var(--border)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '8px',
                        textAlign: 'left',
                        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: showHeatmap && isPeak
                          ? '0 0 16px rgba(239, 68, 68, 0.45)'
                          : isSelected
                          ? 'var(--shadow-md)'
                          : 'var(--shadow-sm)',
                        animation: showHeatmap && isPeak ? 'pulseHeat 2.2s infinite' : 'none',
                        zIndex: isSelected ? 12 : isPeak ? 11 : 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                          #{rackCode}
                        </span>
                        {showHeatmap && isPeak ? (
                          <span
                            title="Peak Circulation Hotspot"
                            style={{
                              background: '#ef4444',
                              color: '#fff',
                              borderRadius: '999px',
                              padding: '1px 5px',
                              fontSize: '9px',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            <Flame size={10} /> HOT
                          </span>
                        ) : isSelected ? (
                          <CheckCircle2 size={13} style={{ color: 'var(--accent)' }} />
                        ) : null}
                      </div>

                      <strong
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {fixture.label || `Rack ${rackCode}`}
                      </strong>

                      {showHeatmap ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Flame size={11} color={heatScore >= 0.5 ? '#ef4444' : heatScore >= 0.2 ? '#f97316' : '#10b981'} />
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 750,
                                color: heatScore >= 0.5 ? '#ef4444' : heatScore >= 0.2 ? '#f97316' : 'var(--text)',
                              }}
                            >
                              {loansCount} {loansCount === 1 ? 'loan' : 'loans'}
                            </span>
                          </div>
                          {heatMetric?.topGenre && (
                            <span
                              style={{
                                fontSize: '9px',
                                color: 'var(--muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '65px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {heatMetric.topGenre}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: hasCopies ? '#10b981' : 'var(--muted)',
                            }}
                          />
                          <span style={{ fontSize: '10px', fontWeight: 600, color: hasCopies ? '#10b981' : 'var(--muted)' }}>
                            {availCopies} {availCopies === 1 ? 'copy' : 'copies'}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Heatmap Inspector Bar */}
            {showHeatmap && (
              <div
                style={{
                  background: 'var(--canvas)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  animation: 'enterFadeSlide 0.2s ease-out',
                }}
              >
                {(() => {
                  const targetCode = hoveredHeatmapRackCode || selectedRackCode;
                  const activeMetric = heatmapData?.racks.find(
                    (r) => r.rackCode.toUpperCase() === targetCode.toUpperCase(),
                  );
                  if (!activeMetric) {
                    return (
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        Hover or click any rack fixture to inspect circulation velocity and top borrowed genres.
                      </span>
                    );
                  }
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: activeMetric.heatScore >= 0.5 ? '#ef444422' : 'var(--accent-soft)',
                            color: activeMetric.heatScore >= 0.5 ? '#ef4444' : 'var(--accent)',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <Flame size={18} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text)' }}>
                            Rack #{activeMetric.rackCode} &bull; {activeMetric.rackName || `Rack ${activeMetric.rackCode}`}
                          </strong>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {activeMetric.totalCopies} physical copies &bull; Turnover: {Math.round(activeMetric.turnoverRate * 100)}%
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>
                            Checkouts ({heatmapTimeRange.toUpperCase()})
                          </span>
                          <strong style={{ fontSize: '14px', color: activeMetric.heatScore >= 0.5 ? '#ef4444' : 'var(--text)' }}>
                            {activeMetric.totalLoans} loans
                          </strong>
                        </div>
                        {activeMetric.topGenre && (
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>
                              Top Genre
                            </span>
                            <span className="pill" style={{ fontSize: '10px', padding: '3px 8px' }}>
                              {activeMetric.topGenre}
                            </span>
                          </div>
                        )}
                        {activeMetric.topBookTitle && (
                          <div style={{ textAlign: 'right', maxWidth: '140px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>
                              Top Title
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 650,
                                color: 'var(--text)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'block',
                              }}
                              title={activeMetric.topBookTitle}
                            >
                              {activeMetric.topBookTitle}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Quick Rack Switcher Pills */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Quick Rack Selector:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {floorPlan.fixtures
                  .filter((f) => f.linkedRackCode)
                  .map((f) => {
                    const code = f.linkedRackCode!;
                    const isSelected = selectedRackCode.toUpperCase() === code.toUpperCase();
                    return (
                      <Chip
                        key={f.elementId}
                        active={isSelected}
                        onClick={() => setSelectedRackCode(code)}
                        style={{ cursor: 'pointer' }}
                      >
                        Rack {code} ({f.availableCopiesCount || 0} avail)
                      </Chip>
                    );
                  })}
              </div>
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
                <Chip active>Rack Code: {selectedRackCode}</Chip>
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
                      SELECT SHELF (1 - {rackDetails.shelves.length}):
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(6, rackDetails.shelves.length || 1)}, 1fr)`, gap: '6px' }}>
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

      {/* Add Floor Dialog (Staff Only) */}
      <Dialog
        isOpen={showAddFloorDialog}
        onClose={() => setShowAddFloorDialog(false)}
        title="Add Floor Level"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Create a new floor level for <strong>{currentLibrary?.name}</strong>. You will be able to design its spatial layout in the Floor Plan Studio.
          </p>

          <FormField label="Floor Level Number">
            <TextInput
              type="number"
              value={newFloorNumber}
              onChange={(e) => setNewFloorNumber(parseInt(e.target.value, 10) || 1)}
              min={1}
            />
          </FormField>

          <FormField label="Floor Name / Zone Description">
            <TextInput
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              placeholder="e.g. Level 2 - Fiction & Media"
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Canvas Width (px)">
              <TextInput
                type="number"
                value={newCanvasWidth}
                onChange={(e) => setNewCanvasWidth(parseInt(e.target.value, 10) || 1000)}
                min={200}
                max={4000}
              />
            </FormField>
            <FormField label="Canvas Height (px)">
              <TextInput
                type="number"
                value={newCanvasHeight}
                onChange={(e) => setNewCanvasHeight(parseInt(e.target.value, 10) || 700)}
                min={200}
                max={4000}
              />
            </FormField>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setShowAddFloorDialog(false)} disabled={isCreatingFloor}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateFloor} disabled={isCreatingFloor}>
              {isCreatingFloor ? 'Creating...' : 'Create Floor & Open Studio'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
