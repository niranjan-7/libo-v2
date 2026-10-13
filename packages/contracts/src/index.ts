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
  proposedRole: OrgRole | 'LIBRARIAN';
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

export interface OrganizationMemberDto {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  libraryRole?: string;
  status: string;
  joinedAt: string;
}

export interface UpdateMemberAccessRequest {
  role?: OrgRole | 'OWNER' | 'ADMIN' | 'MEMBER' | 'LIBRARIAN' | 'READER' | string;
  status?: 'ACTIVE' | 'SUSPENDED';
  targetLibraryId?: string;
}

// ==========================================
// 5. CATALOG & PHYSICAL INVENTORY CONTRACTS
// ==========================================
export interface AuthorDto {
  authorId: string;
  name: string;
  biography?: string;
}

export interface PublisherDto {
  publisherId: string;
  name: string;
}

export interface CategoryDto {
  categoryId: string;
  name: string;
}

export interface LocationDto {
  locationId: string;
  libraryId: string;
  floorId: string;
  parentLocationId?: string | null;
  locationType: 'ZONE' | 'RACK' | 'SHELF' | 'SERVICE_DESK' | 'RETURNS_DESK';
  code: string;
  name: string;
}

export interface BookCopyDto {
  copyId: string;
  libraryId: string;
  editionId: string;
  barcode: string;
  status: CopyStatus;
  condition: CopyCondition;
  homeLocation: LocationDto;
  currentLocation?: LocationDto | null;
  bookId: string;
  bookTitle: string;
  editionLabel: string;
  format: string;
  isbn?: string;
  authorName?: string;
}

export interface BookEditionDto {
  editionId: string;
  bookId: string;
  publisher: PublisherDto;
  isbn?: string;
  editionLabel: string;
  format: string;
  language: string;
  publicationDate?: string;
  replacementCost: number;
  copies?: BookCopyDto[];
}

export interface BookWorkDto {
  bookId: string;
  title: string;
  subtitle?: string;
  synopsis?: string;
  coverUrl?: string;
  status: string;
  authors: AuthorDto[];
  categories: CategoryDto[];
  editions?: BookEditionDto[];
  totalCopies: number;
  availableCopies: number;
  averageRating: number;
  reviewCount: number;
  publicationYear?: number;
  createdAt: string;
}

export interface CatalogQueryParams {
  search?: string;
  category?: string;
  status?: string;
  sort?: 'relevance' | 'title' | 'year';
  limit?: number;
  offset?: number;
}

export interface CatalogSearchResponse {
  items: BookWorkDto[];
  total: number;
  limit: number;
  offset: number;
}

export type FloorPlanVersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type SpatialElementType = 'RACK' | 'WALL' | 'DOOR' | 'DESK';

export interface LibraryFloorDto {
  floorId: string;
  libraryId: string;
  name: string;
  floorNumber: number;
  canvasWidth: number;
  canvasHeight: number;
  coordinateUnit: string;
}

export interface CreateFloorRequest {
  name: string;
  floorNumber: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface UpdateFloorRequest {
  name?: string;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface SpatialLayoutElementDto {
  elementId: string;
  versionId: string;
  elementType: SpatialElementType | string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  linkedLocationId?: string | null;
  linkedRackCode?: string | null;
  properties?: Record<string, any>;
  hasBooks?: boolean;
  availableCopiesCount?: number;
}

export interface FloorPlanVersionDto {
  versionId: string;
  floorId: string;
  versionNumber: number;
  status: FloorPlanVersionStatus;
  createdByUserId: string;
  publishedAt?: string | null;
  createdAt: string;
  elementCount: number;
  elements?: SpatialLayoutElementDto[];
}

export interface SaveSpatialElementRequest {
  elementId?: string;
  elementType: SpatialElementType | string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
  linkedLocationId?: string | null;
  properties?: Record<string, any>;
}

export interface SaveFloorPlanDraftRequest {
  elements: SaveSpatialElementRequest[];
}

export interface ValidateFloorPlanResponse {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PublishFloorPlanResponse {
  versionId: string;
  versionNumber: number;
  status: 'PUBLISHED';
  publishedAt: string;
}

export interface LogicalRackDto {
  locationId: string;
  libraryId: string;
  floorId: string;
  code: string;
  name: string;
  shelfCount: number;
  totalCopiesCount: number;
}

export interface FloorPlanFixtureDto {
  elementId: string;
  elementType: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex?: number;
  properties?: Record<string, any>;
  linkedLocationId?: string | null;
  linkedRackCode?: string | null;
  hasBooks?: boolean;
  availableCopiesCount?: number;
}

export interface FloorPlanResponse {
  floorId: string;
  floorName: string;
  floorNumber: number;
  canvasWidth: number;
  canvasHeight: number;
  versionNumber: number;
  versionId?: string;
  status?: FloorPlanVersionStatus;
  fixtures: FloorPlanFixtureDto[];
}

export interface ShelfCopiesDto {
  shelfNumber: number;
  shelfLocationId: string;
  shelfCode: string;
  totalCopies: number;
  availableCopies: number;
  uniqueTitlesCount: number;
  copies: BookCopyDto[];
}

export interface RackDetailResponse {
  rackCode: string;
  rackName: string;
  rackLocationId: string;
  floorName: string;
  shelves: ShelfCopiesDto[];
}

export interface RackCirculationHeatmapDto {
  rackCode: string;
  rackName?: string;
  locationId: string;
  totalLoans: number;
  activeLoans: number;
  totalCopies: number;
  turnoverRate: number;
  heatScore: number; // Normalized 0.0 to 1.0 relative to floor peak
  topGenre?: string;
  topBookTitle?: string;
}

export interface FloorCirculationHeatmapResponse {
  floorId: string;
  floorName: string;
  floorNumber: number;
  timeRange: '30d' | '90d' | 'all';
  totalFloorLoans: number;
  peakRackCode?: string;
  peakLoanCount: number;
  racks: RackCirculationHeatmapDto[];
}

export interface InventoryStatsResponse {
  totalCopies: number;
  availableCopies: number;
  loanedCopies: number;
  exceptionsCount: number;
}

// ==========================================
// 6. CIRCULATION, LOANS & RESERVATIONS
// ==========================================
export interface CirculationPolicyDto {
  loanPeriodDays: number;
  extensionIncrementDays: number;
  maxExtensions: number;
  maxActiveLoans: number;
  maxPendingReservations: number;
  pickupWindowHours: number;
  currencyCode: string;
  dailyOverdueFineRate: number;
}

export interface LoanDto {
  loanId: string;
  libraryId: string;
  copyId: string;
  readerUserId: string;
  readerName?: string;
  readerEmail?: string;
  reservationId?: string | null;
  barcode: string;
  bookTitle: string;
  authorName?: string;
  editionLabel: string;
  format: string;
  checkedOutAt: string;
  dueAt: string;
  returnedAt?: string | null;
  status: LoanStatus;
  extensionCount: number;
  isOverdue: boolean;
  policySnapshot?: Record<string, any>;
}

export interface ReservationDto {
  reservationId: string;
  libraryId: string;
  readerUserId: string;
  readerName?: string;
  readerEmail?: string;
  editionId: string;
  bookTitle: string;
  authorName?: string;
  editionLabel: string;
  assignedCopyId?: string | null;
  assignedBarcode?: string | null;
  pickupLocationCode?: string | null;
  status: ReservationStatus;
  queuePosition?: number;
  createdAt: string;
  allocatedAt?: string | null;
  readyAt?: string | null;
  pickupDeadlineAt?: string | null;
  fulfilledAt?: string | null;
  cancelledAt?: string | null;
}

export interface CheckoutRequest {
  barcode: string;
  readerUserId: string;
  reservationId?: string;
}

export interface ReturnRequest {
  barcode: string;
  condition?: CopyCondition;
}

export interface CreateReservationRequest {
  editionId: string;
  readerUserId?: string;
}

export interface ReadyForPickupRequest {
  pickupLocationId?: string;
}

export interface CirculationDeskStatsResponse {
  activeLoansCount: number;
  overdueLoansCount: number;
  readyForPickupCount: number;
  pendingReservationsCount: number;
}

// ==========================================
// 7. FINANCIALS, WALLETS & FINES
// ==========================================
export interface WalletDto {
  walletId: string;
  libraryId: string;
  userId: string;
  currencyCode: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransactionDto {
  transactionId: string;
  walletId: string;
  fineId?: string | null;
  loanId?: string | null;
  transactionType: WalletTransactionType;
  direction: LedgerDirection;
  amount: number;
  currencyCode: string;
  idempotencyKey: string;
  notes?: string | null;
  createdAt: string;
}

export interface TopUpRequest {
  amount: number;
  idempotencyKey?: string;
  notes?: string;
}

export interface FineDto {
  fineId: string;
  libraryId: string;
  readerUserId: string;
  readerName?: string;
  readerEmail?: string;
  loanId?: string | null;
  bookTitle?: string;
  barcode?: string;
  fineType: FineType;
  fineDate?: string | null;
  amount: number;
  outstandingAmount: number;
  status: FineStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PayFineRequest {
  idempotencyKey?: string;
}

export interface WaiveFineRequest {
  reason: string;
}

export interface CreateManualFineRequest {
  readerUserId: string;
  fineType: FineType;
  amount: number;
  loanId?: string;
  notes?: string;
}

export interface GenerateOverdueFinesResponse {
  finesGeneratedCount: number;
  totalFineAmount: number;
  loansCheckedCount: number;
}

// ==========================================
// 8. NOTIFICATIONS & DELIVERIES
// ==========================================
export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
}

export enum NotificationDeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export interface NotificationDeliveryDto {
  deliveryId: string;
  notificationId: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  attemptCount: number;
  sentAt?: string | null;
  errorMessage?: string | null;
}

export interface NotificationDto {
  notificationId: string;
  userId: string;
  libraryId?: string | null;
  eventType: string;
  title: string;
  body: string;
  payload: Record<string, any>;
  dedupeKey: string;
  readAt?: string | null;
  createdAt: string;
  deliveries?: NotificationDeliveryDto[];
}

// ==========================================
// 9. AUDIT LOGS & BACKGROUND JOBS
// ==========================================
export interface SystemAuditLogDto {
  auditId: string;
  libraryId?: string | null;
  actorUserId: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  traceId?: string | null;
  createdAt: string;
}

export interface JobRunResultDto {
  jobName: string;
  success: boolean;
  executedAt: string;
  durationMs: number;
  metrics: Record<string, any>;
  error?: string;
}

// ==========================================
// 10. REVIEWS, COMMUNITY, COLLECTIONS & BADGES
// ==========================================
export type ReviewStatus = 'PUBLISHED' | 'FLAGGED' | 'HIDDEN';
export type CollectionVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
export type CollectionStatus = 'ACTIVE' | 'ARCHIVED';

export interface ReviewDto {
  reviewId: string;
  bookId: string;
  bookTitle?: string;
  userId: string;
  authorName: string;
  rating: number; // 1 - 5
  title: string;
  body: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  upvotesCount: number;
  downvotesCount: number;
  score: number;
  userVote?: 1 | -1 | 0 | null;
  commentsCount: number;
}

export interface CreateReviewRequest {
  bookId: string;
  rating: number;
  title: string;
  body: string;
}

export interface VoteReviewRequest {
  vote: 1 | -1 | 0; // 1 = helpful / upvote, -1 = unhelpful / downvote, 0 = remove vote
}

export interface ReviewCommentDto {
  commentId: string;
  reviewId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface CreateReviewCommentRequest {
  body: string;
}

export interface ModerateReviewRequest {
  status: ReviewStatus;
  reason?: string;
}

export interface ReviewPolicyConfigDto {
  requireBorrowHistory: boolean;
  minAccountAgeDays: number;
}

export interface ReviewEligibilityDto {
  canReview: boolean;
  reason?: string;
  policy: ReviewPolicyConfigDto;
}

export interface CollectionBookItemDto {
  collectionId: string;
  bookId: string;
  position: number;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  authors: AuthorDto[];
  availableCopies: number;
  totalCopies: number;
}

export interface CollectionDto {
  collectionId: string;
  creatorUserId: string;
  creatorName?: string;
  title: string;
  description?: string | null;
  visibility: CollectionVisibility;
  status: CollectionStatus;
  createdAt: string;
  bookCount: number;
  books?: CollectionBookItemDto[];
}

export interface CreateCollectionRequest {
  title: string;
  description?: string;
  visibility?: CollectionVisibility;
  initialBookIds?: string[];
}

export interface UpdateCollectionRequest {
  title?: string;
  description?: string;
  visibility?: CollectionVisibility;
  status?: CollectionStatus;
}

export interface ReorderCollectionBooksRequest {
  bookIds: string[];
}

export interface BadgeDto {
  badgeId: string;
  code: string;
  name: string;
  description: string;
  criteria?: Record<string, any>;
}

export interface ReaderBadgeDto {
  userId: string;
  badgeId: string;
  code: string;
  name: string;
  description: string;
  earnedAt: string;
}

export interface AwardBadgeRequest {
  userId: string;
  badgeCode: string;
}

export interface SharedCollectionResponse {
  collection: CollectionDto;
  isOwner: boolean;
  accessLevel: 'OWNER' | 'PUBLIC' | 'UNLISTED';
}

export interface SharedReviewResponse {
  review: ReviewDto;
  bookTitle: string;
  accessLevel: 'PUBLIC' | 'AUTHOR_OR_STAFF';
}

// ==========================================
// 14. LIBRARY DIRECTORY & ACCESS REQUESTS
// ==========================================
export type ReaderAccessStatus = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'NONE';

export interface LibraryDirectoryEntryDto {
  libraryId: string;
  organizationId: string;
  organizationName: string;
  name: string;
  slug: string;
  timezone: string;
  status: string;
  membershipStatus: ReaderAccessStatus;
  pendingRequestId?: string;
  createdAt: string;
}

export interface ReaderAccessRequestDto {
  requestId: string;
  libraryId: string;
  libraryName?: string;
  organizationId?: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedByUserId?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface CreateAccessRequestRequest {
  notes?: string;
}

export interface ReviewAccessRequestRequest {
  reason?: string;
}

export interface UserLibraryMembershipDto {
  libraryId: string;
  libraryName: string;
  librarySlug: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
  status: string;
  joinedAt: string;
}


