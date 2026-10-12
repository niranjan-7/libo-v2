import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { DashboardShell } from './components/DashboardShell';
import { ConnectivityBanner } from './components/ConnectivityBanner';
import { BookOpen } from 'lucide-react';

const MainApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--canvas)',
        color: 'var(--text)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'var(--accent)',
            color: '#fff',
            display: 'inline-grid',
            placeItems: 'center',
            marginBottom: '16px',
            animation: 'pulse 1.5s infinite',
          }}>
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

  return (
    <>
      <ConnectivityBanner />
      {isAuthenticated ? <DashboardShell /> : <AuthScreen />}
    </>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};
