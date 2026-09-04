export { useApi, useMutation } from './useApi';
export type { UseApiResult, UseMutationResult } from './useApi';

export { useSwimmers, useSwimmer, useSwimmerStats } from './useSwimmers';
export { useSquads, useSquad, useSquadSwimmers } from './useSquads';
export { useSessions, useSessionDetail, useUpcomingSessions, useSessionsBySquad } from './useSessions';
export { useSessionAttendance, useSwimmerAttendance, useSwimmerAttendanceStats } from './useAttendance';
export { useFamilies, useFamily, useFamilyStats } from './useFamilies';
export { useAdminDashboard, useAdminReports, useClubSettings } from './useAdmin';
export { useFinanceDashboard, useInvoices, useOverdueInvoices } from './useFinance';

export { useAuth } from './useAuth';
export { useRole, isAdmin, isCoach, isParent, isAdminOrCoach } from './useRole';
