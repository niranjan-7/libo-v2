import React, { useEffect, useState } from 'react';
import { HealthResponse } from '@library/contracts';

export const ConnectivityBanner: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

  const checkConnectivity = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: HealthResponse = await res.json();
      setHealth(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err?.message || 'Failed to reach API gateway');
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnectivity();
  }, []);

  return (
    <section className="card" style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="card-title" style={{ margin: 0, fontSize: '18px' }}>
              System Scaffold Connectivity
            </h2>
            {loading ? (
              <span className="pill yellow">● Checking...</span>
            ) : error ? (
              <span className="pill red">● Offline</span>
            ) : health?.status === 'ok' ? (
              <span className="pill green">● Operational</span>
            ) : (
              <span className="pill yellow">● Degraded</span>
            )}
          </div>
          <p className="card-sub" style={{ marginTop: '4px' }}>
            Real-time frontend-to-API and Control-Plane database connectivity probe.
          </p>
        </div>

        <button className="btn primary" onClick={checkConnectivity} disabled={loading}>
          {loading ? 'Pinging...' : '⟳ Refresh Status'}
        </button>
      </div>

      <div className="kpis-grid" style={{ margin: '14px 0' }}>
        <div className="kpi-card">
          <small>API GATEWAY</small>
          <strong style={{ fontSize: '22px' }}>
            {loading ? '...' : error ? 'Offline' : 'Connected'}
          </strong>
          <span>Endpoint: /api/v1/health</span>
        </div>

        <div className="kpi-card">
          <small>CONTROL PLANE DB</small>
          <strong style={{ fontSize: '22px' }}>
            {loading ? '...' : health?.database.controlPlane === 'connected' ? 'Connected' : 'Disconnected'}
          </strong>
          <span>
            {health?.database.latencyMs !== undefined
              ? `Latency: ${health.database.latencyMs}ms`
              : error || health?.database.message || 'No connection'}
          </span>
        </div>

        <div className="kpi-card">
          <small>ENVIRONMENT</small>
          <strong style={{ fontSize: '22px', textTransform: 'capitalize' }}>
            {health?.environment || 'Development'}
          </strong>
          <span>Node.js / TypeORM</span>
        </div>

        <div className="kpi-card">
          <small>UPTIME</small>
          <strong style={{ fontSize: '22px' }}>
            {health?.uptime !== undefined ? `${Math.floor(health.uptime)}s` : '—'}
          </strong>
          <span>Last probe: {lastChecked || 'Pending'}</span>
        </div>
      </div>

      {error && (
        <div className="notice-box" style={{ background: 'var(--danger)', color: 'var(--danger-text)', borderColor: '#f1d4d1' }}>
          <strong>Connection Failure:</strong> {error}. Ensure the NestJS API is running (`npm run dev:api`).
        </div>
      )}
    </section>
  );
};
