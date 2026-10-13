import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  UserDto,
  OrgRole,
  OrganizationDetailsResponse,
  LibraryDto,
  CreateOrganizationRequest,
  CreateLibraryRequest,
  InviteMemberRequest,
  UserLibraryMembershipDto,
} from '@library/contracts';
import { api } from '../api/client';

interface AuthContextType {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  organizations: OrganizationDetailsResponse[];
  currentOrg: OrganizationDetailsResponse | null;
  currentLibrary: LibraryDto | null;
  currentRole: OrgRole | null;
  myLibraries: UserLibraryMembershipDto[];
  activeLibrary: UserLibraryMembershipDto | null;
  isReaderOnly: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  selectOrganization: (orgId: string) => void;
  selectLibrary: (libraryId: string) => void;
  selectActiveLibrary: (libraryId: string) => void;
  refreshData: () => Promise<void>;
  createOrganization: (data: CreateOrganizationRequest) => Promise<OrganizationDetailsResponse>;
  createLibrary: (data: CreateLibraryRequest) => Promise<LibraryDto>;
  inviteMember: (data: InviteMemberRequest) => Promise<{ invitationId: string; email: string; token: string }>;
  acceptInvite: (token: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationDetailsResponse[]>([]);
  const [myLibraries, setMyLibraries] = useState<UserLibraryMembershipDto[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => localStorage.getItem('active_org_id'));
  const [selectedLibId, setSelectedLibId] = useState<string | null>(() => localStorage.getItem('active_lib_id'));

  const clearError = () => setError(null);

  const refreshData = useCallback(async () => {
    try {
      const meResponse = await api.auth.getMe();
      setUser(meResponse.user);

      const orgsList = await api.organizations.getAll();
      setOrganizations(orgsList);

      let myLibsList: UserLibraryMembershipDto[] = [];
      try {
        myLibsList = await api.libraries.getMyLibraries();
        setMyLibraries(myLibsList);
      } catch {
        myLibsList = [];
        setMyLibraries([]);
      }

      if (myLibsList.length > 0) {
        // If reader or staff has active libraries, ensure active selection
        const foundActiveLib = myLibsList.find((l) => l.libraryId === selectedLibId) || myLibsList[0];
        setSelectedLibId(foundActiveLib.libraryId);
        setSelectedOrgId(foundActiveLib.organizationId);
        localStorage.setItem('active_lib_id', foundActiveLib.libraryId);
        localStorage.setItem('active_org_id', foundActiveLib.organizationId);
      } else if (orgsList.length > 0) {
        // Select either previously selected org or the first org
        const foundOrg = orgsList.find((o) => o.organization.organizationId === selectedOrgId) || orgsList[0];
        setSelectedOrgId(foundOrg.organization.organizationId);
        localStorage.setItem('active_org_id', foundOrg.organization.organizationId);

        // Select either previously selected library or first library of this org
        if (foundOrg.libraries.length > 0) {
          const foundLib = foundOrg.libraries.find((l) => l.libraryId === selectedLibId) || foundOrg.libraries[0];
          setSelectedLibId(foundLib.libraryId);
          localStorage.setItem('active_lib_id', foundLib.libraryId);
        } else {
          setSelectedLibId(null);
          localStorage.removeItem('active_lib_id');
        }
      } else {
        setSelectedOrgId(null);
        setSelectedLibId(null);
        localStorage.removeItem('active_org_id');
        localStorage.removeItem('active_lib_id');
      }
    } catch {
      // User is not authenticated or session expired
      setUser(null);
      setOrganizations([]);
      setMyLibraries([]);
      setSelectedOrgId(null);
      setSelectedLibId(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('active_org_id');
      localStorage.removeItem('active_lib_id');
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId, selectedLibId]);

  useEffect(() => {
    refreshData();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await api.auth.login({ email, password });
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await api.auth.register({ email, password, displayName });
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      setOrganizations([]);
      setMyLibraries([]);
      setSelectedOrgId(null);
      setSelectedLibId(null);
      setIsLoading(false);
    }
  };

  const selectOrganization = (orgId: string) => {
    const org = organizations.find((o) => o.organization.organizationId === orgId);
    if (!org) return;

    setSelectedOrgId(orgId);
    localStorage.setItem('active_org_id', orgId);

    // Pick first library from the newly selected org
    if (org.libraries.length > 0) {
      setSelectedLibId(org.libraries[0].libraryId);
      localStorage.setItem('active_lib_id', org.libraries[0].libraryId);
    } else {
      setSelectedLibId(null);
      localStorage.removeItem('active_lib_id');
    }
  };

  const selectLibrary = (libraryId: string) => {
    setSelectedLibId(libraryId);
    localStorage.setItem('active_lib_id', libraryId);
  };

  const selectActiveLibrary = (libraryId: string) => {
    // 1. Check in myLibraries (reader/librarian memberships)
    const lib = myLibraries.find((l) => l.libraryId === libraryId);
    if (lib) {
      setSelectedOrgId(lib.organizationId);
      setSelectedLibId(lib.libraryId);
      localStorage.setItem('active_org_id', lib.organizationId);
      localStorage.setItem('active_lib_id', lib.libraryId);
      return;
    }

    // 2. Check in organizations (Owner/Admin of the organization owning this library)
    for (const org of organizations) {
      const match = org.libraries.find((l) => l.libraryId === libraryId);
      if (match) {
        setSelectedOrgId(org.organization.organizationId);
        setSelectedLibId(match.libraryId);
        localStorage.setItem('active_org_id', org.organization.organizationId);
        localStorage.setItem('active_lib_id', match.libraryId);
        return;
      }
    }

    // 3. Fallback: just set library ID
    setSelectedLibId(libraryId);
    localStorage.setItem('active_lib_id', libraryId);
  };

  const createOrganization = async (data: CreateOrganizationRequest): Promise<OrganizationDetailsResponse> => {
    setError(null);
    try {
      const created = await api.organizations.create(data);
      await refreshData();
      selectOrganization(created.organization.organizationId);
      return created;
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
      throw err;
    }
  };

  const createLibrary = async (data: CreateLibraryRequest): Promise<LibraryDto> => {
    if (!selectedOrgId) throw new Error('No organization selected');
    setError(null);
    try {
      const created = await api.organizations.createLibrary(selectedOrgId, data);
      await refreshData();
      selectLibrary(created.libraryId);
      return created;
    } catch (err: any) {
      setError(err.message || 'Failed to create library');
      throw err;
    }
  };

  const inviteMember = async (data: InviteMemberRequest) => {
    if (!selectedOrgId) throw new Error('No organization selected');
    setError(null);
    try {
      return await api.organizations.inviteMember(selectedOrgId, data);
    } catch (err: any) {
      setError(err.message || 'Failed to invite member');
      throw err;
    }
  };

  const acceptInvite = async (token: string) => {
    setError(null);
    try {
      const res = await api.organizations.acceptInvite({ token });
      await refreshData();
      selectOrganization(res.organizationId);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
      throw err;
    }
  };

  // Match organization by selectedLibId, or by selectedOrgId
  const currentOrg =
    (selectedLibId
      ? organizations.find((o) => o.libraries.some((l) => l.libraryId === selectedLibId))
      : null) ||
    organizations.find((o) => o.organization.organizationId === selectedOrgId) ||
    organizations[0] ||
    null;

  const currentLibrary =
    currentOrg?.libraries.find((l) => l.libraryId === selectedLibId) ||
    currentOrg?.libraries[0] ||
    null;

  const currentRole = currentOrg?.role || null;

  const activeLibrary =
    myLibraries.find((l) => l.libraryId === selectedLibId) ||
    (currentOrg && currentLibrary
      ? {
          libraryId: currentLibrary.libraryId,
          libraryName: currentLibrary.name,
          librarySlug: currentLibrary.slug,
          organizationId: currentOrg.organization.organizationId,
          organizationName: currentOrg.organization.name,
          organizationSlug: currentOrg.organization.slug,
          role: (currentRole === OrgRole.OWNER
            ? 'OWNER'
            : currentRole === OrgRole.ADMIN
            ? 'ADMIN'
            : 'READER') as 'OWNER' | 'ADMIN' | 'LIBRARIAN' | 'READER',
          status: 'ACTIVE' as const,
          joinedAt: new Date().toISOString(),
        }
      : null) ||
    myLibraries[0] ||
    null;

  const isReaderOnly =
    (organizations.length > 0 && organizations.every((o) => o.role === OrgRole.MEMBER)) ||
    (organizations.length === 0 && myLibraries.length > 0) ||
    (organizations.length === 0 && myLibraries.length === 0);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        organizations,
        currentOrg,
        currentLibrary,
        currentRole,
        myLibraries,
        activeLibrary,
        isReaderOnly,
        login,
        register,
        logout,
        selectOrganization,
        selectLibrary,
        selectActiveLibrary,
        refreshData,
        createOrganization,
        createLibrary,
        inviteMember,
        acceptInvite,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
