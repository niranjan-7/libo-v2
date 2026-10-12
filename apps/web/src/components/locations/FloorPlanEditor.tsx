import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LibraryFloorDto,
  FloorPlanVersionDto,
  SpatialLayoutElementDto,
  LogicalRackDto,
  ValidateFloorPlanResponse,
  SpatialElementType,
  FloorPlanVersionStatus,
} from '@library/contracts';
import { api } from '../../api/client';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { FormField, TextInput, Select } from '../ui/Input';
import { Chip, StatusBadge } from '../ui/Pill';
import { Dialog } from '../ui/Dialog';
import { LoadingState } from '../ui/StateIndicators';
import { useToast } from '../ui/Toast';
import {
  Save,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Trash2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Plus,
  Eye,
  History,
  Send,
  Copy,
  Layers,
  ArrowUp,
  ArrowDown,
  Grid,
  X,
  Compass,
} from 'lucide-react';

interface FloorPlanEditorProps {
  orgId: string;
  libraryId: string;
  floor: LibraryFloorDto;
  onFloorUpdated?: () => void;
  onClose?: () => void;
}

export const FloorPlanEditor: React.FC<FloorPlanEditorProps> = ({
  orgId,
  libraryId,
  floor,
  onFloorUpdated,
  onClose,
}) => {
  const { showToast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [draftVersion, setDraftVersion] = useState<FloorPlanVersionDto | null>(null);
  const [elements, setElements] = useState<SpatialLayoutElementDto[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [logicalRacks, setLogicalRacks] = useState<LogicalRackDto[]>([]);

  // History stack for Undo / Redo
  const [history, setHistory] = useState<SpatialLayoutElementDto[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Editor Viewport & Tools
  const [zoom, setZoom] = useState<number>(1.0);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const gridSize = 10;
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Modals
  const [validationResult, setValidationResult] = useState<ValidateFloorPlanResponse | null>(null);
  const [showValidationDialog, setShowValidationDialog] = useState<boolean>(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState<boolean>(false);
  const [versionsList, setVersionsList] = useState<FloorPlanVersionDto[]>([]);
  const [loadingVersions, setLoadingVersions] = useState<boolean>(false);

  // Dragging & Interaction refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizingElementId, setResizingElementId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });

  // 1. Initial Load: Fetch Draft & Logical Racks
  const loadDraftAndRacks = useCallback(async () => {
    setLoading(true);
    try {
      const [draft, racks] = await Promise.all([
        api.floorPlan.getDraft(orgId, libraryId, floor.floorId),
        api.floorPlan.getLogicalRacks(orgId, libraryId, floor.floorId),
      ]);
      setDraftVersion(draft);
      setElements(draft.elements || []);
      setLogicalRacks(racks);

      // Initialize history
      setHistory([draft.elements || []]);
      setHistoryIndex(0);
    } catch (err: any) {
      showToast(err.message || 'Failed to initialize floor plan editor', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, libraryId, floor.floorId, showToast]);

  useEffect(() => {
    loadDraftAndRacks();
  }, [loadDraftAndRacks]);

  // Update history when elements change from user actions
  const pushHistory = (newElements: SpatialLayoutElementDto[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newElements);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setElements(newElements);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setElements(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setElements(next);
    }
  };

  const snap = (val: number): number => {
    if (!snapToGrid) return Math.round(val);
    return Math.round(val / gridSize) * gridSize;
  };

  // Selected element
  const selectedElement = elements.find((el) => el.elementId === selectedElementId) || null;

  // Add Element
  const handleAddElement = (type: SpatialElementType) => {
    const newId = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const defaults: Record<SpatialElementType, { w: number; h: number; label: string; color: string }> = {
      RACK: { w: 120, h: 60, label: 'Rack Unit', color: '#3b82f6' },
      WALL: { w: 160, h: 20, label: 'Wall', color: '#475569' },
      DOOR: { w: 80, h: 30, label: 'Entryway', color: '#10b981' },
      DESK: { w: 100, h: 70, label: 'Study Desk', color: '#f59e0b' },
    };

    const cfg = defaults[type];
    const newElement: SpatialLayoutElementDto = {
      elementId: newId,
      versionId: draftVersion?.versionId || '',
      elementType: type,
      label: cfg.label,
      x: snap(100 + elements.length * 15),
      y: snap(100 + elements.length * 15),
      width: cfg.w,
      height: cfg.h,
      rotation: 0,
      zIndex: elements.length + 1,
      properties: { color: cfg.color, label: cfg.label },
    };

    const updated = [...elements, newElement];
    pushHistory(updated);
    setSelectedElementId(newId);
  };

  // Delete Element
  const handleDeleteElement = (id: string) => {
    const updated = elements.filter((el) => el.elementId !== id);
    pushHistory(updated);
    if (selectedElementId === id) setSelectedElementId(null);
  };

  // Duplicate Element
  const handleDuplicateElement = (element: SpatialLayoutElementDto) => {
    const newId = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const duplicated: SpatialLayoutElementDto = {
      ...element,
      elementId: newId,
      x: snap(element.x + 30),
      y: snap(element.y + 30),
      linkedLocationId: undefined, // Clear link to prevent conflict
      linkedRackCode: undefined,
      zIndex: elements.length + 1,
    };
    const updated = [...elements, duplicated];
    pushHistory(updated);
    setSelectedElementId(newId);
    showToast('Element duplicated (link cleared to avoid duplicate conflict)', 'info');
  };

  // Update selected element property
  const updateElementProperty = (key: keyof SpatialLayoutElementDto | string, value: any) => {
    if (!selectedElementId) return;
    const updated = elements.map((el) => {
      if (el.elementId === selectedElementId) {
        if (key in el) {
          const next = { ...el, [key]: value };
          if (key === 'label') {
            next.properties = { ...(next.properties || {}), label: value };
          }
          return next;
        } else {
          return {
            ...el,
            properties: { ...(el.properties || {}), [key]: value },
          };
        }
      }
      return el;
    });
    pushHistory(updated);
  };

  // Reordering Z-index
  const handleBringForward = () => {
    if (!selectedElement) return;
    const currentZ = selectedElement.zIndex || 1;
    updateElementProperty('zIndex', currentZ + 1);
  };

  const handleSendBackward = () => {
    if (!selectedElement) return;
    const currentZ = selectedElement.zIndex || 1;
    updateElementProperty('zIndex', Math.max(1, currentZ - 1));
  };

  // Rotate Element
  const handleRotate = (degreesDelta: number) => {
    if (!selectedElement) return;
    const newRotation = (Math.round((selectedElement.rotation + degreesDelta) / 15) * 15 + 360) % 360;
    updateElementProperty('rotation', newRotation);
  };

  // Dragging on canvas
  const handleMouseDownElement = (e: React.MouseEvent, element: SpatialLayoutElementDto) => {
    if (previewMode) return;
    e.stopPropagation();
    setSelectedElementId(element.elementId);
    setDraggingElementId(element.elementId);

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (canvasRect) {
      const mouseX = (e.clientX - canvasRect.left) / zoom;
      const mouseY = (e.clientY - canvasRect.top) / zoom;
      setDragOffset({
        x: mouseX - element.x,
        y: mouseY - element.y,
      });
    }
  };

  // Resizing on canvas handle
  const handleMouseDownResize = (e: React.MouseEvent, element: SpatialLayoutElementDto) => {
    if (previewMode) return;
    e.stopPropagation();
    setResizingElementId(element.elementId);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      w: element.width,
      h: element.height,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (previewMode) return;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    if (draggingElementId) {
      const mouseX = (e.clientX - canvasRect.left) / zoom;
      const mouseY = (e.clientY - canvasRect.top) / zoom;

      const newX = Math.max(0, snap(mouseX - dragOffset.x));
      const newY = Math.max(0, snap(mouseY - dragOffset.y));

      setElements((prev) =>
        prev.map((el) => (el.elementId === draggingElementId ? { ...el, x: newX, y: newY } : el))
      );
    } else if (resizingElementId) {
      const deltaX = (e.clientX - resizeStart.x) / zoom;
      const deltaY = (e.clientY - resizeStart.y) / zoom;

      const newW = Math.max(20, snap(resizeStart.w + deltaX));
      const newH = Math.max(15, snap(resizeStart.h + deltaY));

      setElements((prev) =>
        prev.map((el) => (el.elementId === resizingElementId ? { ...el, width: newW, height: newH } : el))
      );
    }
  };

  const handleMouseUp = () => {
    if (draggingElementId || resizingElementId) {
      pushHistory(elements);
      setDraggingElementId(null);
      setResizingElementId(null);
    }
  };

  // 2. Save Draft
  const handleSaveDraft = async () => {
    if (!draftVersion) return;
    setIsSaving(true);
    try {
      const saved = await api.floorPlan.saveDraft(
        orgId,
        libraryId,
        floor.floorId,
        draftVersion.versionId,
        { elements }
      );
      setDraftVersion(saved);
      showToast('Floor plan draft saved successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save draft', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Validate Draft
  const handleValidateDraft = async () => {
    if (!draftVersion) return;
    setIsValidating(true);
    try {
      // Auto-save before validating so server validates active state
      await api.floorPlan.saveDraft(
        orgId,
        libraryId,
        floor.floorId,
        draftVersion.versionId,
        { elements }
      );
      const res = await api.floorPlan.validateDraft(
        orgId,
        libraryId,
        floor.floorId,
        draftVersion.versionId
      );
      setValidationResult(res);
      setShowValidationDialog(true);
    } catch (err: any) {
      showToast(err.message || 'Validation request failed', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // 4. Publish Draft
  const handlePublishDraft = async () => {
    if (!draftVersion) return;
    setIsPublishing(true);
    try {
      // First auto-save
      await api.floorPlan.saveDraft(
        orgId,
        libraryId,
        floor.floorId,
        draftVersion.versionId,
        { elements }
      );

      const pubRes = await api.floorPlan.publishDraft(
        orgId,
        libraryId,
        floor.floorId,
        draftVersion.versionId
      );
      showToast(`Floor plan published to readers! (Version ${pubRes.versionNumber})`, 'success');
      onFloorUpdated?.();
      // Reload draft state
      await loadDraftAndRacks();
    } catch (err: any) {
      showToast(err.message || 'Publishing failed. Please fix validation errors.', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  // 5. Version History & Restore
  const handleOpenVersions = async () => {
    setLoadingVersions(true);
    setShowHistoryDialog(true);
    try {
      const versions = await api.floorPlan.getVersions(orgId, libraryId, floor.floorId);
      setVersionsList(versions);
    } catch (err: any) {
      showToast(err.message || 'Failed to load version history', 'error');
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestoreVersion = async (targetVersionId: string) => {
    try {
      const restored = await api.floorPlan.restoreVersion(
        orgId,
        libraryId,
        floor.floorId,
        targetVersionId
      );
      setDraftVersion(restored);
      setElements(restored.elements || []);
      setHistory([restored.elements || []]);
      setHistoryIndex(0);
      setShowHistoryDialog(false);
      showToast(`Restored elements into active draft!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to restore version', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
        <LoadingState message="Loading Floor Plan Studio..." />
      </div>
    );
  }

  // Linked Rack Options for Selected Element
  const usedRackIds = elements
    .filter((el) => el.elementId !== selectedElementId && el.linkedLocationId)
    .map((el) => el.linkedLocationId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: 'var(--canvas)',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid var(--border)',
      }}
    >
      {/* Studio Header & Main Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '22px',
                  margin: 0,
                  color: 'var(--text)',
                }}
              >
                Floor Plan Studio &bull; {floor.name}
              </h2>
              <Chip active>Level {floor.floorNumber}</Chip>
              {draftVersion && (
                <StatusBadge status={draftVersion.status as FloorPlanVersionStatus} />
              )}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--muted)' }}>
              Canvas: {floor.canvasWidth} &times; {floor.canvasHeight} px &bull; {elements.length} layout elements
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Preview Toggle */}
          <Button
            variant={previewMode ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setPreviewMode(!previewMode)}
            iconLeft={<Eye size={15} />}
          >
            {previewMode ? 'Exit Preview' : 'Reader Preview'}
          </Button>

          {/* History / Restore */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenVersions}
            iconLeft={<History size={15} />}
          >
            Versions & Restore
          </Button>

          {/* Save Draft */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSaving || previewMode}
            iconLeft={<Save size={15} />}
          >
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>

          {/* Validate */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleValidateDraft}
            disabled={isValidating || previewMode}
            iconLeft={<CheckCircle2 size={15} />}
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </Button>

          {/* Publish */}
          <Button
            variant="primary"
            size="sm"
            onClick={handlePublishDraft}
            disabled={isPublishing || previewMode}
            iconLeft={<Send size={15} />}
          >
            {isPublishing ? 'Publishing...' : 'Publish Floor Plan'}
          </Button>

          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} iconLeft={<X size={15} />}>
              Close Studio
            </Button>
          )}
        </div>
      </div>

      {/* Editor Controls Bar */}
      {!previewMode && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--surface)',
            padding: '8px 16px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Element Palette */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Add Element:
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAddElement('RACK')}
              iconLeft={<Plus size={14} />}
              style={{ background: 'color-mix(in srgb, #3b82f6 15%, var(--surface))', borderColor: '#3b82f6' }}
            >
              + Rack
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAddElement('WALL')}
              iconLeft={<Plus size={14} />}
              style={{ background: 'color-mix(in srgb, #475569 15%, var(--surface))', borderColor: '#475569' }}
            >
              + Wall
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAddElement('DOOR')}
              iconLeft={<Plus size={14} />}
              style={{ background: 'color-mix(in srgb, #10b981 15%, var(--surface))', borderColor: '#10b981' }}
            >
              + Door
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAddElement('DESK')}
              iconLeft={<Plus size={14} />}
              style={{ background: 'color-mix(in srgb, #f59e0b 15%, var(--surface))', borderColor: '#f59e0b' }}
            >
              + Desk
            </Button>
          </div>

          {/* Viewport & Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Undo / Redo */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={15} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={15} />
              </Button>
            </div>

            <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

            {/* Snap Grid */}
            <Button
              variant={snapToGrid ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSnapToGrid(!snapToGrid)}
              title="Toggle Snapping to 10px Grid"
              iconLeft={<Grid size={15} />}
            >
              Snap {snapToGrid ? 'ON' : 'OFF'}
            </Button>

            <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

            {/* Zoom Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </Button>
              <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '42px', textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(1))))}
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </Button>
              {zoom !== 1.0 && (
                <Button variant="ghost" size="sm" onClick={() => setZoom(1.0)}>
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Studio Area: Canvas + Inspector */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: previewMode ? '1fr' : '1fr 340px',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* Left: Interactive Canvas */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'auto',
            maxHeight: '680px',
            position: 'relative',
            padding: '24px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => {
            if (!draggingElementId && !resizingElementId) {
              setSelectedElementId(null);
            }
          }}
        >
          {/* Actual Scaled Floor Plan Canvas */}
          <div
            ref={canvasRef}
            style={{
              position: 'relative',
              width: `${floor.canvasWidth}px`,
              height: `${floor.canvasHeight}px`,
              background: 'var(--canvas)',
              backgroundImage: snapToGrid
                ? 'radial-gradient(var(--border) 1px, transparent 1px)'
                : 'none',
              backgroundSize: '20px 20px',
              border: '2px dashed var(--border)',
              borderRadius: '8px',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              transition: draggingElementId || resizingElementId ? 'none' : 'transform 0.1s ease',
              userSelect: 'none',
            }}
          >
            {elements.map((element) => {
              const isSelected = element.elementId === selectedElementId && !previewMode;
              const isRack = element.elementType === 'RACK';
              const isLinked = !!element.linkedLocationId;
              const bgColor =
                element.properties?.color ||
                (isRack
                  ? '#3b82f6'
                  : element.elementType === 'WALL'
                  ? '#475569'
                  : element.elementType === 'DOOR'
                  ? '#10b981'
                  : '#f59e0b');

              return (
                <div
                  key={element.elementId}
                  onMouseDown={(e) => handleMouseDownElement(e, element)}
                  style={{
                    position: 'absolute',
                    left: `${element.x}px`,
                    top: `${element.y}px`,
                    width: `${element.width}px`,
                    height: `${element.height}px`,
                    transform: `rotate(${element.rotation}deg)`,
                    transformOrigin: 'center center',
                    zIndex: element.zIndex || 1,
                    background:
                      element.elementType === 'WALL'
                        ? '#334155'
                        : `color-mix(in srgb, ${bgColor} 20%, var(--surface))`,
                    border: isSelected
                      ? '2px solid var(--accent)'
                      : `2px solid ${bgColor}`,
                    borderRadius: element.elementType === 'DOOR' ? '0 12px 0 0' : '6px',
                    boxShadow: isSelected
                      ? '0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent), var(--shadow-md)'
                      : 'var(--shadow-sm)',
                    cursor: previewMode ? 'default' : 'move',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '4px',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {/* Element Content */}
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: element.elementType === 'WALL' ? '#fff' : 'var(--text)',
                      lineHeight: 1.2,
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      maxWidth: '100%',
                    }}
                  >
                    {element.label || element.properties?.label || element.elementType}
                  </span>

                  {isRack && (
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        marginTop: '2px',
                        padding: '1px 4px',
                        borderRadius: '4px',
                        background: isLinked ? '#10b981' : '#ef4444',
                        color: '#fff',
                        pointerEvents: 'none',
                      }}
                    >
                      {isLinked ? 'Linked' : 'No Rack'}
                    </span>
                  )}

                  {/* Corner Resize Handle (bottom-right) */}
                  {isSelected && (
                    <div
                      onMouseDown={(e) => handleMouseDownResize(e, element)}
                      style={{
                        position: 'absolute',
                        right: '-4px',
                        bottom: '-4px',
                        width: '10px',
                        height: '10px',
                        background: 'var(--accent)',
                        border: '2px solid #fff',
                        borderRadius: '2px',
                        cursor: 'se-resize',
                        zIndex: 10,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Inspector & Properties Panel */}
        {!previewMode && (
          <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} style={{ color: 'var(--accent)' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                  {selectedElement ? 'Element Properties' : 'Inspector'}
                </h3>
              </div>
              {selectedElement && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicateElement(selectedElement)}
                    title="Duplicate Element"
                  >
                    <Copy size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteElement(selectedElement.elementId)}
                    title="Delete Element"
                    style={{ color: 'var(--danger-text)' }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
            </div>

            {!selectedElement ? (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--muted)', fontSize: '13px' }}>
                <Compass size={28} style={{ opacity: 0.5, marginBottom: '8px' }} />
                <p style={{ margin: 0 }}>Click any element on the floor plan canvas to inspect and edit its properties.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Element Type & Label */}
                <FormField label="Element Type">
                  <Select
                    value={selectedElement.elementType}
                    onChange={(e) => updateElementProperty('elementType', e.target.value)}
                    options={[
                      { value: 'RACK', label: 'RACK (Physical Book Rack)' },
                      { value: 'WALL', label: 'WALL (Interior Wall / Boundary)' },
                      { value: 'DOOR', label: 'DOOR (Entryway / Exit)' },
                      { value: 'DESK', label: 'DESK (Study / Staff Desk)' },
                    ]}
                  />
                </FormField>

                <FormField label="Display Label">
                  <TextInput
                    value={selectedElement.label || selectedElement.properties?.label || ''}
                    onChange={(e) => updateElementProperty('label', e.target.value)}
                    placeholder="e.g. Rack A - Fiction"
                  />
                </FormField>

                {/* Logical Rack Linking for RACK elements */}
                {selectedElement.elementType === 'RACK' && (
                  <div
                    style={{
                      background: 'color-mix(in srgb, #3b82f6 8%, var(--surface))',
                      border: '1px solid color-mix(in srgb, #3b82f6 30%, transparent)',
                      borderRadius: '10px',
                      padding: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6' }}>
                        LOGICAL RACK LINK
                      </span>
                      {selectedElement.linkedLocationId ? (
                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>Linked</span>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Unlinked</span>
                      )}
                    </div>
                    <Select
                      value={selectedElement.linkedLocationId || ''}
                      onChange={(e) => {
                        const val = e.target.value || undefined;
                        updateElementProperty('linkedLocationId', val);
                        if (val) {
                          const matchedRack = logicalRacks.find((r) => r.locationId === val);
                          if (matchedRack && (!selectedElement.label || selectedElement.label === 'Rack Unit')) {
                            updateElementProperty('label', `Rack ${matchedRack.code}`);
                          }
                        }
                      }}
                    >
                      <option value="">-- Select a Logical Rack Location --</option>
                      {logicalRacks.map((rack) => {
                        const isAlreadyUsed = usedRackIds.includes(rack.locationId);
                        return (
                          <option
                            key={rack.locationId}
                            value={rack.locationId}
                            disabled={isAlreadyUsed}
                          >
                            Rack {rack.code} - {rack.name} ({rack.shelfCount} shelves)
                            {isAlreadyUsed ? ' (Already linked)' : ''}
                          </option>
                        );
                      })}
                    </Select>
                    <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                      Readers will inspect shelves and copies from this linked rack location.
                    </p>
                  </div>
                )}

                {/* Position & Size */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <FormField label="X (px)">
                    <TextInput
                      type="number"
                      value={selectedElement.x}
                      onChange={(e) => updateElementProperty('x', snap(parseInt(e.target.value, 10) || 0))}
                    />
                  </FormField>
                  <FormField label="Y (px)">
                    <TextInput
                      type="number"
                      value={selectedElement.y}
                      onChange={(e) => updateElementProperty('y', snap(parseInt(e.target.value, 10) || 0))}
                    />
                  </FormField>
                  <FormField label="Width (px)">
                    <TextInput
                      type="number"
                      value={selectedElement.width}
                      onChange={(e) => updateElementProperty('width', Math.max(10, snap(parseInt(e.target.value, 10) || 10)))}
                    />
                  </FormField>
                  <FormField label="Height (px)">
                    <TextInput
                      type="number"
                      value={selectedElement.height}
                      onChange={(e) => updateElementProperty('height', Math.max(10, snap(parseInt(e.target.value, 10) || 10)))}
                    />
                  </FormField>
                </div>

                {/* Rotation */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
                      Rotation: {selectedElement.rotation}&deg;
                    </label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <Button variant="ghost" size="sm" onClick={() => handleRotate(90)} title="Rotate +90°">
                        <RotateCw size={13} /> +90&deg;
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => updateElementProperty('rotation', 0)} title="Reset Rotation">
                        0&deg;
                      </Button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {[0, 90, 180, 270].map((deg) => (
                      <Button
                        key={deg}
                        variant={selectedElement.rotation === deg ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => updateElementProperty('rotation', deg)}
                        style={{ padding: '4px' }}
                      >
                        {deg}&deg;
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Layering (Z-Index) */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                    Layering (Z-Index: {selectedElement.zIndex || 1})
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button variant="secondary" size="sm" onClick={handleBringForward} iconLeft={<ArrowUp size={13} />}>
                      Bring Forward
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleSendBackward} iconLeft={<ArrowDown size={13} />}>
                      Send Backward
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Validation Dialog */}
      <Dialog
        isOpen={showValidationDialog}
        onClose={() => setShowValidationDialog(false)}
        title="Floor Plan Validation Report"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {validationResult?.isValid ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                background: 'color-mix(in srgb, #10b981 12%, var(--surface))',
                border: '1px solid #10b981',
                borderRadius: '10px',
              }}
            >
              <CheckCircle2 size={24} style={{ color: '#10b981', flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', color: 'var(--text)' }}>
                  All Validation Checks Passed
                </strong>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  All rack elements are properly linked to logical locations and dimensions are inside bounds. Ready to publish!
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px',
                background: 'color-mix(in srgb, #ef4444 12%, var(--surface))',
                border: '1px solid #ef4444',
                borderRadius: '10px',
              }}
            >
              <AlertCircle size={24} style={{ color: '#ef4444', flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', color: 'var(--text)' }}>
                  Validation Errors Found ({validationResult?.errors.length || 0})
                </strong>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Resolve the following issues before publishing this floor plan:
                </span>
              </div>
            </div>
          )}

          {/* List of Errors */}
          {validationResult?.errors && validationResult.errors.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {validationResult.errors.map((errText, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 14px',
                    background: 'var(--canvas)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: 'var(--danger-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{errText}</span>
                </div>
              ))}
            </div>
          )}

          {/* List of Warnings */}
          {validationResult?.warnings && validationResult.warnings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
                WARNINGS:
              </span>
              {validationResult.warnings.map((warnText, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--canvas)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: 'var(--muted)',
                  }}
                >
                  &bull; {warnText}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setShowValidationDialog(false)}>
              Close
            </Button>
            {validationResult?.isValid && (
              <Button
                variant="primary"
                onClick={() => {
                  setShowValidationDialog(false);
                  handlePublishDraft();
                }}
              >
                Publish Now
              </Button>
            )}
          </div>
        </div>
      </Dialog>

      {/* Version History & Restore Dialog */}
      <Dialog
        isOpen={showHistoryDialog}
        onClose={() => setShowHistoryDialog(false)}
        title="Floor Plan Version History"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Restore a previous version's layout elements into your current draft. This preserves past designs without affecting the published map until you publish again.
          </p>

          {loadingVersions ? (
            <div style={{ padding: '30px', display: 'flex', justifyContent: 'center' }}>
              <LoadingState message="Fetching versions..." />
            </div>
          ) : versionsList.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No historical versions found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
              {versionsList.map((ver) => {
                const isCurrentDraft = ver.versionId === draftVersion?.versionId;
                const isPublished = ver.status === 'PUBLISHED';
                const elCount = ver.elements?.length || ver.elementCount || 0;

                return (
                  <div
                    key={ver.versionId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px',
                      background: 'var(--canvas)',
                      border: isPublished ? '2px solid #10b981' : '1px solid var(--border)',
                      borderRadius: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '15px' }}>Version {ver.versionNumber}</strong>
                        <StatusBadge status={ver.status as FloorPlanVersionStatus} />
                        {isCurrentDraft && <Chip active>Active Draft</Chip>}
                      </div>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                        Created: {new Date(ver.createdAt).toLocaleDateString()} &bull; {elCount} elements
                      </span>
                    </div>

                    {!isCurrentDraft && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRestoreVersion(ver.versionId)}
                      >
                        Restore into Draft
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setShowHistoryDialog(false)}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
