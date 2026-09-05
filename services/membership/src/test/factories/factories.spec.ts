import { buildMember } from './member.factory';
import { buildFamily } from './family.factory';
import { buildSquad } from './squad.factory';
import { buildSession } from './session.factory';
import { buildInvoice } from './invoice.factory';
import { buildPayment } from './payment.factory';
import { buildUser } from './user.factory';
import { buildAttendance } from './attendance.factory';
import { buildDBSCheck } from './dbs-check.factory';
import { buildConsent } from './consent.factory';

describe('Test factories', () => {
  describe('buildMember', () => {
    it('should return an object with member_id and required fields', () => {
      const member = buildMember();
      expect(member.member_id).toBeDefined();
      expect(member.first_name).toBeDefined();
      expect(member.last_name).toBeDefined();
      expect(member.dob).toBeInstanceOf(Date);
      expect(member.gender).toBeDefined();
    });

    it('should accept overrides', () => {
      const member = buildMember({ first_name: 'Alice' });
      expect(member.first_name).toBe('Alice');
    });

    it('should generate unique IDs on successive calls', () => {
      const a = buildMember();
      const b = buildMember();
      expect(a.member_id).not.toBe(b.member_id);
    });
  });

  describe('buildFamily', () => {
    it('should return an object with family_id and required fields', () => {
      const family = buildFamily();
      expect(family.family_id).toBeDefined();
      expect(family.family_name).toBeDefined();
      expect(family.primary_contact_email).toBeDefined();
    });

    it('should accept overrides', () => {
      const family = buildFamily({ family_name: 'Smith' });
      expect(family.family_name).toBe('Smith');
    });
  });

  describe('buildSquad', () => {
    it('should return an object with squad_id and required fields', () => {
      const squad = buildSquad();
      expect(squad.squad_id).toBeDefined();
      expect(squad.squad_name).toBeDefined();
    });

    it('should accept overrides', () => {
      const squad = buildSquad({ max_capacity: 30 });
      expect(squad.max_capacity).toBe(30);
    });
  });

  describe('buildSession', () => {
    it('should return an object with session_id and required fields', () => {
      const session = buildSession();
      expect(session.session_id).toBeDefined();
      expect(session.session_name).toBeDefined();
      expect(session.start_time).toBeDefined();
      expect(session.end_time).toBeDefined();
      expect(session.status).toBeDefined();
    });

    it('should accept overrides', () => {
      const session = buildSession({ location: 'Leisure Centre' });
      expect(session.location).toBe('Leisure Centre');
    });
  });

  describe('buildInvoice', () => {
    it('should return an object with invoice_id and required fields', () => {
      const invoice = buildInvoice();
      expect(invoice.invoice_id).toBeDefined();
      expect(invoice.invoice_number).toBeDefined();
      expect(invoice.total_amount).toBeGreaterThanOrEqual(0);
      expect(invoice.status).toBeDefined();
    });

    it('should accept overrides', () => {
      const invoice = buildInvoice({ total_amount: 100 });
      expect(invoice.total_amount).toBe(100);
    });
  });

  describe('buildPayment', () => {
    it('should return an object with payment_id and required fields', () => {
      const payment = buildPayment();
      expect(payment.payment_id).toBeDefined();
      expect(payment.amount).toBeGreaterThan(0);
      expect(payment.payment_method).toBeDefined();
      expect(payment.status).toBeDefined();
    });

    it('should accept overrides', () => {
      const payment = buildPayment({ amount: 75 });
      expect(payment.amount).toBe(75);
    });
  });

  describe('buildUser', () => {
    it('should return an object with user_id and required fields', () => {
      const user = buildUser();
      expect(user.user_id).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.first_name).toBeDefined();
      expect(user.role).toBeDefined();
    });

    it('should accept overrides', () => {
      const user = buildUser({ email: 'custom@example.co.uk' });
      expect(user.email).toBe('custom@example.co.uk');
    });
  });

  describe('buildAttendance', () => {
    it('should return an object with attendance_id and required fields', () => {
      const attendance = buildAttendance();
      expect(attendance.attendance_id).toBeDefined();
      expect(attendance.session_id).toBeDefined();
      expect(attendance.member_id).toBeDefined();
      expect(attendance.status).toBeDefined();
    });

    it('should accept overrides', () => {
      const attendance = buildAttendance({ notes: 'Late due to traffic' });
      expect(attendance.notes).toBe('Late due to traffic');
    });
  });

  describe('buildDBSCheck', () => {
    it('should return an object with dbs_check_id and required fields', () => {
      const dbs = buildDBSCheck();
      expect(dbs.dbs_check_id).toBeDefined();
      expect(dbs.certificate_number).toBeDefined();
      expect(dbs.check_type).toBeDefined();
      expect(dbs.status).toBeDefined();
      expect(dbs.issue_date).toBeInstanceOf(Date);
    });

    it('should accept overrides', () => {
      const dbs = buildDBSCheck({ is_valid: false });
      expect(dbs.is_valid).toBe(false);
    });
  });

  describe('buildConsent', () => {
    it('should return an object with consent_id and required fields', () => {
      const consent = buildConsent();
      expect(consent.consent_id).toBeDefined();
      expect(consent.member_id).toBeDefined();
      expect(consent.consent_type).toBeDefined();
      expect(consent.status).toBeDefined();
      expect(consent.granted_date).toBeInstanceOf(Date);
    });

    it('should accept overrides', () => {
      const consent = buildConsent({ requires_annual_renewal: true });
      expect(consent.requires_annual_renewal).toBe(true);
    });
  });
});
