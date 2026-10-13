import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { useToast } from './ui/Toast';
import { OrgRole, NotificationDto } from '@library/contracts';
import { api } from '../api/client';
import {
  BookOpen,
  Building2,
  Library,
  Shield,
  LogOut,
  Plus,
  UserPlus,
  Moon,
  Sun,
  Layers,
  MapPin,
  BarChart3,
  Settings,
  Users,
  CheckCircle,
  Database,
  Clock,
  Palette,
  Sparkles,
  Menu,
  X,
  Barcode,
  ArrowRightLeft,
  Bell,
  FolderHeart,
  KeyRound,
  Globe,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { CreateOrgModal } from './CreateOrgModal';
import { CreateLibraryModal } from './CreateLibraryModal';
import { InviteMemberModal } from './InviteMemberModal';
import { AcceptInviteModal } from './AcceptInviteModal';
import { AppearanceDrawer } from './theme/AppearanceDrawer';
import { ComponentShowcase } from './showcase/ComponentShowcase';
import { BookCard, BookItem } from './ui/BookCard';
import { CatalogScreen } from './catalog/CatalogScreen';
import { BookDetailsScreen } from './catalog/BookDetailsScreen';
import { LibraryDirectoryScreen } from './catalog/LibraryDirectoryScreen';
import { FloorPlanScreen } from './locations/FloorPlanScreen';
import { InventoryScreen } from './inventory/InventoryScreen';
import { CirculationDeskScreen } from './circulation/CirculationDeskScreen';
import { ReaderCirculationScreen } from './circulation/ReaderCirculationScreen';
import { CommunityScreen } from './community/CommunityScreen';
import { MembersScreen } from './admin/MembersScreen';
import { BranchSettingsScreen } from './admin/BranchSettingsScreen';
import { AnalyticsScreen } from './admin/AnalyticsScreen';

const SAMPLE_OVERVIEW_BOOKS: BookItem[] = [
  {
    id: 1,
    title: 'The Midnight Library',
    author: 'Matt Haig',
    year: 2020,
    tag: 'Fiction',
    status: 'Available',
    copies: 4,
    rating: '4.4',
  },
  {
    id: 2,
    title: 'The Library Book',
    author: 'Susan Orlean',
    year: 2018,
    tag: 'Nonfiction',
    status: 'On loan',
    copies: 2,
    rating: '4.2',
  },
  {
    id: 3,
    title: 'The Shadow of the Wind',
    author: 'Carlos Ruiz Zafón',
    year: 2005,
    tag: 'Mystery',
    status: 'Waitlist',
    copies: 0,
    rating: '4.5',
  },
  {
    id: 4,
    title: 'Project Hail Mary',
    author: 'Andy Weir',
    year: 2021,
    tag: 'Science Fiction',
    status: 'Available',
    copies: 3,
    rating: '4.7',
  },
];

export const DashboardShell: React.FC = () => {
  const {
    user,
    organizations,
    currentOrg,
    currentLibrary,
    currentRole,
    myLibraries,
    activeLibrary,
    isReaderOnly,
    selectOrganization,
    selectLibrary,
    selectActiveLibrary,
    logout,
  } = useAuth();

  const { theme, toggleDarkMode } = useTheme();
  const { showToast } = useToast();

  const [isInsideLibrary, setIsInsideLibrary] = useState<boolean>(() => {
    const saved = localStorage.getItem('is_inside_library');
    if (saved !== null) return saved === 'true';
    return true;
  });

  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'catalog'
    | 'inventory'
    | 'circulation'
    | 'my-circulation'
    | 'community'
    | 'map'
    | 'analytics'
    | 'settings'
    | 'members'
    | 'showcase'
    | 'directory'
    | 'hub-libraries'
    | 'org-hub'
  >(() => {
    const savedInside = localStorage.getItem('is_inside_library');
    return savedInside === 'false' ? 'hub-libraries' : 'catalog';
  });
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedRackCode, setSelectedRackCode] = useState<string | null>('A');
  const [membersTab, setMembersTab] = useState<'members' | 'invitations' | 'requests'>('requests');
  const [membersNavigationNonce, setMembersNavigationNonce] = useState<number>(0);
  const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Modal visibility states
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showCreateLibraryModal, setShowCreateLibraryModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAcceptInviteModal, setShowAcceptInviteModal] = useState(false);
  const [urlInviteToken, setUrlInviteToken] = useState('');
  const [showAppearanceDrawer, setShowAppearanceDrawer] = useState(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);

  // Live Notifications
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Check URL parameters for shared deep links or invite tokens
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedCollectionId = params.get('collectionId');
    const sharedBookId = params.get('bookId');
    const inviteParam = params.get('invite');

    if (inviteParam) {
      setUrlInviteToken(inviteParam);
      setShowAcceptInviteModal(true);
    } else if (sharedCollectionId) {
      setActiveTab('community');
    } else if (sharedBookId) {
      setSelectedBookId(sharedBookId);
      setActiveTab('catalog');
    }
  }, []);

  // When a user has no active library or organization (e.g. freshly registered reader), default to directory
  useEffect(() => {
    if (myLibraries.length === 0 && organizations.length === 0) {
      setActiveTab('directory');
    }
  }, [myLibraries.length, organizations.length]);

  const fetchNotifications = useCallback(async () => {
    if (!currentOrg || !currentLibrary) return;
    try {
      const res = await api.notifications.getMyNotifications(
        currentOrg.organization.organizationId,
        currentLibrary.libraryId,
      );
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
    } catch {
      // Background poll failure is silent
    }
  }, [currentOrg, currentLibrary]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    if (!currentOrg || !currentLibrary) return;
    try {
      await api.notifications.markAsRead(currentOrg.organization.organizationId, currentLibrary.libraryId, id);
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      showToast(err.message || 'Failed to mark notification as read', 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentOrg || !currentLibrary) return;
    try {
      await api.notifications.markAllAsRead(currentOrg.organization.organizationId, currentLibrary.libraryId);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      setUnreadCount(0);
      showToast('All notifications marked as read', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to mark all as read', 'error');
    }
  };

  const handleNotificationClick = async (n: NotificationDto) => {
    // 1. Mark notification as read
    if (!n.readAt) {
      handleMarkAsRead(n.notificationId);
    }

    // 2. Close notifications drawer
    setShowNotificationsDrawer(false);

    // 3. Resolve target library if specified in payload or libraryId
    const targetLibId = n.libraryId || n.payload?.libraryId;
    if (targetLibId) {
      selectActiveLibrary(targetLibId);
      setIsInsideLibrary(true);
      localStorage.setItem('is_inside_library', 'true');
    }

    // 4. Navigate based on notification eventType
    if (n.eventType === 'READER_ACCESS_REQUEST_PENDING') {
      setIsInsideLibrary(true);
      localStorage.setItem('is_inside_library', 'true');
      setMembersTab('requests');
      setMembersNavigationNonce((prev) => prev + 1);
      setHighlightRequestId(n.payload?.requestId || null);
      setActiveTab('members');
      showToast('Opening Reader Access Requests for review & approval.', 'info');
    } else if (n.eventType === 'ACCESS_REQUEST_APPROVED') {
      setIsInsideLibrary(true);
      localStorage.setItem('is_inside_library', 'true');
      setActiveTab('catalog');
      showToast('Your reader access request was approved! Welcome.', 'success');
    } else if (
      n.eventType.startsWith('LOAN_') ||
      n.eventType.startsWith('RESERVATION_') ||
      n.eventType.startsWith('FINE_') ||
      n.eventType.startsWith('WALLET_')
    ) {
      setIsInsideLibrary(true);
      localStorage.setItem('is_inside_library', 'true');
      setActiveTab('my-circulation');
    } else {
      if (targetLibId) {
        setIsInsideLibrary(true);
        localStorage.setItem('is_inside_library', 'true');
        setActiveTab('catalog');
      }
    }
  };

  const canManageLibraries = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;
  const isStaff = canManageLibraries || activeLibrary?.role === 'LIBRARIAN';
  const canInviteMembers = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;

  const libraryCount = currentOrg?.libraries.length || 0;
  const isLibraryLimitReached = libraryCount >= 3;

  // Compile all libraries accessible to this user
  const accessibleLibraries: Array<{
    libraryId: string;
    name: string;
    slug: string;
    orgName: string;
    orgId: string;
    role: 'OWNER' | 'ADMIN' | 'LIBRARIAN' | 'READER';
    timezone?: string;
  }> = [];

  organizations.forEach((org) => {
    org.libraries.forEach((lib) => {
      accessibleLibraries.push({
        libraryId: lib.libraryId,
        name: lib.name,
        slug: lib.slug,
        orgName: org.organization.name,
        orgId: org.organization.organizationId,
        role: org.role === OrgRole.OWNER ? 'OWNER' : org.role === OrgRole.ADMIN ? 'ADMIN' : 'READER',
        timezone: lib.timezone,
      });
    });
  });

  myLibraries.forEach((myLib) => {
    const existing = accessibleLibraries.find((l) => l.libraryId === myLib.libraryId);
    if (!existing) {
      accessibleLibraries.push({
        libraryId: myLib.libraryId,
        name: myLib.libraryName,
        slug: myLib.librarySlug,
        orgName:
          organizations.find((o) => o.organization.organizationId === myLib.organizationId)?.organization.name ||
          'Library Platform',
        orgId: myLib.organizationId,
        role: myLib.role === 'LIBRARIAN' ? 'LIBRARIAN' : 'READER',
      });
    } else if (myLib.role === 'LIBRARIAN' && existing.role === 'READER') {
      existing.role = 'LIBRARIAN';
    }
  });

  // Effective active branch info
  const enteredLibraryId = isInsideLibrary
    ? (activeLibrary?.libraryId || currentLibrary?.libraryId || (accessibleLibraries[0]?.libraryId ?? null))
    : null;

  const currentBranchName = isReaderOnly
    ? (activeLibrary?.libraryName || accessibleLibraries[0]?.name || 'Library Branch')
    : (currentLibrary?.name || accessibleLibraries[0]?.name || 'Library Branch');

  const currentBranchSlug = isReaderOnly
    ? (activeLibrary?.librarySlug || accessibleLibraries[0]?.slug || '')
    : (currentLibrary?.slug || accessibleLibraries[0]?.slug || '');

  // Calculate user's effective role in the entered library
  let effectiveRole: 'OWNER' | 'ADMIN' | 'LIBRARIAN' | 'READER' = 'READER';
  if (currentRole === OrgRole.OWNER) {
    effectiveRole = 'OWNER';
  } else if (currentRole === OrgRole.ADMIN) {
    effectiveRole = 'ADMIN';
  } else if (activeLibrary?.role === 'LIBRARIAN') {
    effectiveRole = 'LIBRARIAN';
  } else {
    effectiveRole = 'READER';
  }

  const handleEnterLibrary = (libId: string) => {
    selectActiveLibrary(libId);
    setIsInsideLibrary(true);
    localStorage.setItem('is_inside_library', 'true');
    setSelectedBookId(null);
    setActiveTab('catalog');
    setIsMobileOpen(false);
  };

  const handleExitLibrary = () => {
    setIsInsideLibrary(false);
    localStorage.setItem('is_inside_library', 'false');
    setActiveTab('hub-libraries');
    setIsMobileOpen(false);
  };

  const getTabDisplayName = (tab: string) => {
    switch (tab) {
      case 'catalog': return 'Catalog & Search';
      case 'inventory': return 'Copy Inventory';
      case 'circulation': return 'Circulation Desk';
      case 'my-circulation': return 'My Loans & Holds';
      case 'map': return 'Floor Map & Shelves';
      case 'community': return 'Community & Lists';
      case 'analytics': return 'Branch Analytics';
      case 'settings': return 'Branch Settings';
      case 'members': return 'Members & Access';
      case 'overview': return 'Overview';
      case 'directory': return 'Explore Directory';
      case 'org-hub': return 'Organization Hub';
      case 'hub-libraries': return 'My Libraries';
      case 'showcase': return 'Component Showcase';
      default: return tab;
    }
  };

  const libraryWorkspaceTabs = (() => {
    if (effectiveRole === 'READER') {
      return [
        { id: 'catalog', label: 'Catalog & Search', icon: BookOpen, number: '01' },
        { id: 'map', label: 'Floor Map & Shelves', icon: MapPin, number: '02' },
        { id: 'my-circulation', label: 'My Loans & Holds', icon: Clock, number: '03' },
        { id: 'community', label: 'Community & Lists', icon: FolderHeart, number: '04' },
      ];
    }
    if (effectiveRole === 'LIBRARIAN') {
      return [
        { id: 'catalog', label: 'Catalog Management', icon: BookOpen, number: '01' },
        { id: 'inventory', label: 'Copy Inventory', icon: Barcode, number: '02' },
        { id: 'map', label: 'Floor Plans & Spatial Racks', icon: MapPin, number: '03' },
        { id: 'circulation', label: 'Circulation Desk', icon: ArrowRightLeft, number: '04' },
        { id: 'members', label: 'Reader Access Requests', icon: Users, number: '05' },
        { id: 'community', label: 'Community & Collections', icon: FolderHeart, number: '06' },
      ];
    }
    // ADMIN / OWNER
    return [
      { id: 'catalog', label: 'Catalog Management', icon: BookOpen, number: '01' },
      { id: 'inventory', label: 'Copy Inventory', icon: Barcode, number: '02' },
      { id: 'map', label: 'Floor Plans & Spatial Racks', icon: MapPin, number: '03' },
      { id: 'circulation', label: 'Circulation Desk', icon: ArrowRightLeft, number: '04' },
      { id: 'members', label: 'Members & Access', icon: Users, number: '05' },
      { id: 'analytics', label: 'Branch Analytics', icon: BarChart3, number: '06' },
      { id: 'settings', label: 'Branch Settings', icon: Settings, number: '07' },
      { id: 'community', label: 'Community & Collections', icon: FolderHeart, number: '08' },
    ];
  })();

  return (
    <div className="app-container">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 1. SIDEBAR */}
      <aside className={`app-sidebar ${isMobileOpen ? 'open' : ''}`}>
        {isInsideLibrary ? (
          /* INSIDE LIBRARY SIDEBAR */
          <div className="sidebar-animated" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Exit / Back to Libraries Button */}
            <button
              onClick={handleExitLibrary}
              className="back-to-libraries-btn"
              title="Exit this library and return to library hub"
            >
              <ArrowLeft size={15} className="back-arrow-icon" />
              <span>Back to Libraries</span>
            </button>

            {/* Active Branch Banner */}
            <div className="active-library-banner">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Active Branch
                </span>
                <span
                  className={`pill ${
                    effectiveRole === 'OWNER'
                      ? 'green'
                      : effectiveRole === 'ADMIN'
                      ? 'blue'
                      : effectiveRole === 'LIBRARIAN'
                      ? 'purple'
                      : 'yellow'
                  }`}
                  style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}
                >
                  {effectiveRole}
                </span>
              </div>
              <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentBranchName}
              </div>
              {currentBranchSlug && (
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  /{currentBranchSlug}
                </div>
              )}
            </div>

            {/* Nav Menu: Strictly Role-Scoped */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="section-label">Library Workspace</div>
              {libraryWorkspaceTabs.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      if (item.id === 'catalog') setSelectedBookId(null);
                      setIsMobileOpen(false);
                    }}
                    className={`side-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-number">{item.number}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={16} /> {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Sidebar Footer */}
            <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
              <div style={{
                background: 'var(--canvas)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '11px',
                color: 'var(--muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text)' }}>
                  <Database size={13} color="var(--accent)" />
                  <span>Isolated Tenant DB</span>
                </div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Branch: {currentBranchSlug || currentBranchName}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* OUTSIDE LIBRARY (PORTAL / HUB) SIDEBAR */
          <div className="sidebar-animated" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Brand Header */}
            <div className="brand" style={{ position: 'relative' }}>
              <div className="brand-logo">
                <BookOpen size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="brand-title">Library Platform</span>
                <span className="brand-subtitle">Multi-Tenant v2.0</span>
              </div>
              {isMobileOpen && (
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="icon-btn"
                  style={{ width: '32px', height: '32px' }}
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Portal Navigation Items */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="section-label">Portals & Hub</div>

              <button
                onClick={() => { setActiveTab('hub-libraries'); setIsMobileOpen(false); }}
                className={`side-nav-item ${activeTab === 'hub-libraries' ? 'active' : ''}`}
              >
                <span className="nav-number">01</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <Library size={16} /> My Libraries
                </span>
                {accessibleLibraries.length > 0 && (
                  <span className="pill green" style={{ fontSize: '10px', padding: '1px 6px' }}>
                    {accessibleLibraries.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setActiveTab('directory'); setIsMobileOpen(false); }}
                className={`side-nav-item ${activeTab === 'directory' ? 'active' : ''}`}
              >
                <span className="nav-number">02</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={16} /> Explore Directory
                </span>
              </button>

              {canManageLibraries && (
                <button
                  onClick={() => { setActiveTab('org-hub'); setIsMobileOpen(false); }}
                  className={`side-nav-item ${activeTab === 'org-hub' ? 'active' : ''}`}
                >
                  <span className="nav-number">03</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} /> Organization Hub
                  </span>
                </button>
              )}

              <div className="section-label" style={{ marginTop: '10px' }}>Design System</div>
              <button
                onClick={() => { setActiveTab('showcase'); setIsMobileOpen(false); }}
                className={`side-nav-item ${activeTab === 'showcase' ? 'active' : ''}`}
                style={{
                  background: activeTab === 'showcase' ? 'var(--accent)' : 'color-mix(in srgb, var(--accent-soft) 40%, transparent)',
                  color: activeTab === 'showcase' ? '#fff' : 'var(--accent)',
                  fontWeight: 700,
                }}
              >
                <span className="nav-number" style={{ background: activeTab === 'showcase' ? 'rgba(255,255,255,0.2)' : 'var(--accent-soft)', color: activeTab === 'showcase' ? '#fff' : 'var(--accent)' }}>
                  UI
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} /> Component Showcase
                </span>
              </button>
            </nav>

            {/* Sidebar Footer */}
            <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
              <div style={{
                background: 'var(--canvas)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '11px',
                color: 'var(--muted)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text)' }}>
                  <Globe size={13} color="var(--accent)" />
                  <span>Library Portal</span>
                </div>
                <div>
                  {accessibleLibraries.length} enrolled {accessibleLibraries.length === 1 ? 'branch' : 'branches'}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header className="app-topbar">
          <button
            type="button"
            className="icon-btn mobile-menu-btn"
            aria-label="Toggle navigation menu"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
          >
            <Menu size={18} />
          </button>

          {/* Contextual Breadcrumbs & Switcher */}
          {isInsideLibrary ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', flexWrap: 'wrap' }}>
              <button
                onClick={handleExitLibrary}
                className="btn secondary"
                style={{
                  padding: '5px 10px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  borderRadius: '8px',
                }}
                title="Exit to Libraries Hub"
              >
                <ArrowLeft size={13} className="back-arrow-icon" />
                <span>All Libraries</span>
              </button>

              <span style={{ color: 'var(--muted)', opacity: 0.6 }}>/</span>

              {accessibleLibraries.length > 1 ? (
                <select
                  value={enteredLibraryId || ''}
                  onChange={(e) => {
                    if (e.target.value === '__EXIT__') {
                      handleExitLibrary();
                    } else {
                      handleEnterLibrary(e.target.value);
                    }
                  }}
                  className="top-select"
                  style={{ fontWeight: 700, padding: '5px 10px', fontSize: '12px' }}
                >
                  {accessibleLibraries.map((lib) => (
                    <option key={lib.libraryId} value={lib.libraryId}>
                      {lib.name}
                    </option>
                  ))}
                  <option value="__EXIT__">← Exit to Libraries Hub</option>
                </select>
              ) : (
                <strong style={{ color: 'var(--text)', fontSize: '13px' }}>
                  {currentBranchName}
                </strong>
              )}

              <span style={{ color: 'var(--muted)', opacity: 0.6 }}>/</span>
              <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
                {getTabDisplayName(activeTab)}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <Library size={16} color="var(--accent)" />
              <strong style={{ color: 'var(--text)', fontSize: '13px' }}>
                Library Platform Hub
              </strong>
              <span style={{ color: 'var(--muted)', opacity: 0.6 }}>/</span>
              <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
                {getTabDisplayName(activeTab)}
              </span>
            </div>
          )}

          <div className="top-spacer" />

          {/* Role Pill */}
          <span
            className={`pill ${
              effectiveRole === 'OWNER'
                ? 'green'
                : effectiveRole === 'ADMIN'
                ? 'blue'
                : effectiveRole === 'LIBRARIAN'
                ? 'purple'
                : 'yellow'
            }`}
            style={{ fontSize: '11px', fontWeight: 700 }}
          >
            <Shield size={11} style={{ marginRight: '4px' }} />
            {isInsideLibrary ? `${effectiveRole} • ${currentBranchName}` : effectiveRole}
          </span>

          {/* Appearance Settings Trigger */}
          <button
            onClick={() => setShowAppearanceDrawer(true)}
            className="icon-btn"
            title="Customize theme & appearance"
            aria-label="Customize theme & appearance"
          >
            <Palette size={16} />
          </button>

          {/* Notifications Trigger */}
          <button
            onClick={() => setShowNotificationsDrawer(true)}
            className="icon-btn"
            style={{ position: 'relative' }}
            title="View notifications"
            aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  background: 'var(--status-danger-text)',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 800,
                  borderRadius: '10px',
                  padding: '1px 5px',
                  minWidth: '15px',
                  textAlign: 'center',
                  lineHeight: '13px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="icon-btn"
            title="Toggle light/dark theme"
            aria-label="Toggle light/dark theme"
          >
            {theme.darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* User Profile & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="avatar">
              {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ fontSize: '12px' }}>
              <div style={{ fontWeight: 700 }}>{user?.displayName}</div>
              <div style={{ color: 'var(--muted)', fontSize: '11px' }}>{user?.email}</div>
            </div>
            <button
              onClick={() => logout()}
              className="btn"
              style={{ padding: '6px 10px', fontSize: '11px' }}
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="app-content">
          {!isInsideLibrary ? (
            activeTab === 'directory' || (organizations.length === 0 && myLibraries.length === 0) ? (
              <div className="tab-content-enter">
                <LibraryDirectoryScreen
                  onSelectLibrary={(libId) => handleEnterLibrary(libId)}
                  onCreateOrg={() => setShowCreateOrgModal(true)}
                  onJoinInvite={() => setShowAcceptInviteModal(true)}
                />
              </div>
            ) : activeTab === 'showcase' ? (
              <div className="tab-content-enter">
                <ComponentShowcase />
              </div>
            ) : activeTab === 'org-hub' ? (
              <div className="tab-content-enter">
                {/* Organization Hub */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                        Organization Hub
                      </h1>
                      <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
                        Manage organizations, branch provisioning, and staff access permissions for <strong>{currentOrg?.organization.name}</strong>.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="btn secondary"
                        style={{ padding: '8px 14px', fontSize: '12px' }}
                      >
                        <UserPlus size={14} /> Invite Staff
                      </button>
                      <button
                        onClick={() => setShowCreateOrgModal(true)}
                        className="btn secondary"
                        style={{ padding: '8px 14px', fontSize: '12px' }}
                      >
                        <Plus size={14} /> New Org
                      </button>
                      {canManageLibraries && !isLibraryLimitReached && (
                        <button
                          onClick={() => setShowCreateLibraryModal(true)}
                          className="btn primary"
                          style={{ padding: '8px 14px', fontSize: '12px' }}
                        >
                          <Plus size={14} /> Add Branch ({libraryCount}/3)
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '24px',
                    boxShadow: 'var(--shadow)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Building2 size={24} color="var(--accent)" />
                          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{currentOrg?.organization.name}</h2>
                          <span className="pill green" style={{ fontSize: '11px' }}>{currentRole}</span>
                        </div>
                        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                          Slug: <code>{currentOrg?.organization.slug}</code> &bull; Multi-Tenant Database Isolated
                        </p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Branch Quota</div>
                        <div style={{ fontWeight: 800, fontSize: '18px', color: isLibraryLimitReached ? 'var(--warn-text)' : 'var(--text)' }}>
                          {libraryCount} / 3 Branches Used
                        </div>
                      </div>
                    </div>

                    <div className="progress" style={{ marginBottom: '24px' }}>
                      <div
                        className="progress-bar"
                        style={{
                          width: `${(libraryCount / 3) * 100}%`,
                          background: isLibraryLimitReached ? 'var(--warn-text)' : 'var(--accent)',
                        }}
                      />
                    </div>

                    <h4 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                      Branches in this Organization
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {currentOrg?.libraries.map((lib) => (
                        <div
                          key={lib.libraryId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            borderRadius: '12px',
                            background: 'var(--canvas)',
                            border: '1px solid var(--border)',
                            gap: '16px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              background: 'var(--accent-soft)',
                              color: 'var(--accent)',
                              display: 'grid',
                              placeItems: 'center',
                            }}>
                              <Library size={18} />
                            </div>
                            <div>
                              <strong style={{ display: 'block', fontSize: '15px' }}>{lib.name}</strong>
                              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                /{lib.slug} &bull; Timezone: {lib.timezone}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleEnterLibrary(lib.libraryId)}
                            className="library-enter-btn"
                          >
                            <span>Enter Library</span>
                            <ArrowRight size={14} className="arrow-forward-icon" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* My Libraries Portal View */
              <div className="tab-content-enter" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                      My Libraries
                    </h1>
                    <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
                      Welcome back, <strong>{user?.displayName}</strong>. Select a library branch below to enter its workspace, or explore public directories.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setActiveTab('directory')}
                      className="btn secondary"
                      style={{ padding: '8px 14px', fontSize: '12px' }}
                    >
                      <Globe size={14} /> Explore Directory
                    </button>
                    {canManageLibraries && !isLibraryLimitReached && (
                      <button
                        onClick={() => setShowCreateLibraryModal(true)}
                        className="btn primary"
                        style={{ padding: '8px 14px', fontSize: '12px' }}
                      >
                        <Plus size={14} /> Add Library Branch
                      </button>
                    )}
                  </div>
                </div>

                {accessibleLibraries.length === 0 ? (
                  <div className="empty-state" style={{ padding: '48px 24px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'grid',
                      placeItems: 'center',
                      margin: '0 auto 16px auto',
                    }}>
                      <Library size={28} />
                    </div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>No Enrolled Libraries Yet</h3>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', maxWidth: '420px', margin: '0 auto 20px auto' }}>
                      You haven't joined any libraries yet. Browse the public directory to find libraries and request reader access, or join via an invitation token.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      <button
                        onClick={() => setActiveTab('directory')}
                        className="btn primary"
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                      >
                        <Globe size={14} /> Browse Public Directory
                      </button>
                      <button
                        onClick={() => setShowAcceptInviteModal(true)}
                        className="btn secondary"
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                      >
                        <KeyRound size={14} /> Join via Invite Token
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="library-hub-grid">
                    {accessibleLibraries.map((lib, idx) => {
                      const isOwner = lib.role === 'OWNER';
                      const isAdmin = lib.role === 'ADMIN';
                      const isLibrarian = lib.role === 'LIBRARIAN';

                      return (
                        <div
                          key={lib.libraryId}
                          className="library-hub-card"
                          style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                              <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '12px',
                                background: isOwner || isAdmin ? 'var(--accent-soft)' : isLibrarian ? 'color-mix(in srgb, #8b5cf6 15%, var(--surface))' : 'var(--canvas)',
                                color: isOwner || isAdmin ? 'var(--accent)' : isLibrarian ? '#8b5cf6' : 'var(--text)',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 800,
                                fontSize: '18px',
                              }}>
                                <Library size={20} />
                              </div>
                              <span
                                className={`pill ${
                                  isOwner ? 'green' : isAdmin ? 'blue' : isLibrarian ? 'purple' : 'yellow'
                                }`}
                                style={{ fontSize: '11px', fontWeight: 700 }}
                              >
                                <Shield size={11} style={{ marginRight: '4px' }} />
                                {lib.role}
                              </span>
                            </div>

                            <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>
                              {lib.name}
                            </h3>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div><strong>Org:</strong> {lib.orgName}</div>
                              <div><strong>Slug:</strong> /{lib.slug}</div>
                              {lib.timezone && <div><strong>Timezone:</strong> {lib.timezone}</div>}
                            </div>
                          </div>

                          <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--success-text)', fontWeight: 650 }}>
                              <span style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: 'var(--success-text)',
                                display: 'inline-block',
                                animation: 'pulseGlow 2s infinite',
                              }} />
                              Active Database
                            </div>
                            <button
                              onClick={() => handleEnterLibrary(lib.libraryId)}
                              className="library-enter-btn"
                              title={`Enter ${lib.name}`}
                            >
                              <span>Enter Library</span>
                              <ArrowRight size={15} className="arrow-forward-icon" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          ) : (
            /* Inside Library Workspace Tabs */
            <div className="tab-content-enter">
              {activeTab === 'catalog' ? (
            selectedBookId ? (
              <BookDetailsScreen
                bookId={selectedBookId}
                onBack={() => setSelectedBookId(null)}
                onLocateOnMap={(rack) => {
                  setSelectedRackCode(rack);
                  setActiveTab('map');
                }}
              />
            ) : (
              <CatalogScreen
                onSelectBook={(id) => setSelectedBookId(id)}
                onLocateRack={(rack) => {
                  setSelectedRackCode(rack);
                  setActiveTab('map');
                }}
              />
            )
          ) : activeTab === 'inventory' ? (
            <InventoryScreen
              onSelectBook={(id) => {
                setSelectedBookId(id);
                setActiveTab('catalog');
              }}
              onLocateRack={(rack) => {
                setSelectedRackCode(rack);
                setActiveTab('map');
              }}
            />
          ) : activeTab === 'circulation' ? (
            <CirculationDeskScreen />
          ) : activeTab === 'my-circulation' ? (
            <ReaderCirculationScreen
              onBrowseCatalog={() => {
                setSelectedBookId(null);
                setActiveTab('catalog');
              }}
            />
          ) : activeTab === 'community' ? (
            <CommunityScreen
              onSelectBook={(id) => {
                setSelectedBookId(id);
                setActiveTab('catalog');
              }}
            />
          ) : activeTab === 'map' ? (
            <FloorPlanScreen
              initialRackCode={selectedRackCode || 'A'}
              onSelectBook={(id) => {
                setSelectedBookId(id);
                setActiveTab('catalog');
              }}
            />
          ) : activeTab === 'analytics' ? (
            <AnalyticsScreen />
          ) : activeTab === 'settings' ? (
            <BranchSettingsScreen />
          ) : activeTab === 'members' ? (
            <MembersScreen
              initialTab={membersTab}
              navigationNonce={membersNavigationNonce}
              highlightRequestId={highlightRequestId}
              onOpenInviteModal={() => setShowInviteModal(true)}
            />
          ) : (
            <>
              {/* Page Header */}
              <div className="page-head">
                <div style={{ flex: 1 }}>
                  <h1>{activeLibrary ? activeLibrary.libraryName : currentLibrary ? currentLibrary.name : (currentOrg?.organization.name || 'Library Platform')}</h1>
                  <p>
                    {isReaderOnly
                      ? `Enrolled in ${myLibraries.length} ${myLibraries.length === 1 ? 'library' : 'libraries'} • Active Role: ${activeLibrary?.role || 'READER'}`
                      : `${currentOrg?.organization.name} • Timezone: ${currentLibrary?.timezone || 'Asia/Kolkata'} • Status: Active`}
                  </p>
                </div>
                <div className="head-actions">
                  <button
                    onClick={() => setActiveTab('directory')}
                    className="btn"
                  >
                    <Globe size={15} /> Explore Libraries
                  </button>
                  <button
                    onClick={() => setActiveTab('showcase')}
                    className="btn"
                  >
                    <Sparkles size={15} /> Open Component Showcase
                  </button>
                  {canInviteMembers && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="btn"
                    >
                      <UserPlus size={15} /> Invite Member
                    </button>
                  )}
                  {canManageLibraries && !isLibraryLimitReached && (
                    <button
                      onClick={() => setShowCreateLibraryModal(true)}
                      className="btn primary"
                    >
                      <Plus size={15} /> Add Library Branch
                    </button>
                  )}
                </div>
              </div>

              {/* Top KPI Grid */}
              <div className="kpis-grid">
                {isReaderOnly ? (
                  <>
                    <div className="kpi-card">
                      <small>Connected Library</small>
                      <strong style={{ fontSize: '18px', marginTop: '6px' }}>{activeLibrary?.libraryName || 'None'}</strong>
                      <span>Direct reader access</span>
                    </div>
                    <div className="kpi-card">
                      <small>Enrolled Libraries</small>
                      <strong>{myLibraries.length}</strong>
                      <span>Active memberships</span>
                    </div>
                    <div className="kpi-card">
                      <small>Your Reader Role</small>
                      <strong style={{ fontSize: '20px', marginTop: '8px' }}>{activeLibrary?.role || 'READER'}</strong>
                      <span>Borrowing, holds & reviews</span>
                    </div>
                    <div className="kpi-card">
                      <small>Library Currency</small>
                      <strong>₹ (INR)</strong>
                      <span>Simulated ledger active</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="kpi-card">
                      <small>Active Branches</small>
                      <strong>{libraryCount} / 3</strong>
                      <span>{isLibraryLimitReached ? 'Hard 3-library limit reached' : `${3 - libraryCount} branch slots remaining`}</span>
                    </div>
                    <div className="kpi-card">
                      <small>Tenant Database</small>
                      <strong style={{ fontSize: '18px', marginTop: '12px' }}>Isolated</strong>
                      <span>PostgreSQL dynamic partition</span>
                    </div>
                    <div className="kpi-card">
                      <small>Your Role</small>
                      <strong style={{ fontSize: '22px', marginTop: '10px' }}>{currentRole}</strong>
                      <span>{canManageLibraries ? 'Full administration & circulation' : 'Standard reader access'}</span>
                    </div>
                    <div className="kpi-card">
                      <small>Library Currency</small>
                      <strong>₹ (INR)</strong>
                      <span>Configurable per branch</span>
                    </div>
                  </>
                )}
              </div>

              {/* Main Content Card: Branch Overview for Staff or Enrolled Libraries for Readers */}
              {isReaderOnly ? (
                <div className="card" style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 className="card-title" style={{ margin: 0 }}>My Enrolled Libraries</h3>
                      <p className="card-sub" style={{ margin: '4px 0 0' }}>
                        Libraries where your reader membership is active. Switch between branches or request access to new libraries.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('directory')}
                      className="btn secondary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      <Globe size={14} /> Explore Directory
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {myLibraries.map((lib) => {
                      const isActive = lib.libraryId === activeLibrary?.libraryId;
                      return (
                        <div
                          key={lib.libraryId}
                          onClick={() => selectActiveLibrary(lib.libraryId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderRadius: '10px',
                            border: isActive ? '2px solid var(--accent)' : '1px solid var(--border)',
                            background: isActive ? 'var(--accent-soft)' : 'var(--surface)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: isActive ? 'var(--accent)' : 'var(--canvas)',
                              color: isActive ? '#fff' : 'var(--accent)',
                              display: 'grid',
                              placeItems: 'center',
                            }}>
                              <Library size={16} />
                            </div>
                            <div>
                              <strong style={{ fontSize: '13px', display: 'block' }}>{lib.libraryName}</strong>
                              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>{lib.organizationName} &bull; {lib.role}</small>
                            </div>
                          </div>
                          {isActive ? (
                            <span className="pill green">Active</span>
                          ) : (
                            <span className="pill">Select</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid-2" style={{ marginBottom: '24px' }}>
                  <div className="card">
                    <h3 className="card-title">Branch Capacity & Isolation</h3>
                    <p className="card-sub">
                      Each organization supports a maximum of 3 independent library branches. Records, wallets, loans, and settings do not sync across branches.
                    </p>

                    <div style={{
                      background: 'var(--canvas)',
                      borderRadius: '10px',
                      padding: '16px',
                      marginBottom: '16px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                        <span>Branch Limit Progress</span>
                        <span>{libraryCount} of 3 Branches Active</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: 'var(--border)',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${(libraryCount / 3) * 100}%`,
                          height: '100%',
                          background: isLibraryLimitReached ? 'var(--warn-text)' : 'var(--accent)',
                          borderRadius: '999px',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {currentOrg?.libraries.map((lib, idx) => (
                        <div
                          key={lib.libraryId}
                          onClick={() => selectLibrary(lib.libraryId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: lib.libraryId === currentLibrary?.libraryId ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                            background: lib.libraryId === currentLibrary?.libraryId ? 'var(--accent-soft)' : 'var(--surface)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              background: 'var(--canvas)',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: '11px',
                              fontWeight: 800,
                            }}>
                              {idx + 1}
                            </span>
                            <div>
                              <strong style={{ fontSize: '13px', display: 'block' }}>{lib.name}</strong>
                              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>slug: {lib.slug} &bull; {lib.timezone}</small>
                            </div>
                          </div>
                          {lib.libraryId === currentLibrary?.libraryId ? (
                            <span className="pill green">Active</span>
                          ) : (
                            <span className="pill">Select</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="card-title">Tenant Security & Verification</h3>
                    <p className="card-sub">
                      Security policies and role permissions active for this session.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <CheckCircle size={16} color="var(--success-text)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong style={{ fontSize: '12px', display: 'block' }}>Zero Cross-Database Leakage</strong>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            Tenant credentials are never transmitted to the browser. Connection resolved server-side.
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <CheckCircle size={16} color="var(--success-text)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong style={{ fontSize: '12px', display: 'block' }}>Race-Safe Advisory Locks</strong>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            The 3-library limit is enforced by PostgreSQL transaction advisory locks against race conditions.
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <CheckCircle size={16} color="var(--success-text)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong style={{ fontSize: '12px', display: 'block' }}>Deny-by-Default RBAC</strong>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            Protected endpoints reject any user not possessing explicit role authorization.
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="notice-box" style={{ marginTop: '18px' }}>
                      <strong>Modern Design System:</strong> Reusable React tokens, book cards, pills, dialogs, and customizable appearance drawer are fully active.
                    </div>
                  </div>
                </div>
              )}

              {/* Trending Shelf Preview with Modern Book Cards */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Featured Books & Cover Art</h3>
                  <button onClick={() => setActiveTab('showcase')} className="btn sm">
                    View Component Gallery
                  </button>
                </div>
                <div className="grid-2">
                  {SAMPLE_OVERVIEW_BOOKS.slice(0, 2).map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      onExplore={(b) => showToast(`Opening title: ${b.title}`, 'info')}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
        </main>
      </div>

      {/* MODALS & DRAWERS */}
      <CreateOrgModal
        isOpen={showCreateOrgModal}
        onClose={() => setShowCreateOrgModal(false)}
      />

      <CreateLibraryModal
        isOpen={showCreateLibraryModal}
        onClose={() => setShowCreateLibraryModal(false)}
      />

      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      <AcceptInviteModal
        isOpen={showAcceptInviteModal}
        onClose={() => {
          setShowAcceptInviteModal(false);
          setUrlInviteToken('');
        }}
        initialToken={urlInviteToken}
      />

      <AppearanceDrawer
        isOpen={showAppearanceDrawer}
        onClose={() => setShowAppearanceDrawer(false)}
      />

      {/* Notifications Drawer */}
      {showNotificationsDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(0,0,0,0.4)',
          }}
          onClick={() => setShowNotificationsDrawer(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              height: '100%',
              background: 'var(--canvas)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} color="var(--accent)" />
                <span style={{ fontWeight: 700, fontSize: '15px' }}>Notifications</span>
                {unreadCount > 0 && (
                  <span className="pill blue" style={{ fontSize: '10px' }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="btn"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowNotificationsDrawer(false)}
                  className="icon-btn"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--muted)' }}>
                  <Bell size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <div style={{ fontWeight: 600 }}>No notifications yet</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Loan due dates, hold pickup updates, and fines will appear here.
                  </div>
                </div>
              ) : (
                notifications.map((n) => {
                  const isUnread = !n.readAt;
                  return (
                    <div
                      key={n.notificationId}
                      onClick={() => handleNotificationClick(n)}
                      className="notification-item-card"
                      style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: isUnread ? 'var(--accent)' : 'var(--border)',
                        background: isUnread ? 'var(--canvas-subtle)' : 'var(--surface)',
                        cursor: 'pointer',
                        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                        position: 'relative',
                        boxShadow: isUnread ? '0 2px 10px color-mix(in srgb, var(--accent) 14%, transparent)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: isUnread ? 700 : 600,
                            fontSize: '13px',
                            color: isUnread ? 'var(--fg)' : 'var(--text)',
                          }}
                        >
                          {n.title}
                        </div>
                        {isUnread && (
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              display: 'inline-block',
                              marginTop: '4px',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--muted)',
                          marginTop: '4px',
                          lineHeight: 1.4,
                        }}
                      >
                        {n.body}
                      </div>
                      <div
                        style={{
                          fontSize: '10px',
                          color: 'var(--muted)',
                          marginTop: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        <span>
                          {new Date(n.createdAt).toLocaleDateString()}{' '}
                          {new Date(n.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span style={{ fontFamily: 'monospace', textTransform: 'uppercase', opacity: 0.8 }}>
                          {n.eventType}
                        </span>
                      </div>

                      {/* Interactive Action Prompt */}
                      {n.eventType === 'READER_ACCESS_REQUEST_PENDING' && (
                        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                          <span
                            className="pill blue"
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              cursor: 'pointer',
                            }}
                          >
                            Review & Approve <ArrowRight size={11} />
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
