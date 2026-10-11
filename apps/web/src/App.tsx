import React from 'react';
import { ConnectivityBanner } from './components/ConnectivityBanner';

export const App: React.FC = () => {
  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="brand">
          <div className="brand-logo">L</div>
          <div>
            <strong className="brand-title">Library Platform</strong>
            <small className="brand-subtitle">Central Control · Scaffold</small>
          </div>
        </div>

        <div style={{ padding: '8px 4px', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
          Scaffold Modules
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
          <div style={{ padding: '9px 12px', background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: '10px', fontWeight: 700, fontSize: '12px' }}>
            ● System Health & Connectivity
          </div>
          <div style={{ padding: '9px 12px', color: 'var(--muted)', fontSize: '12px' }}>
            ○ Control-Plane Migrations
          </div>
          <div style={{ padding: '9px 12px', color: 'var(--muted)', fontSize: '12px' }}>
            ○ Dynamic Tenant Pools
          </div>
          <div style={{ padding: '9px 12px', color: 'var(--muted)', fontSize: '12px' }}>
            ○ Interactive Prototype Reference
          </div>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--muted)' }}>
          <strong>Architecture Stage:</strong> Scaffold<br />
          PostgreSQL Control Plane + Isolated Tenant DBs
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ minWidth: 0 }}>
        <header className="app-topbar">
          <div className="breadcrumb">Scaffold / System Health Verification</div>
          <div className="top-spacer" />
          <div className="pill green">PostgreSQL 16 Multi-Tenant</div>
          <div className="avatar">N</div>
        </header>

        <main className="app-content">
          <div className="page-head">
            <div>
              <h1>Library Platform Scaffold</h1>
              <p>
                Core monorepo foundation, environment validation, TypeORM control-plane migrations, and dynamic tenant connection engine.
              </p>
            </div>
          </div>

          {/* Real-time Health & Probe */}
          <ConnectivityBanner />

          {/* Scaffold Status Overview */}
          <div className="grid-2">
            <div className="card">
              <h3 className="card-title">Backend Architecture Checklist</h3>
              <p className="card-sub">Approved architecture decisions implemented in @library/api</p>

              <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '13px', lineHeight: '1.8' }}>
                <li><strong>NestJS 10 Framework:</strong> Modular architecture with validation pipes & CORS allowlist.</li>
                <li><strong>TypeORM Unified Persistence:</strong> Programmatic DataSource management with zero schema auto-sync.</li>
                <li><strong>Control-Plane Migration:</strong> Initial schema (users, orgs, memberships, invitations, registry, audit logs).</li>
                <li><strong>Dynamic Tenant Pool:</strong> LRU cached connection pools with 10-minute idle eviction.</li>
                <li><strong>Environment Validation:</strong> Type-safe configuration verified via class-validator.</li>
              </ul>
            </div>

            <div className="card">
              <h3 className="card-title">Frontend Architecture Checklist</h3>
              <p className="card-sub">Visual standards matching library_platform_interactive_prototype_v2.html</p>

              <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '13px', lineHeight: '1.8' }}>
                <li><strong>Design Tokens Extracted:</strong> Forest green primary (#235640), warm surfaces, dark mode support.</li>
                <li><strong>Shared Contracts:</strong> Types, DTOs, and enums imported directly from @library/contracts.</li>
                <li><strong>Vite 6 Fast Bundler:</strong> Optimized TypeScript build with API reverse proxy.</li>
                <li><strong>Interactive Reference Preserved:</strong> 30 prototype screens ready for component extraction.</li>
                <li><strong>Real-time Probe:</strong> Live health check monitoring backend latency and database readiness.</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
