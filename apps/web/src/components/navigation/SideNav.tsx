import React from 'react';
import { BookOpen, X } from 'lucide-react';
import { IconButton } from '../ui/Button';

export interface NavItemDef {
  number: string;
  label: string;
  id: string;
  role?: 'reader' | 'librarian' | 'admin';
  icon?: React.ReactNode;
}

export interface NavGroupDef {
  title: string;
  role: 'reader' | 'librarian' | 'admin';
  items: NavItemDef[];
}

export interface SideNavProps {
  groups: NavGroupDef[];
  activeId: string;
  onSelect: (id: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  brandTitle?: string;
  brandSubtitle?: string;
  footerNotice?: React.ReactNode;
}

export const SideNav: React.FC<SideNavProps> = ({
  groups,
  activeId,
  onSelect,
  isMobileOpen = false,
  onCloseMobile,
  brandTitle = 'Library Platform',
  brandSubtitle = 'Central Library &bull; Multi-tenant',
  footerNotice,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Element */}
      <aside
        className={`app-sidebar ${isMobileOpen ? 'open' : ''}`}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="brand" style={{ position: 'relative' }}>
          <div className="brand-logo">
            <BookOpen size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong className="brand-title">{brandTitle}</strong>
            <small
              className="brand-subtitle"
              dangerouslySetInnerHTML={{ __html: brandSubtitle }}
            />
          </div>
          {isMobileOpen && onCloseMobile && (
            <IconButton
              aria-label="Close navigation menu"
              variant="ghost"
              size="sm"
              onClick={onCloseMobile}
              className="mobile-menu-btn"
            >
              <X size={18} />
            </IconButton>
          )}
        </div>

        {/* Nav Items Grouped */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {groups.map((group) => (
            <div key={group.title}>
              <div className="section-label">{group.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {group.items.map((item) => {
                  const isActive = item.id === activeId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`side-nav-item ${isActive ? 'active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        onSelect(item.id);
                        if (isMobileOpen && onCloseMobile) onCloseMobile();
                      }}
                    >
                      <span className="nav-number">{item.number}</span>
                      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        {footerNotice && (
          <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
            {footerNotice}
          </div>
        )}
      </aside>
    </>
  );
};
