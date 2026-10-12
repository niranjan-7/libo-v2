import { SetMetadata } from '@nestjs/common';
import { OrgRole } from '@library/contracts';

export const ORG_ROLES_KEY = 'org_roles';
export const RequireOrgRole = (...roles: OrgRole[]) => SetMetadata(ORG_ROLES_KEY, roles);
