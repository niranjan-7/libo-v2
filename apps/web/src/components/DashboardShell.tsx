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
} from 'lucide-react';
import { CreateOrgModal } from './CreateOrgModal';
import { CreateLibraryModal } from './CreateLibraryModal';
import { InviteMemberModal } from './InviteMemberModal';
import { AppearanceDrawer } from './theme/AppearanceDrawer';
import { ComponentShowcase } from './showcase/ComponentShowcase';
import { BookCard, BookItem } from './ui/BookCard';
import { CatalogScreen } from './catalog/CatalogScreen';
import { BookDetailsScreen } from './catalog/BookDetailsScreen';
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
    selectOrganization,
    selectLibrary,
    logout,
  } = useAuth();

  const { theme, toggleDarkMode } = useTheme();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'catalog' | 'inventory' | 'circulation' | 'my-circulation' | 'community' | 'map' | 'analytics' | 'settings' | 'members' | 'showcase'
  >('overview');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedRackCode, setSelectedRackCode] = useState<string | null>('A');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Modal visibility states
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showCreateLibraryModal, setShowCreateLibraryModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAppearanceDrawer, setShowAppearanceDrawer] = useState(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);

  // Live Notifications
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Check URL parameters for shared deep links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedCollectionId = params.get('collectionId');
    const sharedBookId = params.get('bookId');
    if (sharedCollectionId) {
      setActiveTab('community');
    } else if (sharedBookId) {
      setSelectedBookId(sharedBookId);
      setActiveTab('catalog');
    }
  }, []);

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

  const canManageLibraries = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;
  const canInviteMembers = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;

  const libraryCount = currentOrg?.libraries.length || 0;
  const isLibraryLimitReached = libraryCount >= 3;

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

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div className="section-label">Main Navigation</div>

          <button
            onClick={() => { setActiveTab('overview'); setIsMobileOpen(false); }}
            className={`side-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <span className="nav-number">01</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} /> Overview
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('catalog'); setSelectedBookId(null); setIsMobileOpen(false); }}
            className={`side-nav-item ${activeTab === 'catalog' ? 'active' : ''}`}
          >
            <span className="nav-number">02</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={16} /> Catalog & Search
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('inventory'); setIsMobileOpen(false); }}
            className={`side-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
          >
            <span className="nav-number">03</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Barcode size={16} /> Copy Inventory
            </span>
          </button>

          {canManageLibraries && (
            <button
              onClick={() => { setActiveTab('circulation'); setIsMobileOpen(false); }}
              className={`side-nav-item ${activeTab === 'circulation' ? 'active' : ''}`}
            >
              <span className="nav-number">04</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft size={16} /> Circulation Desk
              </span>
            </button>
          )}

          <button
            onClick={() => { setActiveTab('my-circulation'); setIsMobileOpen(false); }}
            className={`side-nav-item ${activeTab === 'my-circulation' ? 'active' : ''}`}
          >
            <span className="nav-number">{canManageLibraries ? '05' : '04'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} /> My Loans & Holds
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('community'); setIsMobileOpen(false); }}
            className={`side-nav-item ${activeTab === 'community' ? 'active' : ''}`}
          >
            <span className="nav-number">{canManageLibraries ? '06' : '05'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderHeart size={16} /> Community & Collections
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('map'); setIsMobileOpen(false); }}
            className={`side-nav-item ${activeTab === 'map' ? 'active' : ''}`}
          >
            <span className="nav-number">{canManageLibraries ? '07' : '06'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={16} /> Floor Map & Zones
            </span>
          </button>

          {canManageLibraries && (
            <button
              onClick={() => { setActiveTab('analytics'); setIsMobileOpen(false); }}
              className={`side-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            >
              <span className="nav-number">08</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={16} /> Analytics & Reports
              </span>
            </button>
          )}

          {canManageLibraries && (
            <button
              onClick={() => { setActiveTab('members'); setIsMobileOpen(false); }}
              className={`side-nav-item ${activeTab === 'members' ? 'active' : ''}`}
            >
              <span className="nav-number">09</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} /> Members & Invites
              </span>
            </button>
          )}

          {canManageLibraries && (
            <button
              onClick={() => { setActiveTab('settings'); setIsMobileOpen(false); }}
              className={`side-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            >
              <span className="nav-number">10</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={16} /> Branch Settings
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

        {/* Sidebar Footer: Tenant Database Isolation Badge */}
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
              <Database size={14} color="var(--accent)" />
              <span>Tenant DB Isolated</span>
            </div>
            <div>
              {currentOrg ? `Connected to ${currentOrg.organization.slug}` : 'No active tenant'}
            </div>
          </div>
        </div>
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

          {/* Organization Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} color="var(--muted)" />
            {organizations.length > 0 ? (
              <select
                value={currentOrg?.organization.organizationId || ''}
                onChange={(e) => {
                  if (e.target.value === '__NEW__') {
                    setShowCreateOrgModal(true);
                  } else {
                    selectOrganization(e.target.value);
                  }
                }}
                className="top-select"
              >
                {organizations.map((org) => (
                  <option key={org.organization.organizationId} value={org.organization.organizationId}>
                    {org.organization.name}
                  </option>
                ))}
                <option value="__NEW__">+ New Organization...</option>
              </select>
            ) : (
              <button
                onClick={() => setShowCreateOrgModal(true)}
                className="btn primary"
                style={{ padding: '6px 12px', fontSize: '11px' }}
              >
                <Plus size={14} /> Create Organization
              </button>
            )}
          </div>

          {/* Library Branch Selector (max 3) */}
          {currentOrg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
              <Library size={16} color="var(--muted)" />
              {currentOrg.libraries.length > 0 ? (
                <select
                  value={currentLibrary?.libraryId || ''}
                  onChange={(e) => {
                    if (e.target.value === '__NEW_LIB__') {
                      setShowCreateLibraryModal(true);
                    } else {
                      selectLibrary(e.target.value);
                    }
                  }}
                  className="top-select"
                >
                  {currentOrg.libraries.map((lib) => (
                    <option key={lib.libraryId} value={lib.libraryId}>
                      {lib.name}
                    </option>
                  ))}
                  {canManageLibraries && !isLibraryLimitReached && (
                    <option value="__NEW_LIB__">+ Add Branch ({libraryCount}/3)...</option>
                  )}
                </select>
              ) : (
                <button
                  onClick={() => setShowCreateLibraryModal(true)}
                  className="btn"
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                >
                  <Plus size={14} /> Add First Branch
                </button>
              )}
            </div>
          )}

          <div className="top-spacer" />

          {/* Role Pill */}
          {currentRole && (
            <span
              className={`pill ${
                currentRole === OrgRole.OWNER
                  ? 'green'
                  : currentRole === OrgRole.ADMIN
                  ? 'blue'
                  : 'yellow'
              }`}
            >
              <Shield size={12} />
              {currentRole}
            </span>
          )}

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
          {activeTab === 'showcase' ? (
            <ComponentShowcase />
          ) : organizations.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '600px', margin: '40px auto' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '18px',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'inline-grid',
                placeItems: 'center',
                marginBottom: '20px',
              }}>
                <Building2 size={32} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px' }}>
                Welcome to Library Platform
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 24px' }}>
                Your account is ready. Create your organization to auto-provision an isolated PostgreSQL tenant database and your first independent library branch.
              </p>
              <button
                onClick={() => setShowCreateOrgModal(true)}
                className="btn primary"
                style={{ padding: '12px 24px', fontSize: '13px' }}
              >
                <Plus size={16} /> Create Organization Now
              </button>
            </div>
          ) : activeTab === 'catalog' ? (
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
            <MembersScreen onOpenInviteModal={() => setShowInviteModal(true)} />
          ) : (
            <>
              {/* Page Header */}
              <div className="page-head">
                <div style={{ flex: 1 }}>
                  <h1>{currentLibrary ? currentLibrary.name : currentOrg?.organization.name}</h1>
                  <p>
                    {currentOrg?.organization.name} &bull; Timezone: {currentLibrary?.timezone || 'Asia/Kolkata'} &bull; Status: Active
                  </p>
                </div>
                <div className="head-actions">
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
              </div>

              {/* Main Content Card: Branch Overview & Capacity Indicator */}
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
                      onClick={() => isUnread && handleMarkAsRead(n.notificationId)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: isUnread ? 'var(--accent)' : 'var(--border)',
                        background: isUnread ? 'var(--canvas-subtle)' : 'var(--canvas)',
                        cursor: isUnread ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                        position: 'relative',
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
                            color: isUnread ? 'var(--fg)' : 'var(--muted)',
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
