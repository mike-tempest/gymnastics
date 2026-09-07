import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';

// Role hierarchy: admin-level roles have access to coach and parent resources too
const ADMIN_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.TREASURER];
const COACH_ROLES: string[] = [
  UserRole.HEAD_COACH,
  UserRole.SQUAD_COACH,
  UserRole.WELFARE_OFFICER,
  UserRole.COMPETITION_SECRETARY,
];
const PARENT_ROLES: string[] = [UserRole.PARENT, UserRole.MEMBER_ADULT];

function hasRoleAccess(userRole: string, requiredRole: UserRole): boolean {
  // Direct match
  if (userRole === requiredRole) return true;

  // Admin-level roles have access to everything
  if (ADMIN_ROLES.includes(userRole)) return true;

  // Coach-level roles satisfy coach and parent requirements
  if (
    COACH_ROLES.includes(userRole) &&
    (COACH_ROLES.includes(requiredRole) || PARENT_ROLES.includes(requiredRole))
  )
    return true;

  return false;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => hasRoleAccess(user.role, role));
  }
}
