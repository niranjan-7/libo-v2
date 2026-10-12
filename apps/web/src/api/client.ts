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
    acceptInvite: async (body: AcceptInviteRequest): Promise<{ success: boolean; organizationId: string; role: string }> => {
      return request('/invitations/accept', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  },
};
