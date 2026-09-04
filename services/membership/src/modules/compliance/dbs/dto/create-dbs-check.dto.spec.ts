import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDBSCheckDto } from './create-dbs-check.dto';
import { DBSCheckType } from '../entities/dbs-check.entity';

// The check_type validation is driven by the shared BackgroundCheckType enum
// (aliased as DBSCheckType), so it must accept the international values as well
// as the original GB ones now that the module is framework-aware.
describe('CreateDBSCheckDto check_type validation', () => {
  const base = {
    user_id: '11111111-1111-1111-1111-111111111111',
    certificate_number: 'CERT-001',
    issue_date: '2024-01-01',
  };

  const build = (checkType: unknown) =>
    plainToInstance(CreateDBSCheckDto, { ...base, check_type: checkType });

  it.each([
    DBSCheckType.BASIC,
    DBSCheckType.STANDARD,
    DBSCheckType.ENHANCED,
    DBSCheckType.ENHANCED_BARRED,
    DBSCheckType.SAFESPORT_CERTIFICATION,
    DBSCheckType.BACKGROUND_CHECK,
    DBSCheckType.CRIMINAL_RECORD_CHECK,
    DBSCheckType.VULNERABLE_SECTOR_CHECK,
    DBSCheckType.WORKING_WITH_CHILDREN_CHECK,
    DBSCheckType.GARDA_VETTING,
  ])('accepts the %s check type', async (checkType) => {
    const errors = await validate(build(checkType));
    const checkTypeErrors = errors.filter((error) => error.property === 'check_type');
    expect(checkTypeErrors).toHaveLength(0);
  });

  it('rejects an unknown check type', async () => {
    const errors = await validate(build('NOT_A_REAL_CHECK'));
    const checkTypeErrors = errors.filter((error) => error.property === 'check_type');
    expect(checkTypeErrors).toHaveLength(1);
  });
});
