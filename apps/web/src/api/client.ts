import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  CreateOrganizationRequest,
  CreateLibraryRequest,
  InviteMemberRequest,
  AcceptInviteRequest,
  OrganizationDetailsResponse,
  LibraryDto,
  CatalogSearchResponse,
  BookWorkDto,
  BookCopyDto,
  InventoryStatsResponse,
  FloorPlanResponse,
  FloorCirculationHeatmapResponse,
  RackCirculationHeatmapDto,
  RackDetailResponse,
  LibraryFloorDto,
  CreateFloorRequest,
  UpdateFloorRequest,
  FloorPlanVersionDto,
  SaveFloorPlanDraftRequest,
  ValidateFloorPlanResponse,
  PublishFloorPlanResponse,
  LogicalRackDto,
  CirculationPolicyDto,
  LoanDto,
  ReservationDto,
  CheckoutRequest,
  ReturnRequest,
  CreateReservationRequest,
  ReadyForPickupRequest,
  CirculationDeskStatsResponse,
  WalletDto,
  WalletTransactionDto,
  TopUpRequest,
  FineDto,
  PayFineRequest,
  WaiveFineRequest,
  CreateManualFineRequest,
  GenerateOverdueFinesResponse,
  NotificationDto,
  SystemAuditLogDto,
  JobRunResultDto,
  ReviewDto,
  CreateReviewRequest,
  VoteReviewRequest,
  ReviewCommentDto,
  CreateReviewCommentRequest,
  ModerateReviewRequest,
  ReviewPolicyConfigDto,
  ReviewEligibilityDto,
  CollectionDto,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  BadgeDto,
  ReaderBadgeDto,
  AwardBadgeRequest,
  SharedCollectionResponse,
  SharedReviewResponse,
  LibraryDirectoryEntryDto,
  ReaderAccessRequestDto,
  CreateAccessRequestRequest,
  ReviewAccessRequestRequest,
  UserLibraryMembershipDto,
  OrganizationMemberDto,
  UpdateMemberAccessRequest,
} from '@library/contracts';

const API_BASE = '/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorMessage =
      data?.message ||
      (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

export const api = {
  auth: {
    register: async (body: RegisterRequest): Promise<AuthResponse> => {
      const res = await request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.token) localStorage.setItem('auth_token', res.token);
      return res;
    },
    login: async (body: LoginRequest): Promise<AuthResponse> => {
      const res = await request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.token) localStorage.setItem('auth_token', res.token);
      return res;
    },
    logout: async (): Promise<{ success: boolean }> => {
      try {
        await request<{ success: boolean }>('/auth/logout', { method: 'POST' });
      } finally {
        localStorage.removeItem('auth_token');
      }
      return { success: true };
    },
    getMe: async (): Promise<AuthResponse> => {
      return request<AuthResponse>('/auth/me');
    },
  },
  organizations: {
    getAll: async (): Promise<OrganizationDetailsResponse[]> => {
      return request<OrganizationDetailsResponse[]>('/organizations');
    },
    getById: async (orgId: string): Promise<OrganizationDetailsResponse> => {
      return request<OrganizationDetailsResponse>(`/organizations/${orgId}`);
    },
    create: async (body: CreateOrganizationRequest): Promise<OrganizationDetailsResponse> => {
      return request<OrganizationDetailsResponse>('/organizations', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    createLibrary: async (orgId: string, body: CreateLibraryRequest): Promise<LibraryDto> => {
      return request<LibraryDto>(`/organizations/${orgId}/libraries`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    inviteMember: async (
      orgId: string,
      body: InviteMemberRequest,
    ): Promise<{ invitationId: string; email: string; proposedRole: string; token: string; expiresAt: string }> => {
      return request(`/organizations/${orgId}/invitations`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    getMembers: async (orgId: string): Promise<OrganizationMemberDto[]> => {
      return request<OrganizationMemberDto[]>(`/organizations/${orgId}/members`);
    },
    updateMemberAccess: async (
      orgId: string,
      targetUserId: string,
      body: UpdateMemberAccessRequest,
    ): Promise<{ success: boolean; userId: string; role: string; status: string }> => {
      return request(`/organizations/${orgId}/members/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    getInvitations: async (
      orgId: string,
    ): Promise<Array<{
      invitationId: string;
      email: string;
      proposedRole: string;
      targetLibraryId?: string | null;
      expiresAt: string;
      acceptedAt?: string | null;
      createdAt: string;
    }>> => {
      return request(`/organizations/${orgId}/invitations`);
    },
    acceptInvite: async (body: AcceptInviteRequest): Promise<{ success: boolean; organizationId: string; role: string }> => {
      return request('/organizations/invitations/accept', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  },
  catalog: {
    search: async (
      orgId: string,
      libraryId: string,
      params?: { search?: string; category?: string; status?: string; sort?: string; limit?: number; offset?: number },
    ): Promise<CatalogSearchResponse> => {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.category) q.set('category', params.category);
      if (params?.status) q.set('status', params.status);
      if (params?.sort) q.set('sort', params.sort);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request<CatalogSearchResponse>(`/organizations/${orgId}/libraries/${libraryId}/catalog${qs}`);
    },
    getBookDetails: async (
      orgId: string,
      libraryId: string,
      bookId: string,
    ): Promise<BookWorkDto> => {
      return request<BookWorkDto>(`/organizations/${orgId}/libraries/${libraryId}/catalog/${bookId}`);
    },
    seedDemo: async (
      orgId: string,
      libraryId: string,
    ): Promise<{ success: boolean; message: string }> => {
      return request(`/organizations/${orgId}/libraries/${libraryId}/catalog/seed`, {
        method: 'POST',
      });
    },
  },
  inventory: {
    getInventory: async (
      orgId: string,
      libraryId: string,
      params?: { search?: string; status?: string; condition?: string; limit?: number; offset?: number },
    ): Promise<{ items: BookCopyDto[]; stats: InventoryStatsResponse; total: number }> => {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.status) q.set('status', params.status);
      if (params?.condition) q.set('condition', params.condition);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request(`/organizations/${orgId}/libraries/${libraryId}/inventory${qs}`);
    },
    createCopy: async (
      orgId: string,
      libraryId: string,
      body: { editionId: string; barcode: string; condition?: string; status?: string; homeLocationId: string },
    ): Promise<BookCopyDto> => {
      return request<BookCopyDto>(`/organizations/${orgId}/libraries/${libraryId}/inventory`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  },
  floorPlan: {
    getFloors: async (orgId: string, libraryId: string): Promise<LibraryFloorDto[]> => {
      return request<LibraryFloorDto[]>(`/organizations/${orgId}/libraries/${libraryId}/floors`);
    },
    createFloor: async (
      orgId: string,
      libraryId: string,
      body: CreateFloorRequest,
    ): Promise<LibraryFloorDto> => {
      return request<LibraryFloorDto>(`/organizations/${orgId}/libraries/${libraryId}/floors`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    getFloor: async (
      orgId: string,
      libraryId: string,
      floorId: string,
    ): Promise<LibraryFloorDto> => {
      return request<LibraryFloorDto>(`/organizations/${orgId}/libraries/${libraryId}/floors/${floorId}`);
    },
    updateFloor: async (
      orgId: string,
      libraryId: string,
      floorId: string,
      body: UpdateFloorRequest,
    ): Promise<LibraryFloorDto> => {
      return request<LibraryFloorDto>(`/organizations/${orgId}/libraries/${libraryId}/floors/${floorId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    deleteFloor: async (
      orgId: string,
      libraryId: string,
      floorId: string,
    ): Promise<void> => {
      return request<void>(`/organizations/${orgId}/libraries/${libraryId}/floors/${floorId}`, {
        method: 'DELETE',
      });
    },
    getLogicalRacks: async (
      orgId: string,
      libraryId: string,
      floorId: string,
    ): Promise<LogicalRackDto[]> => {
      return request<LogicalRackDto[]>(`/organizations/${orgId}/libraries/${libraryId}/floors/${floorId}/racks`);
    },
    getVersions: async (
      orgId: string,
      libraryId: string,
      floorId: string,
    ): Promise<FloorPlanVersionDto[]> => {
      return request<FloorPlanVersionDto[]>(`/organizations/${orgId}/libraries/${libraryId}/floors/${floorId}/versions`);
    },
    getPublishedFloorPlan: async (
      orgId: string,
      libraryId: string,
      floorIdOrNumber: string | number,
    ): Promise<FloorPlanResponse> => {
      if (typeof floorIdOrNumber === 'number') {
        return request<FloorPlanResponse>(`/organizations/${orgId}/libraries/${libraryId}/floors/published-level/${floorIdOrNumber}`);
      }
      return request<FloorPlanResponse>(`/organizations/${orgId}/libraries/${libraryId}/floors/${floorIdOrNumber}/published`);
    },
    getCirculationHeatmap: async (
      orgId: string,
      libraryId: string,
      floorId: string,
      timeRange: '30d' | '90d' | 'all' = '30d',
    ): Promise<FloorCirculationHeatmapResponse> => {
      return request<FloorCirculationHeatmapResponse>(
        `/organizations/${orgId}/libraries/${libraryId}/floors/${floorId}/heatmap?timeRange=${timeRange}`,
      );
    },
    getFloorPlan: async (
      orgId: string,
      libraryId: string,
      floorNumber: number = 1,
    ): Promise<FloorPlanResponse> => {
      return request<FloorPlanResponse>(`/organizations/${orgId}/libraries/${libraryId}/floor-plan?floor=${floorNumber}`);
    },
    getDraft: async (
      orgId: string,
      libraryId: string,
      floorId: string,
    ): Promise<FloorPlanVersionDto> => {
      return request<FloorPlanVersionDto>(`/organizations/${orgId}/libraries/${libraryId}/floors/${floorId}/draft`);
    },
    saveDraft: async (
      orgId: string,
      libraryId: string,
      floorId: string,
      versionId: string,
      body: SaveFloorPlanDraftRequest,
    ): Promise<FloorPlanVersionDto> => {
      return request<FloorPlanVersionDto>(`/organizations/${orgId}/libraries/${libraryId}/floors/${floorId}/draft/${versionId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    validateDraft: async (
      orgId: string,
      libraryId: string,
      floorId: string,
      versionId: string,
    ): Promise<ValidateFloorPlanResponse> => {
      return request<ValidateFloorPlanResponse>(`/organizations/${orgId}/libraries/${libraryId}/floors/${floorId}/draft/${versionId}/validate`, {
        method: 'POST',
      });
    },
    publishDraft: async (
      orgId: string,
      libraryId: string,
      floorId: string,
      versionId: string,
    ): Promise<PublishFloorPlanResponse> => {
      return request<PublishFloorPlanResponse>(`/organizations/${orgId}/libraries/${libraryId}/floors/${floorId}/draft/${versionId}/publish`, {
        method: 'POST',
      });
    },
    restoreVersion: async (
      orgId: string,
      libraryId: string,
      floorId: string,
      versionId: string,
    ): Promise<FloorPlanVersionDto> => {
      return request<FloorPlanVersionDto>(`/organizations/${orgId}/libraries/${libraryId}/floors/${floorId}/versions/${versionId}/restore`, {
        method: 'POST',
      });
    },
    getRackShelves: async (
      orgId: string,
      libraryId: string,
      rackCode: string,
    ): Promise<RackDetailResponse> => {
      return request<RackDetailResponse>(`/organizations/${orgId}/libraries/${libraryId}/locations/racks/${rackCode}/shelves`);
    },
  },
  circulation: {
    checkout: async (
      orgId: string,
      libraryId: string,
      body: CheckoutRequest,
    ): Promise<LoanDto> => {
      return request<LoanDto>(`/organizations/${orgId}/libraries/${libraryId}/circulation/checkout`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    returnCopy: async (
      orgId: string,
      libraryId: string,
      body: ReturnRequest,
    ): Promise<{ loan?: LoanDto; copyStatus: string; nextReservation?: ReservationDto }> => {
      return request(`/organizations/${orgId}/libraries/${libraryId}/circulation/return`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    createReservation: async (
      orgId: string,
      libraryId: string,
      body: CreateReservationRequest,
    ): Promise<ReservationDto> => {
      return request<ReservationDto>(`/organizations/${orgId}/libraries/${libraryId}/circulation/reservations`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    markReadyForPickup: async (
      orgId: string,
      libraryId: string,
      reservationId: string,
      body: ReadyForPickupRequest = {},
    ): Promise<ReservationDto> => {
      return request<ReservationDto>(
        `/organizations/${orgId}/libraries/${libraryId}/circulation/reservations/${reservationId}/ready-for-pickup`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );
    },
    cancelReservation: async (
      orgId: string,
      libraryId: string,
      reservationId: string,
    ): Promise<ReservationDto> => {
      return request<ReservationDto>(
        `/organizations/${orgId}/libraries/${libraryId}/circulation/reservations/${reservationId}/cancel`,
        {
          method: 'POST',
        },
      );
    },
    extendLoan: async (
      orgId: string,
      libraryId: string,
      loanId: string,
    ): Promise<LoanDto> => {
      return request<LoanDto>(`/organizations/${orgId}/libraries/${libraryId}/circulation/loans/${loanId}/extend`, {
        method: 'POST',
      });
    },
    processExpiries: async (
      orgId: string,
      libraryId: string,
    ): Promise<{ expiredCount: number; reassignedCount: number }> => {
      return request(`/organizations/${orgId}/libraries/${libraryId}/circulation/reservations/process-expiries`, {
        method: 'POST',
      });
    },
    getLoans: async (
      orgId: string,
      libraryId: string,
      params?: { readerUserId?: string; status?: string; search?: string; limit?: number; offset?: number },
    ): Promise<{ items: LoanDto[]; total: number }> => {
      const q = new URLSearchParams();
      if (params?.readerUserId) q.set('readerUserId', params.readerUserId);
      if (params?.status) q.set('status', params.status);
      if (params?.search) q.set('search', params.search);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request(`/organizations/${orgId}/libraries/${libraryId}/circulation/loans${qs}`);
    },
    getReservations: async (
      orgId: string,
      libraryId: string,
      params?: { readerUserId?: string; editionId?: string; status?: string; limit?: number; offset?: number },
    ): Promise<{ items: ReservationDto[]; total: number }> => {
      const q = new URLSearchParams();
      if (params?.readerUserId) q.set('readerUserId', params.readerUserId);
      if (params?.editionId) q.set('editionId', params.editionId);
      if (params?.status) q.set('status', params.status);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request(`/organizations/${orgId}/libraries/${libraryId}/circulation/reservations${qs}`);
    },
    getStats: async (
      orgId: string,
      libraryId: string,
    ): Promise<CirculationDeskStatsResponse> => {
      return request<CirculationDeskStatsResponse>(
        `/organizations/${orgId}/libraries/${libraryId}/circulation/stats`,
      );
    },
    getMyCirculation: async (
      orgId: string,
      libraryId: string,
    ): Promise<{
      activeLoans: LoanDto[];
      reservations: ReservationDto[];
      stats: {
        activeLoansCount: number;
        maxActiveLoans: number;
        pendingReservationsCount: number;
        maxPendingReservations: number;
      };
    }> => {
      return request(`/organizations/${orgId}/libraries/${libraryId}/circulation/my-circulation`);
    },
    getPolicy: async (
      orgId: string,
      libraryId: string,
    ): Promise<CirculationPolicyDto> => {
      return request<CirculationPolicyDto>(
        `/organizations/${orgId}/libraries/${libraryId}/circulation/policy`,
      );
    },
    updatePolicy: async (
      orgId: string,
      libraryId: string,
      body: Partial<CirculationPolicyDto>,
    ): Promise<CirculationPolicyDto> => {
      return request<CirculationPolicyDto>(
        `/organizations/${orgId}/libraries/${libraryId}/circulation/policy`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        },
      );
    },
  },
  wallet: {
    getMyWallet: async (orgId: string, libraryId: string): Promise<WalletDto> => {
      return request<WalletDto>(`/organizations/${orgId}/libraries/${libraryId}/wallet/my-wallet`);
    },
    getMyTransactions: async (
      orgId: string,
      libraryId: string,
      params?: { limit?: number; offset?: number },
    ): Promise<{ items: WalletTransactionDto[]; total: number; balance: number }> => {
      const q = new URLSearchParams();
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request(`/organizations/${orgId}/libraries/${libraryId}/wallet/my-transactions${qs}`);
    },
    topUp: async (
      orgId: string,
      libraryId: string,
      body: TopUpRequest,
    ): Promise<{ wallet: WalletDto; transaction: WalletTransactionDto; isDuplicate: boolean }> => {
      return request(`/organizations/${orgId}/libraries/${libraryId}/wallet/topup`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  },
  fines: {
    getFines: async (
      orgId: string,
      libraryId: string,
      params?: { readerUserId?: string; status?: string; fineType?: string; loanId?: string; limit?: number; offset?: number },
    ): Promise<{ items: FineDto[]; total: number; totalOutstanding: number }> => {
      const q = new URLSearchParams();
      if (params?.readerUserId) q.set('readerUserId', params.readerUserId);
      if (params?.status) q.set('status', params.status);
      if (params?.fineType) q.set('fineType', params.fineType);
      if (params?.loanId) q.set('loanId', params.loanId);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request(`/organizations/${orgId}/libraries/${libraryId}/fines${qs}`);
    },
    createManualFine: async (
      orgId: string,
      libraryId: string,
      body: CreateManualFineRequest,
    ): Promise<FineDto> => {
      return request<FineDto>(`/organizations/${orgId}/libraries/${libraryId}/fines`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    payFine: async (
      orgId: string,
      libraryId: string,
      fineId: string,
      body?: PayFineRequest,
    ): Promise<{ fine: FineDto; newWalletBalance: number }> => {
      return request(`/organizations/${orgId}/libraries/${libraryId}/fines/${fineId}/pay`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      });
    },
    waiveFine: async (
      orgId: string,
      libraryId: string,
      fineId: string,
      body: WaiveFineRequest,
    ): Promise<FineDto> => {
      return request<FineDto>(`/organizations/${orgId}/libraries/${libraryId}/fines/${fineId}/waive`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    generateOverdueFines: async (
      orgId: string,
      libraryId: string,
    ): Promise<GenerateOverdueFinesResponse> => {
      return request<GenerateOverdueFinesResponse>(
        `/organizations/${orgId}/libraries/${libraryId}/fines/generate-overdue`,
        {
          method: 'POST',
        },
      );
    },
  },
  notifications: {
    getMyNotifications: async (
      orgId: string,
      libraryId: string,
      params?: { unreadOnly?: boolean; limit?: number; offset?: number },
    ): Promise<{ items: NotificationDto[]; total: number; unreadCount: number }> => {
      const q = new URLSearchParams();
      if (params?.unreadOnly) q.set('unreadOnly', 'true');
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request(`/organizations/${orgId}/libraries/${libraryId}/notifications${qs}`);
    },
    markAsRead: async (
      orgId: string,
      libraryId: string,
      notificationId: string,
    ): Promise<NotificationDto> => {
      return request<NotificationDto>(
        `/organizations/${orgId}/libraries/${libraryId}/notifications/${notificationId}/read`,
        {
          method: 'POST',
        },
      );
    },
    markAllAsRead: async (
      orgId: string,
      libraryId: string,
    ): Promise<{ affectedCount: number }> => {
      return request(
        `/organizations/${orgId}/libraries/${libraryId}/notifications/read-all`,
        {
          method: 'POST',
        },
      );
    },
  },
  auditLogs: {
    getAuditLogs: async (
      orgId: string,
      libraryId: string,
      params?: { actorUserId?: string; action?: string; entityType?: string; limit?: number; offset?: number },
    ): Promise<{ items: SystemAuditLogDto[]; total: number }> => {
      const q = new URLSearchParams();
      if (params?.actorUserId) q.set('actorUserId', params.actorUserId);
      if (params?.action) q.set('action', params.action);
      if (params?.entityType) q.set('entityType', params.entityType);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      const qs = q.toString() ? `?${q.toString()}` : '';
      return request(`/organizations/${orgId}/libraries/${libraryId}/audit-logs${qs}`);
    },
  },
  jobs: {
    runOverdueFines: async (orgId: string, libraryId: string): Promise<JobRunResultDto> => {
      return request<JobRunResultDto>(`/organizations/${orgId}/libraries/${libraryId}/jobs/run-overdue-fines`, {
        method: 'POST',
      });
    },
    runHoldExpiries: async (orgId: string, libraryId: string): Promise<JobRunResultDto> => {
      return request<JobRunResultDto>(`/organizations/${orgId}/libraries/${libraryId}/jobs/run-hold-expiries`, {
        method: 'POST',
      });
    },
    runNotificationDeliveries: async (orgId: string, libraryId: string): Promise<JobRunResultDto> => {
      return request<JobRunResultDto>(
        `/organizations/${orgId}/libraries/${libraryId}/jobs/run-notification-deliveries`,
        {
          method: 'POST',
        },
      );
    },
    getStatus: async (orgId: string, libraryId: string): Promise<{ activeRunningJobs: string[] }> => {
      return request(`/organizations/${orgId}/libraries/${libraryId}/jobs/status`);
    },
  },
  community: {
    getPolicy: async (orgId: string, libraryId?: string): Promise<ReviewPolicyConfigDto> => {
      const q = libraryId ? `?libraryId=${libraryId}` : '';
      return request(`/organizations/${orgId}/community/policy${q}`);
    },
    updatePolicy: async (
      orgId: string,
      libraryId: string,
      dto: { requireBorrowHistory?: boolean; minAccountAgeDays?: number },
    ): Promise<ReviewPolicyConfigDto> => {
      return request(`/organizations/${orgId}/community/policy?libraryId=${libraryId}`, {
        method: 'PUT',
        body: JSON.stringify(dto),
      });
    },
    checkEligibility: async (
      orgId: string,
      bookId: string,
      libraryId?: string,
    ): Promise<ReviewEligibilityDto> => {
      const q = libraryId ? `&libraryId=${libraryId}` : '';
      return request(`/organizations/${orgId}/community/reviews/eligibility?bookId=${bookId}${q}`);
    },
    getReviewsForBook: async (orgId: string, bookId: string): Promise<ReviewDto[]> => {
      return request(`/organizations/${orgId}/community/reviews/book/${bookId}`);
    },
    createReview: async (
      orgId: string,
      body: CreateReviewRequest & { libraryId?: string },
    ): Promise<ReviewDto> => {
      return request(`/organizations/${orgId}/community/reviews`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    voteReview: async (
      orgId: string,
      reviewId: string,
      vote: 1 | -1 | 0,
    ): Promise<{ upvotesCount: number; downvotesCount: number; score: number; userVote: number }> => {
      return request(`/organizations/${orgId}/community/reviews/${reviewId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote }),
      });
    },
    moderateReview: async (
      orgId: string,
      reviewId: string,
      body: ModerateReviewRequest,
    ): Promise<ReviewDto> => {
      return request(`/organizations/${orgId}/community/reviews/${reviewId}/moderate`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    createComment: async (
      orgId: string,
      reviewId: string,
      body: CreateReviewCommentRequest,
    ): Promise<ReviewCommentDto> => {
      return request(`/organizations/${orgId}/community/reviews/${reviewId}/comments`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    getComments: async (orgId: string, reviewId: string): Promise<ReviewCommentDto[]> => {
      return request(`/organizations/${orgId}/community/reviews/${reviewId}/comments`);
    },
    getCollections: async (orgId: string): Promise<CollectionDto[]> => {
      return request(`/organizations/${orgId}/community/collections`);
    },
    createCollection: async (
      orgId: string,
      body: CreateCollectionRequest,
    ): Promise<CollectionDto> => {
      return request(`/organizations/${orgId}/community/collections`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    getCollectionDetails: async (orgId: string, collectionId: string): Promise<CollectionDto> => {
      return request(`/organizations/${orgId}/community/collections/${collectionId}`);
    },
    updateCollection: async (
      orgId: string,
      collectionId: string,
      body: UpdateCollectionRequest,
    ): Promise<CollectionDto> => {
      return request(`/organizations/${orgId}/community/collections/${collectionId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
    addBookToCollection: async (
      orgId: string,
      collectionId: string,
      bookId: string,
    ): Promise<CollectionDto> => {
      return request(`/organizations/${orgId}/community/collections/${collectionId}/books`, {
        method: 'POST',
        body: JSON.stringify({ bookId }),
      });
    },
    removeBookFromCollection: async (
      orgId: string,
      collectionId: string,
      bookId: string,
    ): Promise<CollectionDto> => {
      return request(`/organizations/${orgId}/community/collections/${collectionId}/books/${bookId}`, {
        method: 'DELETE',
      });
    },
    reorderCollectionBooks: async (
      orgId: string,
      collectionId: string,
      bookIds: string[],
    ): Promise<CollectionDto> => {
      return request(`/organizations/${orgId}/community/collections/${collectionId}/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ bookIds }),
      });
    },
    deleteCollection: async (orgId: string, collectionId: string): Promise<void> => {
      await request(`/organizations/${orgId}/community/collections/${collectionId}`, {
        method: 'DELETE',
      });
    },
    getBadges: async (orgId: string): Promise<BadgeDto[]> => {
      return request(`/organizations/${orgId}/community/badges`);
    },
    getMyBadges: async (orgId: string): Promise<ReaderBadgeDto[]> => {
      return request(`/organizations/${orgId}/community/badges/my`);
    },
    getUserBadges: async (orgId: string, userId: string): Promise<ReaderBadgeDto[]> => {
      return request(`/organizations/${orgId}/community/badges/user/${userId}`);
    },
    awardBadge: async (orgId: string, body: AwardBadgeRequest): Promise<ReaderBadgeDto> => {
      return request(`/organizations/${orgId}/community/badges/award`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    getDeepLinkCollection: async (
      orgId: string,
      collectionId: string,
    ): Promise<SharedCollectionResponse> => {
      return request(`/organizations/${orgId}/community/deep-link/collection/${collectionId}`);
    },
    getDeepLinkReview: async (
      orgId: string,
      reviewId: string,
    ): Promise<SharedReviewResponse> => {
      return request(`/organizations/${orgId}/community/deep-link/review/${reviewId}`);
    },
  },
  libraries: {
    getDirectory: async (): Promise<LibraryDirectoryEntryDto[]> => {
      return request('/libraries/directory');
    },
    getMyLibraries: async (): Promise<UserLibraryMembershipDto[]> => {
      return request('/libraries/me');
    },
    submitAccessRequest: async (
      libraryId: string,
      body: CreateAccessRequestRequest,
    ): Promise<ReaderAccessRequestDto> => {
      return request(`/libraries/${libraryId}/access-requests`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    getAccessRequests: async (
      orgId: string,
      libraryId: string,
    ): Promise<ReaderAccessRequestDto[]> => {
      return request(`/organizations/${orgId}/libraries/${libraryId}/access-requests`);
    },
    approveAccessRequest: async (
      orgId: string,
      libraryId: string,
      requestId: string,
    ): Promise<ReaderAccessRequestDto> => {
      return request(`/organizations/${orgId}/libraries/${libraryId}/access-requests/${requestId}/approve`, {
        method: 'POST',
      });
    },
    rejectAccessRequest: async (
      orgId: string,
      libraryId: string,
      requestId: string,
      body?: ReviewAccessRequestRequest,
    ): Promise<ReaderAccessRequestDto> => {
      return request(`/organizations/${orgId}/libraries/${libraryId}/access-requests/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      });
    },
  },
};

