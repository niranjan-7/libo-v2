import React from 'react';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  count?: number | string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`tab ${isActive ? 'active' : ''}`}
            type="button"
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  marginLeft: '6px',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '999px',
                  background: isActive ? 'var(--accent)' : 'var(--border)',
                  color: isActive ? '#fff' : 'var(--muted)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export interface TabPanelProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({
  id,
  activeTab,
  children,
  className = '',
}) => {
  if (id !== activeTab) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={className}
    >
      {children}
    </div>
  );
};
