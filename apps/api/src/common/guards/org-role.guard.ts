import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrgRole } from '@library/contracts';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { ORG_ROLES_KEY } from '../decorators/require-org-role.decorator';

@Injectable()
export class OrgRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(OrgMembershipEntity)
    private readonly membershipRepo: Repository<OrgMembershipEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('Access denied: User is not authenticated');
    }

    const orgId = request.params?.orgId || request.params?.id || request.body?.organizationId;
    if (!orgId) {
      throw new BadRequestException('Organization identifier is required for this operation');
    }

    const membership = await this.membershipRepo.findOne({
      where: {
        organization_id: orgId,
        user_id: user.userId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Access denied: You are not a member of this organization');
    }

    if (membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Access denied: Your membership is inactive in this organization');
    }

    // If specific roles are specified, enforce deny-by-default role check
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(membership.role);
      if (!hasRole) {
        throw new ForbiddenException(
          `Access denied: Required role (${requiredRoles.join(', ')}) not satisfied by current role (${membership.role})`,
        );
      }
    }

    request.orgMembership = membership;
    request.orgRole = membership.role;
    return true;
  }
}
