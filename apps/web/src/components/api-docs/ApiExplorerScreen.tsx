import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Code2,
  ExternalLink,
  Search,
  Send,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
  Terminal,
  Zap,
  Globe,
  Database,
  RefreshCw,
  Download,
  AlertCircle,
  FileCode2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useToast } from '../ui/Toast';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiParam {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type: string;
  description: string;
  default?: string;
}

export interface ApiEndpoint {
  id: string;
  tag: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  requiresAuth: boolean;
  requiresStaff?: boolean;
  params: ApiParam[];
  requestBodyExample?: Record<string, any> | null;
  responseExample?: Record<string, any> | null;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  // ==========================================
  // AUTH
  // ==========================================
  {
    id: 'auth-register',
    tag: 'Auth',
    method: 'POST',
    path: '/api/v1/auth/register',
    summary: 'Register new user account',
    description: 'Registers a new user and sets the HttpOnly authentication session cookie.',
    requiresAuth: false,
    params: [],
    requestBodyExample: {
      email: 'alex.librarian@library.org',
      password: 'SecurePassword123!',
      fullName: 'Alex Vance',
      preferredRole: 'LIBRARIAN',
    },
    responseExample: {
      user: {
        userId: 'usr_78912',
        email: 'alex.librarian@library.org',
        fullName: 'Alex Vance',
      },
      token: 'jwt_mock_token_string',
    },
  },
  {
    id: 'auth-login',
    tag: 'Auth',
    method: 'POST',
    path: '/api/v1/auth/login',
    summary: 'Authenticate and establish session',
    description: 'Validates email and password, returning JWT token and setting session cookie.',
    requiresAuth: false,
    params: [],
    requestBodyExample: {
      email: 'admin@library.org',
      password: 'Password123!',
    },
    responseExample: {
      user: {
        userId: 'usr_admin_1',
        email: 'admin@library.org',
        fullName: 'System Administrator',
      },
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  },
  {
    id: 'auth-me',
    tag: 'Auth',
    method: 'GET',
    path: '/api/v1/auth/me',
    summary: 'Get active authenticated user profile',
    description: 'Retrieves account profile and permissions for currently authenticated token.',
    requiresAuth: true,
    params: [],
    responseExample: {
      user: {
        userId: 'usr_admin_1',
        email: 'admin@library.org',
        fullName: 'System Administrator',
        roles: ['OWNER'],
      },
    },
  },
  {
    id: 'auth-logout',
    tag: 'Auth',
    method: 'POST',
    path: '/api/v1/auth/logout',
    summary: 'Invalidate session & clear cookie',
    description: 'Clears the authentication cookie and ends active session.',
    requiresAuth: true,
    params: [],
    responseExample: {
      success: true,
      message: 'Logged out successfully',
    },
  },

  // ==========================================
  // ORGANIZATIONS & TENANTS
  // ==========================================
  {
    id: 'org-list',
    tag: 'Organizations',
    method: 'GET',
    path: '/api/v1/organizations',
    summary: 'List user organizations',
    description: 'Returns all organizations the current authenticated user belongs to.',
    requiresAuth: true,
    params: [],
  },
  {
    id: 'org-create',
    tag: 'Organizations',
    method: 'POST',
    path: '/api/v1/organizations',
    summary: 'Create tenant organization',
    description: 'Provisions a new tenant organization with isolated database and initial OWNER membership.',
    requiresAuth: true,
    params: [],
    requestBodyExample: {
      name: 'Metropolitan Library System',
      slug: 'metro-lib',
    },
  },
  {
    id: 'org-details',
    tag: 'Organizations',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}',
    summary: 'Get organization details & libraries',
    description: 'Returns organization metadata, branches, and member statistics.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
    ],
  },
  {
    id: 'org-create-library',
    tag: 'Organizations',
    method: 'POST',
    path: '/api/v1/organizations/{orgId}/libraries',
    summary: 'Create new library branch',
    description: 'Registers a new library branch under the organization.',
    requiresAuth: true,
    requiresStaff: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
    ],
    requestBodyExample: {
      name: 'North Downtown Branch',
      slug: 'north-downtown',
      address: '450 Civic Center Plaza',
    },
  },
  {
    id: 'org-invite-member',
    tag: 'Organizations',
    method: 'POST',
    path: '/api/v1/organizations/{orgId}/invitations',
    summary: 'Invite staff or reader member',
    description: 'Generates an invitation token for a new staff or reader member.',
    requiresAuth: true,
    requiresStaff: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
    ],
    requestBodyExample: {
      email: 'colleague@university.edu',
      role: 'LIBRARIAN',
      libraryId: '',
    },
  },
  {
    id: 'org-get-members',
    tag: 'Organizations',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/members',
    summary: 'List organization members',
    description: 'Retrieves all members, roles, and assigned branch scopes in the organization.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
    ],
  },
  {
    id: 'org-update-member-access',
    tag: 'Organizations',
    method: 'PATCH',
    path: '/api/v1/organizations/{orgId}/members/{targetUserId}',
    summary: 'Update member role and access',
    description: 'Promotes/demotes user role (OWNER, ADMIN, LIBRARIAN, READER) and updates library permissions.',
    requiresAuth: true,
    requiresStaff: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'targetUserId', in: 'path', required: true, type: 'string', description: 'Target Member User UUID' },
    ],
    requestBodyExample: {
      role: 'ADMIN',
    },
  },

  // ==========================================
  // LIBRARIES & DIRECTORY
  // ==========================================
  {
    id: 'libraries-directory',
    tag: 'Libraries',
    method: 'GET',
    path: '/api/v1/libraries/directory',
    summary: 'Global discovery library directory',
    description: 'Public or authenticated discovery of all available library branches across the platform.',
    requiresAuth: false,
    params: [],
  },
  {
    id: 'libraries-me',
    tag: 'Libraries',
    method: 'GET',
    path: '/api/v1/libraries/me',
    summary: 'Get current user library memberships',
    description: 'Returns all libraries the user has active membership or access to.',
    requiresAuth: true,
    params: [],
  },
  {
    id: 'libraries-request-access',
    tag: 'Libraries',
    method: 'POST',
    path: '/api/v1/libraries/{libraryId}/access-requests',
    summary: 'Submit reader membership request',
    description: 'Submits an access request to join a library branch.',
    requiresAuth: true,
    params: [
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
    requestBodyExample: {
      note: 'PhD researcher looking to borrow physics texts.',
    },
  },
  {
    id: 'libraries-staff-get-requests',
    tag: 'Libraries',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/access-requests',
    summary: 'Staff list reader access requests',
    description: 'Lists all pending, approved, or rejected reader access requests for a branch.',
    requiresAuth: true,
    requiresStaff: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
  },
  {
    id: 'libraries-staff-approve-request',
    tag: 'Libraries',
    method: 'POST',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/access-requests/{requestId}/approve',
    summary: 'Staff approve reader access request',
    description: 'Approves request and provisions reader membership in the tenant database.',
    requiresAuth: true,
    requiresStaff: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
      { name: 'requestId', in: 'path', required: true, type: 'string', description: 'Access Request UUID' },
    ],
  },

  // ==========================================
  // CATALOG & INVENTORY
  // ==========================================
  {
    id: 'catalog-search',
    tag: 'Catalog',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/catalog',
    summary: 'Search & filter book catalog',
    description: 'Searches catalog by query string, genre, category, author, availability, or shelf location.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
      { name: 'q', in: 'query', required: false, type: 'string', description: 'Search keywords' },
      { name: 'limit', in: 'query', required: false, type: 'number', description: 'Page size limit (default 20)' },
    ],
  },
  {
    id: 'catalog-book-details',
    tag: 'Catalog',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/catalog/{bookId}',
    summary: 'Get book work details & editions',
    description: 'Returns metadata, authors, editions, and copy inventory for a specific book work.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
      { name: 'bookId', in: 'path', required: true, type: 'string', description: 'Book Work UUID' },
    ],
  },
  {
    id: 'catalog-inventory',
    tag: 'Catalog',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/inventory',
    summary: 'Query copy inventory & KPI summary',
    description: 'Returns barcode-level physical inventory with condition, status, and shelf location.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
      { name: 'status', in: 'query', required: false, type: 'string', description: 'AVAILABLE, LOANED, RESERVED, MAINTENANCE' },
    ],
  },
  {
    id: 'catalog-create-copy',
    tag: 'Catalog',
    method: 'POST',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/inventory',
    summary: 'Add physical book copy (Barcode)',
    description: 'Registers a new physical copy with barcode and assigns it to a shelf location.',
    requiresAuth: true,
    requiresStaff: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
    requestBodyExample: {
      editionId: 'ed_12345',
      barcode: 'BC-9908123',
      condition: 'NEW',
      shelfLocationId: 'loc_shelf_1',
    },
  },

  // ==========================================
  // CIRCULATION & LOANS
  // ==========================================
  {
    id: 'circulation-checkout',
    tag: 'Circulation',
    method: 'POST',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/circulation/checkout',
    summary: 'Desk checkout physical copy',
    description: 'Staff issues a book loan to a reader by copy barcode and reader ID.',
    requiresAuth: true,
    requiresStaff: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
    requestBodyExample: {
      readerUserId: 'usr_reader_10',
      copyBarcode: 'BC-8891002',
    },
  },
  {
    id: 'circulation-return',
    tag: 'Circulation',
    method: 'POST',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/circulation/return',
    summary: 'Return copy & check next hold',
    description: 'Processes book return, assesses condition, recalculates fines if overdue, and alerts hold queue.',
    requiresAuth: true,
    requiresStaff: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
    requestBodyExample: {
      copyBarcode: 'BC-8891002',
      condition: 'GOOD',
    },
  },
  {
    id: 'circulation-reserve',
    tag: 'Circulation',
    method: 'POST',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/circulation/reservations',
    summary: 'Place hold / reservation',
    description: 'Places reader in queue for next available physical copy of an edition.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
    requestBodyExample: {
      editionId: 'ed_12345',
    },
  },
  {
    id: 'circulation-loans',
    tag: 'Circulation',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/circulation/loans',
    summary: 'Query active & historical loans',
    description: 'Filter loans by status (ACTIVE, RETURNED, OVERDUE) and reader ID.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
      { name: 'status', in: 'query', required: false, type: 'string', description: 'ACTIVE, RETURNED, OVERDUE' },
    ],
  },
  {
    id: 'circulation-stats',
    tag: 'Circulation',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/circulation/stats',
    summary: 'Circulation desk KPI metrics',
    description: 'Returns real-time counts of active loans, holds, overdue items, and returns.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
  },
  {
    id: 'circulation-my-loans',
    tag: 'Circulation',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/circulation/my-circulation',
    summary: 'Reader active loans & reservations',
    description: 'Returns reader personal active borrowings, due dates, renewal counts, and hold statuses.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
  },

  // ==========================================
  // FLOOR PLANS & HEATMAP
  // ==========================================
  {
    id: 'floors-list',
    tag: 'Floor Plans',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/floors',
    summary: 'List library floor levels',
    description: 'Retrieves all floor plan levels configured for this library branch.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
  },
  {
    id: 'floors-published',
    tag: 'Floor Plans',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/floors/{floorId}/published',
    summary: 'Get published 2D floor plan map',
    description: 'Returns published SVG/canvas visual layout, walls, doors, desks, and rack coordinates.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
      { name: 'floorId', in: 'path', required: true, type: 'string', description: 'Floor UUID' },
    ],
  },
  {
    id: 'floors-heatmap',
    tag: 'Floor Plans',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/floors/{floorId}/heatmap',
    summary: 'Visual Circulation Heatmap Overlay',
    description: 'Aggregates checkouts per physical rack location with heat scores (0.0 - 1.0), turnover velocity, and top genres.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
      { name: 'floorId', in: 'path', required: true, type: 'string', description: 'Floor UUID' },
      { name: 'timeRange', in: 'query', required: false, type: 'string', description: '30d, 90d, or all' },
    ],
  },
  {
    id: 'floors-draft-studio',
    tag: 'Floor Plans',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/floors/{floorId}/draft',
    summary: 'Get or create floor plan draft',
    description: 'Staff editor endpoint to retrieve working draft version for 2D floor plan editor.',
    requiresAuth: true,
    requiresStaff: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
      { name: 'floorId', in: 'path', required: true, type: 'string', description: 'Floor UUID' },
    ],
  },

  // ==========================================
  // DIGITAL WALLET & FINES
  // ==========================================
  {
    id: 'wallet-me',
    tag: 'Wallet',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/wallets/me',
    summary: 'Get reader wallet balance',
    description: 'Returns the current digital wallet balance and currency code for authenticated reader.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
  },
  {
    id: 'wallet-top-up',
    tag: 'Wallet',
    method: 'POST',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/wallets/me/top-up',
    summary: 'Simulate instant wallet balance top-up',
    description: 'Credits digital wallet with funds using simulated payment.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
    requestBodyExample: {
      amount: 25.0,
      idempotencyKey: 'idem_98716245',
    },
  },
  {
    id: 'fines-list',
    tag: 'Fines',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/fines',
    summary: 'Query fines & total liability',
    description: 'Lists fines with status (OUTSTANDING, PAID, WAIVED) and calculates aggregate unpaid amount.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
      { name: 'status', in: 'query', required: false, type: 'string', description: 'OUTSTANDING, PAID, WAIVED' },
    ],
  },
  {
    id: 'fines-pay',
    tag: 'Fines',
    method: 'POST',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/fines/{fineId}/pay',
    summary: 'Settle fine using wallet balance',
    description: 'Debits reader digital wallet balance and marks fine as PAID with audit ledger entry.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
      { name: 'fineId', in: 'path', required: true, type: 'string', description: 'Fine UUID' },
    ],
    requestBodyExample: {
      amount: 4.5,
    },
  },

  // ==========================================
  // COMMUNITY & REVIEWS
  // ==========================================
  {
    id: 'community-policy',
    tag: 'Community',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/community/policy',
    summary: 'Get community review policy',
    description: 'Returns branch configuration for ratings, comments, and spoiler moderation policies.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
    ],
  },
  {
    id: 'community-book-reviews',
    tag: 'Community',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/community/reviews/book/{bookId}',
    summary: 'Get community reviews for a book',
    description: 'Returns reader ratings, reviews, helpful votes, and comments for a book work.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'bookId', in: 'path', required: true, type: 'string', description: 'Book Work UUID' },
    ],
  },
  {
    id: 'community-create-review',
    tag: 'Community',
    method: 'POST',
    path: '/api/v1/organizations/{orgId}/community/reviews',
    summary: 'Post book review and rating',
    description: 'Submits a 1-5 star review with optional spoiler flag.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
    ],
    requestBodyExample: {
      bookId: 'bk_physics_101',
      rating: 5,
      content: 'Extraordinarily lucid explanation of theoretical physics principles.',
      hasSpoilers: false,
    },
  },

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  {
    id: 'notifications-list',
    tag: 'Notifications',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/notifications',
    summary: 'Get user notifications inbox',
    description: 'Retrieves unread and read alerts for holds ready for pickup, due dates, fines, and approvals.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
  },
  {
    id: 'notifications-read-all',
    tag: 'Notifications',
    method: 'POST',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/notifications/read-all',
    summary: 'Mark all notifications as read',
    description: 'Clears unread notification counters for the user.',
    requiresAuth: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
    ],
  },

  // ==========================================
  // AUDIT LOGS
  // ==========================================
  {
    id: 'audit-logs',
    tag: 'Audit',
    method: 'GET',
    path: '/api/v1/organizations/{orgId}/libraries/{libraryId}/audit-logs',
    summary: 'Immutable audit log query',
    description: 'Staff inspects chronological audit logs for security, circulation events, fine waives, and membership edits.',
    requiresAuth: true,
    requiresStaff: true,
    params: [
      { name: 'orgId', in: 'path', required: true, type: 'string', description: 'Organization UUID' },
      { name: 'libraryId', in: 'path', required: true, type: 'string', description: 'Library Branch UUID' },
      { name: 'action', in: 'query', required: false, type: 'string', description: 'CHECKOUT, RETURN, FINE_WAIVED, etc.' },
    ],
  },

  // ==========================================
  // HEALTH & TELEMETRY
  // ==========================================
  {
    id: 'health-check',
    tag: 'Health',
    method: 'GET',
    path: '/api/v1/health',
    summary: 'System health & DB connectivity',
    description: 'Returns service uptime, environment, and PostgreSQL control plane connection status.',
    requiresAuth: false,
    params: [],
    responseExample: {
      status: 'ok',
      timestamp: '2026-10-17T00:00:00.000Z',
      uptime: 42.5,
      environment: 'development',
      version: '0.1.0',
      database: {
        controlPlane: 'connected',
        latencyMs: 1,
      },
    },
  },
  {
    id: 'health-ready',
    tag: 'Health',
    method: 'GET',
    path: '/api/v1/health/ready',
    summary: 'Kubernetes readiness probe',
    description: 'Returns 200 OK if service is ready to accept HTTP traffic.',
    requiresAuth: false,
    params: [],
  },
  {
    id: 'health-live',
    tag: 'Health',
    method: 'GET',
    path: '/api/v1/health/live',
    summary: 'Kubernetes liveness probe',
    description: 'Returns 200 OK with server uptime.',
    requiresAuth: false,
    params: [],
  },
];

export const ApiExplorerScreen: React.FC = () => {
  const { currentOrg, currentLibrary, currentRole } = useAuth();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>('auth-me');

  // Interactive Request State
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({});
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [bodyInputs, setBodyInputs] = useState<Record<string, string>>({});

  // Execution result per endpoint
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [results, setResults] = useState<
    Record<
      string,
      {
        status: number;
        statusText: string;
        durationMs: number;
        data: any;
        isError: boolean;
      }
    >
  >({});

  // Copy state
  const [copiedCurlId, setCopiedCurlId] = useState<string | null>(null);
  const [copiedResponseId, setCopiedResponseId] = useState<string | null>(null);

  // Health ping state
  const [healthStatus, setHealthStatus] = useState<{
    ok: boolean;
    latencyMs: number;
    checkedAt: string;
  } | null>(null);

  // Ping health on mount
  useEffect(() => {
    const checkPing = async () => {
      const start = performance.now();
      try {
        const res = await fetch('http://localhost:3000/api/v1/health');
        const latency = Math.round(performance.now() - start);
        if (res.ok) {
          setHealthStatus({ ok: true, latencyMs: latency, checkedAt: new Date().toLocaleTimeString() });
        } else {
          setHealthStatus({ ok: false, latencyMs: latency, checkedAt: new Date().toLocaleTimeString() });
        }
      } catch (e) {
        setHealthStatus({ ok: false, latencyMs: 0, checkedAt: new Date().toLocaleTimeString() });
      }
    };
    checkPing();
  }, []);

  // Pre-fill active session context when endpoint opens
  const activeOrgId = currentOrg?.organization.organizationId || 'org_apex_central';
  const activeLibraryId = currentLibrary?.libraryId || 'lib_central_stacks';

  // Compute all available unique tags
  const tags = useMemo(() => {
    const set = new Set<string>();
    API_ENDPOINTS.forEach((ep) => set.add(ep.tag));
    return Array.from(set);
  }, []);

  // Filtered endpoints
  const filteredEndpoints = useMemo(() => {
    return API_ENDPOINTS.filter((ep) => {
      const matchMethod = selectedMethod === 'ALL' || ep.method === selectedMethod;
      const matchTag = selectedTag === 'ALL' || ep.tag === selectedTag;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        ep.path.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q) ||
        ep.tag.toLowerCase().includes(q);

      return matchMethod && matchTag && matchQuery;
    });
  }, [selectedMethod, selectedTag, searchQuery]);

  // Handle expanding an endpoint card
  const toggleExpand = (endpoint: ApiEndpoint) => {
    if (expandedId === endpoint.id) {
      setExpandedId(null);
    } else {
      setExpandedId(endpoint.id);
      // Pre-fill default param values
      const initialParams: Record<string, string> = {};
      endpoint.params.forEach((p) => {
        if (p.name === 'orgId') initialParams[p.name] = activeOrgId;
        else if (p.name === 'libraryId') initialParams[p.name] = activeLibraryId;
        else if (p.default) initialParams[p.name] = p.default;
        else initialParams[p.name] = '';
      });
      setParamValues((prev) => ({ ...prev, ...initialParams }));

      // Pre-fill default body input if available
      if (endpoint.requestBodyExample && !bodyInputs[endpoint.id]) {
        setBodyInputs((prev) => ({
          ...prev,
          [endpoint.id]: JSON.stringify(endpoint.requestBodyExample, null, 2),
        }));
      }
    }
  };

  // Build the effective URL for an endpoint
  const buildEffectiveUrl = (endpoint: ApiEndpoint) => {
    let url = endpoint.path;
    const queryParams: string[] = [];

    endpoint.params.forEach((p) => {
      const val = paramValues[p.name] ?? (p.name === 'orgId' ? activeOrgId : p.name === 'libraryId' ? activeLibraryId : '');
      if (p.in === 'path') {
        url = url.replace(`{${p.name}}`, encodeURIComponent(val || `{${p.name}}`));
      } else if (p.in === 'query' && val) {
        queryParams.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`);
      }
    });

    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }

    return `http://localhost:3000${url}`;
  };

  // Generate cURL command
  const generateCurl = (endpoint: ApiEndpoint) => {
    const url = buildEffectiveUrl(endpoint);
    let curl = `curl -X ${endpoint.method} "${url}" \\\n`;
    curl += `  -H "Accept: application/json" \\\n`;

    const storedToken = localStorage.getItem('auth_token');
    if (endpoint.requiresAuth) {
      curl += `  -H "Authorization: Bearer ${storedToken || '<YOUR_JWT_TOKEN>'}" \\\n`;
    }
    if (endpoint.path.includes('/organizations/')) {
      curl += `  -H "x-organization-id: ${activeOrgId}" \\\n`;
      curl += `  -H "x-library-id: ${activeLibraryId}" \\\n`;
    }

    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      curl += `  -H "Content-Type: application/json" \\\n`;
      const bodyStr = bodyInputs[endpoint.id] || JSON.stringify(endpoint.requestBodyExample || {});
      curl += `  -d '${bodyStr.replace(/'/g, "\\'")}'`;
    } else {
      curl = curl.slice(0, -3); // remove trailing backslash
    }

    return curl;
  };

  // Copy cURL
  const handleCopyCurl = (endpoint: ApiEndpoint) => {
    const curl = generateCurl(endpoint);
    navigator.clipboard.writeText(curl);
    setCopiedCurlId(endpoint.id);
    showToast('cURL command copied to clipboard', 'info');
    setTimeout(() => setCopiedCurlId(null), 2000);
  };

  // Execute Request (Try It Out)
  const handleExecute = async (endpoint: ApiEndpoint) => {
    setExecutingId(endpoint.id);
    const start = performance.now();
    const url = buildEffectiveUrl(endpoint);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
    if (activeOrgId) {
      headers['x-organization-id'] = activeOrgId;
    }
    if (activeLibraryId) {
      headers['x-library-id'] = activeLibraryId;
    }

    let bodyData: any = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      headers['Content-Type'] = 'application/json';
      const rawBody = bodyInputs[endpoint.id] || JSON.stringify(endpoint.requestBodyExample || {});
      try {
        bodyData = rawBody ? rawBody : undefined;
      } catch (e) {
        showToast('Invalid JSON in Request Body', 'error');
        setExecutingId(null);
        return;
      }
    }

    try {
      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        credentials: 'include',
        body: bodyData,
      });

      const durationMs = Math.round(performance.now() - start);
      let parsedData: any = null;
      const text = await response.text();
      try {
        parsedData = JSON.parse(text);
      } catch {
        parsedData = text;
      }

      setResults((prev) => ({
        ...prev,
        [endpoint.id]: {
          status: response.status,
          statusText: response.statusText,
          durationMs,
          data: parsedData,
          isError: !response.ok,
        },
      }));

      if (response.ok) {
        showToast(`Request successful (${response.status}) in ${durationMs}ms`, 'success');
      } else {
        showToast(`API returned ${response.status} ${response.statusText}`, 'error');
      }
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      setResults((prev) => ({
        ...prev,
        [endpoint.id]: {
          status: 0,
          statusText: 'Network Error',
          durationMs,
          data: { error: err.message || 'Failed to fetch' },
          isError: true,
        },
      }));
      showToast('Network error while executing API call', 'error');
    } finally {
      setExecutingId(null);
    }
  };

  // Helper for Method Badge Color
  const getMethodBadgeStyle = (method: HttpMethod) => {
    switch (method) {
      case 'GET':
        return { color: '#0284c7', background: 'rgba(2, 132, 199, 0.12)', border: '1px solid rgba(2, 132, 199, 0.4)' };
      case 'POST':
        return { color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.4)' };
      case 'PUT':
        return { color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.4)' };
      case 'PATCH':
        return { color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.4)' };
      case 'DELETE':
        return { color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', paddingBottom: '60px' }}>
      {/* 1. HERO HEADER */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(35, 86, 64, 0.08), rgba(20, 40, 25, 0.02))',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span
                style={{
                  background: '#235640',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  letterSpacing: '0.04em',
                }}
              >
                OPENAPI 3.0
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 650,
                  color: healthStatus?.ok ? '#10b981' : '#f59e0b',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: healthStatus?.ok ? '#10b981' : '#f59e0b',
                    display: 'inline-block',
                    boxShadow: healthStatus?.ok ? '0 0 10px #10b981' : 'none',
                  }}
                />
                {healthStatus?.ok ? `Server Online (${healthStatus.latencyMs}ms)` : 'Checking status...'}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.03em' }}>
              Library Platform API Explorer
            </h1>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '14px', maxWidth: '780px' }}>
              Comprehensive interactive Swagger documentation for tenant management, physical book inventory, circulation desk loans, 2D floor plans, circulation heatmaps, fine settlement, and digital wallet balances.
            </p>
          </div>

          {/* Quick Action Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href="http://localhost:3000/api/docs"
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 700,
                padding: '9px 15px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                color: 'var(--text)',
                borderRadius: '10px',
              }}
            >
              <ExternalLink size={15} /> Open Raw Swagger UI
            </a>

            <a
              href="http://localhost:3000/api/docs-json"
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 700,
                padding: '9px 15px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                color: 'var(--text)',
                borderRadius: '10px',
              }}
            >
              <Download size={15} /> OpenAPI JSON
            </a>
          </div>
        </div>

        {/* Live Context Banner */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            fontSize: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 650 }}>Base URL:</span>
              <code style={{ background: 'var(--canvas)', padding: '2px 7px', borderRadius: '5px', fontWeight: 700, color: 'var(--accent)' }}>
                http://localhost:3000
              </code>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 650 }}>Active Org:</span>
              <code style={{ background: 'var(--canvas)', padding: '2px 7px', borderRadius: '5px' }}>
                {activeOrgId}
              </code>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 650 }}>Active Library:</span>
              <code style={{ background: 'var(--canvas)', padding: '2px 7px', borderRadius: '5px' }}>
                {activeLibraryId}
              </code>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 650 }}>Role:</span>
              <span className="pill green" style={{ fontSize: '11px', padding: '1px 8px' }}>
                {currentRole || 'READER'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontSize: '11px' }}>
            <Sparkles size={13} color="var(--accent)" />
            <span>Active auth token injected automatically into "Try It Out"</span>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'var(--surface)',
          padding: '16px 20px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Filter by route path, keyword, or parameter (e.g. circulation, checkout, heatmap)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 40px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--canvas)',
                color: 'var(--text)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Method Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--canvas)', padding: '3px', borderRadius: '8px' }}>
            {(['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMethod(m)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 750,
                  background: selectedMethod === m ? 'var(--surface)' : 'transparent',
                  color: selectedMethod === m ? 'var(--text)' : 'var(--muted)',
                  boxShadow: selectedMethod === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Tag Filters */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginRight: '4px' }}>
            Domain:
          </span>
          <button
            onClick={() => setSelectedTag('ALL')}
            style={{
              padding: '4px 10px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 650,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: selectedTag === 'ALL' ? 'var(--accent)' : 'var(--border)',
              background: selectedTag === 'ALL' ? 'var(--accent-soft)' : 'var(--surface)',
              color: selectedTag === 'ALL' ? 'var(--accent)' : 'var(--text)',
            }}
          >
            All Categories ({API_ENDPOINTS.length})
          </button>
          {tags.map((t) => {
            const count = API_ENDPOINTS.filter((e) => e.tag === t).length;
            const isSel = selectedTag === t;
            return (
              <button
                key={t}
                onClick={() => setSelectedTag(t)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '99px',
                  fontSize: '11px',
                  fontWeight: 650,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: isSel ? 'var(--accent)' : 'var(--border)',
                  background: isSel ? 'var(--accent-soft)' : 'var(--surface)',
                  color: isSel ? 'var(--accent)' : 'var(--text)',
                }}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. ENDPOINTS ACCORDION LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 750, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Endpoints ({filteredEndpoints.length} matches)
          </span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Click any endpoint to inspect headers, parameters, and execute live queries
          </span>
        </div>

        {filteredEndpoints.length === 0 ? (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius)',
              padding: '40px',
              textAlign: 'center',
              color: 'var(--muted)',
            }}
          >
            <AlertCircle size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <div style={{ fontWeight: 700, fontSize: '15px' }}>No endpoints matched your search</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>Try clearing the search query or selecting a different HTTP method.</div>
          </div>
        ) : (
          filteredEndpoints.map((endpoint) => {
            const isExpanded = expandedId === endpoint.id;
            const isRunning = executingId === endpoint.id;
            const result = results[endpoint.id];
            const badgeStyle = getMethodBadgeStyle(endpoint.method);

            return (
              <div
                key={endpoint.id}
                style={{
                  background: 'var(--surface)',
                  border: isExpanded ? `1px solid color-mix(in srgb, ${badgeStyle.color} 50%, var(--border))` : '1px solid var(--border)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
                  boxShadow: isExpanded ? '0 6px 20px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {/* Accordion Header Row */}
                <div
                  onClick={() => toggleExpand(endpoint)}
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: isExpanded ? `color-mix(in srgb, ${badgeStyle.color} 4%, var(--surface))` : 'transparent',
                  }}
                >
                  <span style={{ color: 'var(--muted)', display: 'grid', placeItems: 'center' }}>
                    {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                  </span>

                  {/* Method Badge */}
                  <span
                    style={{
                      ...badgeStyle,
                      width: '66px',
                      textAlign: 'center',
                      padding: '4px 0',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {endpoint.method}
                  </span>

                  {/* Path */}
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                    {endpoint.path.split(/({[^}]+})/).map((part, idx) => {
                      if (part.startsWith('{') && part.endsWith('}')) {
                        return (
                          <span key={idx} style={{ color: badgeStyle.color, background: `color-mix(in srgb, ${badgeStyle.color} 12%, transparent)`, padding: '1px 5px', borderRadius: '4px' }}>
                            {part}
                          </span>
                        );
                      }
                      return <span key={idx}>{part}</span>;
                    })}
                  </span>

                  {/* Summary */}
                  <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'none', minWidth: '220px', textAlign: 'right' }} className="endpoint-summary-preview">
                    {endpoint.summary}
                  </span>

                  {/* Security / Role Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {endpoint.requiresStaff ? (
                      <span className="pill purple" style={{ fontSize: '10px', padding: '1px 7px', fontWeight: 700 }}>
                        <Shield size={10} style={{ marginRight: '3px' }} /> Staff Only
                      </span>
                    ) : endpoint.requiresAuth ? (
                      <span className="pill blue" style={{ fontSize: '10px', padding: '1px 7px', fontWeight: 700 }}>
                        Authenticated
                      </span>
                    ) : (
                      <span className="pill green" style={{ fontSize: '10px', padding: '1px 7px', fontWeight: 700 }}>
                        Public
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'var(--canvas)',
                        color: 'var(--muted)',
                        fontWeight: 650,
                      }}
                    >
                      {endpoint.tag}
                    </span>
                  </div>
                </div>

                {/* Expanded Details & Live Runner */}
                {isExpanded && (
                  <div
                    style={{
                      padding: '18px 22px 24px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--canvas)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '18px',
                    }}
                  >
                    {/* Description */}
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, fontWeight: 500 }}>
                        {endpoint.description}
                      </div>
                    </div>

                    {/* Request Parameters Section */}
                    {endpoint.params.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                          Parameters
                        </div>
                        <div
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            overflow: 'hidden',
                          }}
                        >
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: 'color-mix(in srgb, var(--canvas) 60%, var(--surface))', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, width: '160px' }}>Parameter</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, width: '80px' }}>In</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>Description</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, width: '260px' }}>Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {endpoint.params.map((param) => {
                                const currentValue = paramValues[param.name] ?? '';
                                return (
                                  <tr key={param.name} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                                      {param.name}
                                      {param.required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span className="pill gray" style={{ fontSize: '10px', padding: '1px 6px' }}>
                                        {param.in}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>
                                      {param.description}
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <input
                                        type="text"
                                        value={currentValue}
                                        onChange={(e) =>
                                          setParamValues((prev) => ({
                                            ...prev,
                                            [param.name]: e.target.value,
                                          }))
                                        }
                                        placeholder={`Enter ${param.name}...`}
                                        style={{
                                          width: '100%',
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          border: '1px solid var(--border)',
                                          background: 'var(--canvas)',
                                          color: 'var(--text)',
                                          fontSize: '12px',
                                          fontFamily: 'monospace',
                                        }}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Request Body Editor (for POST/PUT/PATCH) */}
                    {['POST', 'PUT', 'PATCH'].includes(endpoint.method) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                            Request Body (application/json)
                          </span>
                          {endpoint.requestBodyExample && (
                            <button
                              onClick={() => {
                                setBodyInputs((prev) => ({
                                  ...prev,
                                  [endpoint.id]: JSON.stringify(endpoint.requestBodyExample, null, 2),
                                }));
                                showToast('Reset to default example JSON', 'info');
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent)',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Reset Example
                            </button>
                          )}
                        </div>

                        <textarea
                          rows={6}
                          value={bodyInputs[endpoint.id] || ''}
                          onChange={(e) =>
                            setBodyInputs((prev) => ({
                              ...prev,
                              [endpoint.id]: e.target.value,
                            }))
                          }
                          placeholder="{}"
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: '10px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            lineHeight: 1.45,
                            resize: 'vertical',
                          }}
                        />
                      </div>
                    )}

                    {/* Action Bar: Send Request + Copy cURL */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          onClick={() => handleExecute(endpoint)}
                          disabled={isRunning}
                          className="btn primary"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '13px',
                            fontWeight: 700,
                            padding: '9px 18px',
                            borderRadius: '8px',
                          }}
                        >
                          {isRunning ? (
                            <>
                              <RefreshCw size={15} className="spinner" /> Sending...
                            </>
                          ) : (
                            <>
                              <Send size={15} /> Execute (Try It Out)
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleCopyCurl(endpoint)}
                          className="btn"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            fontSize: '12px',
                            fontWeight: 650,
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {copiedCurlId === endpoint.id ? (
                            <>
                              <Check size={14} color="#10b981" /> Copied cURL
                            </>
                          ) : (
                            <>
                              <Terminal size={14} /> Copy cURL
                            </>
                          )}
                        </button>
                      </div>

                      {/* Endpoint Full URL Display */}
                      <code style={{ fontSize: '11px', color: 'var(--muted)', background: 'var(--surface)', padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        {buildEffectiveUrl(endpoint)}
                      </code>
                    </div>

                    {/* Live Server Response Panel */}
                    {result && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginTop: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>
                              Server Response
                            </span>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 800,
                                background: result.status >= 200 && result.status < 300 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: result.status >= 200 && result.status < 300 ? '#10b981' : '#ef4444',
                                border: `1px solid ${result.status >= 200 && result.status < 300 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                              }}
                            >
                              {result.status} {result.statusText}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} /> {result.durationMs} ms
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
                              setCopiedResponseId(endpoint.id);
                              showToast('Response JSON copied', 'info');
                              setTimeout(() => setCopiedResponseId(null), 2000);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--muted)',
                              fontSize: '11px',
                              fontWeight: 650,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {copiedResponseId === endpoint.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                            {copiedResponseId === endpoint.id ? 'Copied' : 'Copy JSON'}
                          </button>
                        </div>

                        <pre
                          style={{
                            margin: 0,
                            padding: '14px 16px',
                            background: '#070a0e',
                            color: '#e2e8f0',
                            borderRadius: '10px',
                            border: '1px solid #1e2633',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            lineHeight: 1.5,
                            overflowX: 'auto',
                            maxHeight: '360px',
                          }}
                        >
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
