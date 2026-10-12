import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './theme/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import { AuthScreen } from './components/AuthScreen';
import { DashboardShell } from './components/DashboardShell';
import { ConnectivityBanner } from './components/ConnectivityBanner';
import { ComponentShowcase } from './components/showcase/ComponentShowcase';
import { BookOpen, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from './components/ui/Button';

const MainApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [showStandaloneShowcase, setShowStandaloneShowcase] = useState(false);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--canvas)',
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'var(--accent)',
              color: '#fff',
              display: 'inline-grid',
              placeItems: 'center',
              marginBottom: '16px',
            }}
          >
            <BookOpen size={24} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>
            Connecting to Library Platform...
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Resolving tenant session & control-plane state
          </div>
        </div>
      </div>
    );
  }

  // Standalone Design System & Component Showcase Mode
  if (showStandaloneShowcase) {
    return (
      <div>
        <div
          style={{
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pill green">UI Audit Mode</span>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Inspecting recreated React components & design tokens
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowStandaloneShowcase(false)}
            iconLeft={<ArrowLeft size={13} />}
          >
            Return to Application
          </Button>
        </div>
        <ComponentShowcase />
      </div>
    );
  }

  return (
    <>
      <ConnectivityBanner />
      {isAuthenticated ? (
        <DashboardShell />
      ) : (
        <AuthScreen onOpenShowcase={() => setShowStandaloneShowcase(true)} />
      )}
    </>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};
