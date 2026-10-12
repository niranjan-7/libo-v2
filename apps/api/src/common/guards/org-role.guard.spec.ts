import { ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { OrgRole } from '@library/contracts';
import { OrgRoleGuard } from './org-role.guard';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';

describe('OrgRoleGuard Unit Tests', () => {
  let guard: OrgRoleGuard;
  let reflector: jest.Mocked<Reflector>;
  let membershipRepo: jest.Mocked<Repository<OrgMembershipEntity>>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    membershipRepo = {
      findOne: jest.fn(),
    } as any;

    guard = new OrgRoleGuard(reflector, membershipRepo);
  });

  const createMockContext = (user: any, params: any = {}, body: any = {}): ExecutionContext => {
    const request = {
      user,
      params,
      body,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('should throw ForbiddenException if user is not authenticated', async () => {
    const context = createMockContext(null, { orgId: 'org-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException if orgId is missing from request', async () => {
    const context = createMockContext({ userId: 'user-1' }, {}, {});

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should throw ForbiddenException if user has no membership in organization (deny by default)', async () => {
    membershipRepo.findOne.mockResolvedValue(null);
    const context = createMockContext({ userId: 'user-1' }, { orgId: 'org-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(membershipRepo.findOne).toHaveBeenCalledWith({
      where: { organization_id: 'org-1', user_id: 'user-1' },
    });
  });

  it('should throw ForbiddenException if user membership is inactive', async () => {
    membershipRepo.findOne.mockResolvedValue({
      organization_id: 'org-1',
      user_id: 'user-1',
      role: OrgRole.MEMBER,
      status: 'SUSPENDED',
    } as OrgMembershipEntity);

    const context = createMockContext({ userId: 'user-1' }, { orgId: 'org-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow access if user is member and no specific roles are required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const mockMembership = {
      organization_id: 'org-1',
      user_id: 'user-1',
      role: OrgRole.MEMBER,
      status: 'ACTIVE',
    } as OrgMembershipEntity;

    membershipRepo.findOne.mockResolvedValue(mockMembership);
    const context = createMockContext({ userId: 'user-1' }, { orgId: 'org-1' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    const req = context.switchToHttp().getRequest();
    expect(req.orgMembership).toBe(mockMembership);
  });

  it('should allow access if user has one of required roles (e.g. OWNER when OWNER or ADMIN required)', async () => {
    reflector.getAllAndOverride.mockReturnValue([OrgRole.OWNER, OrgRole.ADMIN]);
    const mockMembership = {
      organization_id: 'org-1',
      user_id: 'user-1',
      role: OrgRole.OWNER,
      status: 'ACTIVE',
    } as OrgMembershipEntity;

    membershipRepo.findOne.mockResolvedValue(mockMembership);
    const context = createMockContext({ userId: 'user-1' }, { orgId: 'org-1' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny access (throw ForbiddenException) if user has MEMBER role when OWNER or ADMIN is required', async () => {
    reflector.getAllAndOverride.mockReturnValue([OrgRole.OWNER, OrgRole.ADMIN]);
    const mockMembership = {
      organization_id: 'org-1',
      user_id: 'user-1',
      role: OrgRole.MEMBER,
      status: 'ACTIVE',
    } as OrgMembershipEntity;

    membershipRepo.findOne.mockResolvedValue(mockMembership);
    const context = createMockContext({ userId: 'user-1' }, { orgId: 'org-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
