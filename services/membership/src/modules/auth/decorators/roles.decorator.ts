import { applyDecorators, SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Use explicit membership for sensitive actions, without the coach hierarchy. */
export const ExactRoles = (...roles: UserRole[]) =>
  applyDecorators(Roles(...roles), SetMetadata('exactRoles', true));
