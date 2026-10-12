import React from 'react';
import { Menu, Settings, Bell, Palette } from 'lucide-react';
import { IconButton } from '../ui/Button';

export interface TopNavProps {
  breadcrumb?: string;
  onOpenMobileMenu?: () => void;
  onOpenAppearance?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  roleSelect?: React.ReactNode;
  librarySelect?: React.ReactNode;
  userAvatar?: React.ReactNode;
}

export const TopNav: React.FC<TopNavProps> = ({
  breadcrumb = 'Reader / Discover',
  onOpenMobileMenu,
  onOpenAppearance,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  roleSelect,
  librarySelect,
  userAvatar,
}) => {
  return (
    <header className="app-topbar">
      {/* Mobile Hamburger Menu */}
      <button
        type="button"
        className="icon-btn mobile-menu-btn"
        aria-label="Open navigation menu"
        onClick={onOpenMobileMenu}
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumbs */}
      <div className="breadcrumb" aria-label="Breadcrumb navigation">
        {breadcrumb}
      </div>

      <div className="top-spacer" />

      {/* Dropdowns */}
      {roleSelect}
      {librarySelect}

      {/* Appearance Customizer Trigger */}
      <IconButton
        aria-label="Customize appearance"
        title="Customize UI styles & themes"
        onClick={onOpenAppearance}
      >
        <Palette size={16} />
      </IconButton>

      {/* Notifications Button */}
      <IconButton
        aria-label={`Notifications ${unreadNotificationsCount > 0 ? `(${unreadNotificationsCount} unread)` : ''}`}
        title="Notifications"
        hasBadge={unreadNotificationsCount > 0}
        onClick={onOpenNotifications}
      >
        <Bell size={16} />
      </IconButton>

      {/* User Avatar */}
      {userAvatar || <div className="avatar">N</div>}
    </header>
  );
};
