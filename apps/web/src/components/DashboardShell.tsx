import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { OrgRole } from '@library/contracts';
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
  ArrowRight,
  Clock,
} from 'lucide-react';
import { CreateOrgModal } from './CreateOrgModal';
import { CreateLibraryModal } from './CreateLibraryModal';
import { InviteMemberModal } from './InviteMemberModal';

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

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'catalog' | 'circulation' | 'map' | 'analytics' | 'settings' | 'members'>('overview');

  // Modal visibility states
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showCreateLibraryModal, setShowCreateLibraryModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Sync dark mode class on body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  const canManageLibraries = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;
  const canInviteMembers = currentRole === OrgRole.OWNER || currentRole === OrgRole.ADMIN;

  const libraryCount = currentOrg?.libraries.length || 0;
  const isLibraryLimitReached = libraryCount >= 3;

  return (
    <div className="app-container">
      {/* 1. SIDEBAR */}
      <aside className="app-sidebar">
        <div className="brand">
          <div className="brand-logo">
            <BookOpen size={20} />
          </div>
          <div>
            <span className="brand-title">Library Platform</span>
            <span className="brand-subtitle">Multi-Tenant v2.0</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`btn ${activeTab === 'overview' ? 'primary' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
          >
            <Layers size={16} /> Overview
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`btn ${activeTab === 'catalog' ? 'primary' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
          >
            <BookOpen size={16} /> Catalog & Search
          </button>

          {canManageLibraries && (
            <button
              onClick={() => setActiveTab('circulation')}
              className={`btn ${activeTab === 'circulation' ? 'primary' : ''}`}
              style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
            >
              <Clock size={16} /> Circulation Desk
            </button>
          )}

          <button
            onClick={() => setActiveTab('map')}
            className={`btn ${activeTab === 'map' ? 'primary' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
          >
            <MapPin size={16} /> Floor Map & Zones
          </button>

          {canManageLibraries && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`btn ${activeTab === 'analytics' ? 'primary' : ''}`}
              style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
            >
              <BarChart3 size={16} /> Analytics & Reports
            </button>
          )}

          {canManageLibraries && (
            <button
              onClick={() => setActiveTab('members')}
              className={`btn ${activeTab === 'members' ? 'primary' : ''}`}
              style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
            >
              <Users size={16} /> Members & Invites
            </button>
          )}

          {canManageLibraries && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`btn ${activeTab === 'settings' ? 'primary' : ''}`}
              style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
            >
              <Settings size={16} /> Branch Settings
            </button>
          )}
        </nav>

        {/* Sidebar Footer: Tenant Database Isolation Badge */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '20px',
        }}>
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
                style={{
                  background: 'var(--canvas)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  padding: '6px 10px',
                  borderRadius: '9px',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
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
                  style={{
                    background: 'var(--canvas)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    padding: '6px 10px',
                    borderRadius: '9px',
                    fontWeight: 700,
                    fontSize: '12px',
                  }}
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

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="btn"
            style={{ padding: '8px', borderRadius: '50%' }}
            title="Toggle theme"
          >
            {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
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
          {/* Empty State if No Organizations */}
          {organizations.length === 0 ? (
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
                <div style={{ display: 'flex', gap: '10px' }}>
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

                  <div className="notice-box">
                    <strong>Milestone Status:</strong> Vertical Slice Complete. Auth, Organization Onboarding, Dynamic Tenant DB Provisioning, Library Branch Management (with 3-branch limit), and Member Invitations are operational.
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* MODALS */}
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
    </div>
  );
};
