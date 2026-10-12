/**
 * Shared Contracts & Enums for Library Platform
 */

// ==========================================
// 1. HEALTH & CONNECTIVITY
// ==========================================
export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface DatabaseHealthInfo {
  controlPlane: 'connected' | 'disconnected';
  latencyMs?: number;
  message?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  database: DatabaseHealthInfo;
}

// ==========================================
// 2. ROLES & PERMISSIONS
// ==========================================
export enum OrgRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum LibraryRole {
  LIBRARIAN = 'LIBRARIAN',
  READER = 'READER',
}

// ==========================================
// 3. DOMAIN ENUMS
// ==========================================
export enum CopyStatus {
  AVAILABLE = 'AVAILABLE',
  ON_HOLD = 'ON_HOLD',
  LOANED = 'LOANED',
  LOST = 'LOST',
  DAMAGED = 'DAMAGED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum CopyCondition {
  NEW = 'NEW',
  GOOD = 'GOOD',
  MINOR_WEAR = 'MINOR_WEAR',
  DAMAGED = 'DAMAGED',
}

export enum ReservationStatus {
  WAITLISTED = 'WAITLISTED',
  ALLOCATED = 'ALLOCATED',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  FULFILLED = 'FULFILLED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  RETURNED = 'RETURNED',
  OVERDUE = 'OVERDUE',
  LOST = 'LOST',
}

export enum FineStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  WAIVED = 'WAIVED',
}

export enum FineType {
  OVERDUE_DAILY = 'OVERDUE_DAILY',
  LOST_ITEM = 'LOST_ITEM',
  DAMAGE_FEE = 'DAMAGE_FEE',
  MANUAL_CHARGE = 'MANUAL_CHARGE',
}

export enum WalletTransactionType {
  TOPUP = 'TOPUP',
  EXTENSION_FEE = 'EXTENSION_FEE',
  FINE_SETTLEMENT = 'FINE_SETTLEMENT',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
}

export enum LedgerDirection {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

// ==========================================
// 4. AUTH & ORG CONTRACTS
// ==========================================
export interface UserDto {
  userId: string;
  email: string;
  displayName: string;
  status: string;
  createdAt: string;
}

export interface OrganizationDto {
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
}

export interface LibraryDto {
  libraryId: string;
  name: string;
  slug: string;
  timezone: string;
  status: string;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserDto;
  token: string;
  organizations: Array<{
    organization: OrganizationDto;
    role: OrgRole;
  }>;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  initialLibraryName?: string;
  timezone?: string;
}

export interface CreateLibraryRequest {
  name: string;
  slug: string;
  timezone?: string;
}

export interface InviteMemberRequest {
  email: string;
  proposedRole: OrgRole;
  targetLibraryId?: string;
}

export interface AcceptInviteRequest {
  token: string;
}

export interface OrganizationDetailsResponse {
  organization: OrganizationDto;
  role: OrgRole;
  libraries: LibraryDto[];
}
