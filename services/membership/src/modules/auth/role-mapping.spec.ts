import { mapRole } from './role-mapping';
import { UserRole } from '../users/entities/user.entity';

describe('mapRole', () => {
  it('maps uppercase frontend labels to the lowercase enum', () => {
    expect(mapRole('PARENT')).toBe(UserRole.PARENT);
    expect(mapRole('COACH')).toBe(UserRole.SQUAD_COACH);
    expect(mapRole('ADMIN')).toBe(UserRole.SUPER_ADMIN);
  });

  it('is case-insensitive on frontend labels', () => {
    expect(mapRole('parent')).toBe(UserRole.PARENT);
    expect(mapRole('Coach')).toBe(UserRole.SQUAD_COACH);
    expect(mapRole('  ADMIN  ')).toBe(UserRole.SUPER_ADMIN);
  });

  it('passes through values that are already valid enum members', () => {
    expect(mapRole('super_admin')).toBe(UserRole.SUPER_ADMIN);
    expect(mapRole('head_coach')).toBe(UserRole.HEAD_COACH);
    expect(mapRole('treasurer')).toBe(UserRole.TREASURER);
  });

  it('returns undefined for unknown or empty values', () => {
    expect(mapRole(undefined)).toBeUndefined();
    expect(mapRole(null)).toBeUndefined();
    expect(mapRole('')).toBeUndefined();
    expect(mapRole('NOT_A_ROLE')).toBeUndefined();
  });
});
