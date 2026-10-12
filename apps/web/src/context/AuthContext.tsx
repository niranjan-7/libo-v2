import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  UserDto,
  OrgRole,
  OrganizationDetailsResponse,
  LibraryDto,
  CreateOrganizationRequest,
  CreateLibraryRequest,
  InviteMemberRequest,
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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  selectOrganization: (orgId: string) => void;
  selectLibrary: (libraryId: string) => void;
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
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => localStorage.getItem('active_org_id'));
  const [selectedLibId, setSelectedLibId] = useState<string | null>(() => localStorage.getItem('active_lib_id'));

  const clearError = () => setError(null);

  const refreshData = useCallback(async () => {
    try {
      const meResponse = await api.auth.getMe();
      setUser(meResponse.user);

      const orgsList = await api.organizations.getAll();
      setOrganizations(orgsList);

      if (orgsList.length > 0) {
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

  const currentOrg = organizations.find((o) => o.organization.organizationId === selectedOrgId) || null;
  const currentLibrary = currentOrg?.libraries.find((l) => l.libraryId === selectedLibId) || currentOrg?.libraries[0] || null;
  const currentRole = currentOrg?.role || null;

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
        login,
        register,
        logout,
        selectOrganization,
        selectLibrary,
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
