export { useApi, useMutation } from './useApi';
export type { UseApiResult, UseMutationResult } from './useApi';

export { useMembers, useMember, useMemberStats } from './useMembers';
export { useSquads, useSquad, useSquadMembers } from './useSquads';
export { useSessions, useSessionDetail, useUpcomingSessions, useSessionsBySquad } from './useSessions';
export { useSessionAttendance, useMemberAttendance, useMemberAttendanceStats } from './useAttendance';
export { useFamilies, useFamily, useFamilyStats } from './useFamilies';
export { useAdminDashboard, useAdminReports } from './useAdmin';
export { useFinanceDashboard, useInvoices, useOverdueInvoices } from './useFinance';

export { useAuth } from './useAuth';
export { useRole, isAdmin, isCoach, isParent, isAdminOrCoach } from './useRole';
