import { loginAs, authGet, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers';

describe('Data Integrity API', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  it('All members belong to valid squads', async () => {
    const membersRes = await authGet('/members', adminToken);
    expect(membersRes.status).toBe(200);
    const members = await membersRes.json();

    const squadsRes = await authGet('/squads', adminToken);
    expect(squadsRes.status).toBe(200);
    const squads = await squadsRes.json();

    const validSquadIds = new Set(squads.map((s: any) => s.squad_id));

    for (const member of members) {
      if (member.squad_id) {
        expect(validSquadIds.has(member.squad_id)).toBe(true);
      }
    }
  });

  it('All members belong to valid families', async () => {
    const membersRes = await authGet('/members', adminToken);
    expect(membersRes.status).toBe(200);
    const members = await membersRes.json();

    const familiesRes = await authGet('/families', adminToken);
    expect(familiesRes.status).toBe(200);
    const families = await familiesRes.json();

    const validFamilyIds = new Set(families.map((f: any) => f.family_id));

    for (const member of members) {
      if (member.family_id) {
        expect(validFamilyIds.has(member.family_id)).toBe(true);
      }
    }
  });

  it('All invoices reference valid families', async () => {
    const invoicesRes = await authGet('/invoices', adminToken);
    expect(invoicesRes.status).toBe(200);
    const invoices = await invoicesRes.json();

    const familiesRes = await authGet('/families', adminToken);
    expect(familiesRes.status).toBe(200);
    const families = await familiesRes.json();

    const validFamilyIds = new Set(families.map((f: any) => f.family_id));

    for (const invoice of invoices) {
      if (invoice.family_id) {
        expect(validFamilyIds.has(invoice.family_id)).toBe(true);
      }
    }
  });

  it('All attendance records reference valid sessions and members', async () => {
    const attendanceRes = await authGet('/attendance', adminToken);
    expect(attendanceRes.status).toBe(200);
    const attendance = await attendanceRes.json();

    const sessionsRes = await authGet('/sessions', adminToken);
    expect(sessionsRes.status).toBe(200);
    const sessions = await sessionsRes.json();

    const membersRes = await authGet('/members', adminToken);
    expect(membersRes.status).toBe(200);
    const members = await membersRes.json();

    const validSessionIds = new Set(sessions.map((s: any) => s.session_id));
    const validMemberIds = new Set(members.map((s: any) => s.member_id));

    for (const record of attendance) {
      if (record.session_id) {
        expect(validSessionIds.has(record.session_id)).toBe(true);
      }
      if (record.member_id) {
        expect(validMemberIds.has(record.member_id)).toBe(true);
      }
    }
  });

  it('All sessions have valid squad_ids', async () => {
    const sessionsRes = await authGet('/sessions', adminToken);
    expect(sessionsRes.status).toBe(200);
    const sessions = await sessionsRes.json();

    const squadsRes = await authGet('/squads', adminToken);
    expect(squadsRes.status).toBe(200);
    const squads = await squadsRes.json();

    const validSquadIds = new Set(squads.map((s: any) => s.squad_id));

    for (const session of sessions) {
      if (session.squad_id) {
        expect(validSquadIds.has(session.squad_id)).toBe(true);
      }
    }
  });
});
