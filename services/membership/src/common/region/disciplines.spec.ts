/**
 * Completeness cover for the gymnastics discipline data in shared-types, kept
 * beside governing-body-config.spec.ts because both guard governing-body
 * reference data that copy and reporting quote verbatim.
 */
import {
  DISCIPLINE_LABELS,
  DISCIPLINE_SHORT_LABELS,
  Discipline,
  ORDERED_DISCIPLINES,
  PROGRAMME_FLAG_LABELS,
  ProgrammeFlag,
  SQUAD_TYPE_LABELS,
  SquadType,
  disciplineLabel,
  isDiscipline,
  isProgrammeFlag,
  isSquadType,
} from '@club-manager/shared-types';

describe('Discipline', () => {
  it('covers every discipline with a full and a short label', () => {
    for (const discipline of Object.values(Discipline)) {
      expect(DISCIPLINE_LABELS[discipline]).toBeDefined();
      expect(DISCIPLINE_LABELS[discipline].length).toBeGreaterThan(0);
      expect(DISCIPLINE_SHORT_LABELS[discipline]).toBeDefined();
      expect(DISCIPLINE_SHORT_LABELS[discipline].length).toBeGreaterThan(0);
    }
  });

  it('holds the ten core British Gymnastics disciplines', () => {
    expect(Object.values(Discipline)).toHaveLength(10);
    expect(ORDERED_DISCIPLINES).toHaveLength(10);
    expect([...ORDERED_DISCIPLINES].sort()).toEqual([...Object.values(Discipline)].sort());
  });

  // These are the names British Gymnastics uses, per section 7 of
  // docs/01-British-Gymnastics-Compliance-Brief.md. Compliance copy and club
  // reporting quote them verbatim, so they are asserted exactly.
  it('labels each discipline with the exact British Gymnastics name', () => {
    expect(ORDERED_DISCIPLINES.map((d) => DISCIPLINE_LABELS[d])).toEqual([
      "Women's Artistic Gymnastics",
      "Men's Artistic Gymnastics",
      'Rhythmic Gymnastics',
      'Trampoline',
      'Double Mini Trampoline',
      'Tumbling',
      'Acrobatic Gymnastics',
      'TeamGym',
      'Aerobic Gymnastics',
      'Disability Gymnastics',
    ]);
  });

  it('keeps the short labels clubs actually say', () => {
    expect(DISCIPLINE_SHORT_LABELS[Discipline.WOMENS_ARTISTIC]).toBe('WAG');
    expect(DISCIPLINE_SHORT_LABELS[Discipline.MENS_ARTISTIC]).toBe('MAG');
    expect(DISCIPLINE_SHORT_LABELS[Discipline.DOUBLE_MINI_TRAMPOLINE]).toBe('DMT');
  });

  it('gives every label a distinct value', () => {
    const labels = Object.values(DISCIPLINE_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('narrows only real discipline values', () => {
    expect(isDiscipline(Discipline.TUMBLING)).toBe(true);
    expect(isDiscipline('TUMBLING')).toBe(true);
    expect(isDiscipline('tumbling')).toBe(false);
    expect(isDiscipline('VAULT')).toBe(false);
    expect(isDiscipline(undefined)).toBe(false);
    expect(isDiscipline(null)).toBe(false);
  });

  it('falls back to a dash when no discipline is recorded', () => {
    expect(disciplineLabel(Discipline.TEAMGYM)).toBe('TeamGym');
    expect(disciplineLabel(null)).toBe('-');
    expect(disciplineLabel(undefined)).toBe('-');
  });
});

describe('ProgrammeFlag', () => {
  it('covers every programme flag with a label', () => {
    for (const flag of Object.values(ProgrammeFlag)) {
      expect(PROGRAMME_FLAG_LABELS[flag]).toBeDefined();
      expect(PROGRAMME_FLAG_LABELS[flag].length).toBeGreaterThan(0);
    }
  });

  it('holds pre-school, adult and parkour, and no disciplines', () => {
    expect(Object.values(ProgrammeFlag)).toEqual(['PRE_SCHOOL', 'ADULT', 'PARKOUR']);
    expect(PROGRAMME_FLAG_LABELS[ProgrammeFlag.PRE_SCHOOL]).toBe('Pre-school');
    expect(PROGRAMME_FLAG_LABELS[ProgrammeFlag.ADULT]).toBe('Adult');
    expect(PROGRAMME_FLAG_LABELS[ProgrammeFlag.PARKOUR]).toBe('Parkour');

    // Programmes are not disciplines: the two lists must not overlap.
    const disciplines = new Set<string>(Object.values(Discipline));
    for (const flag of Object.values(ProgrammeFlag)) {
      expect(disciplines.has(flag)).toBe(false);
    }
  });

  it('narrows only real programme flags', () => {
    expect(isProgrammeFlag('ADULT')).toBe(true);
    expect(isProgrammeFlag('TEAMGYM')).toBe(false);
    expect(isProgrammeFlag('')).toBe(false);
  });
});

describe('SquadType', () => {
  it('covers both squad types with a label', () => {
    for (const type of Object.values(SquadType)) {
      expect(SQUAD_TYPE_LABELS[type]).toBeDefined();
      expect(SQUAD_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });

  it('separates the recreational base from the competitive pathway', () => {
    expect(Object.values(SquadType)).toEqual(['recreational', 'competitive']);
    expect(SQUAD_TYPE_LABELS[SquadType.RECREATIONAL]).toBe('Recreational');
    expect(SQUAD_TYPE_LABELS[SquadType.COMPETITIVE]).toBe('Competitive');
  });

  it('narrows only real squad types', () => {
    expect(isSquadType('recreational')).toBe(true);
    expect(isSquadType('competitive')).toBe(true);
    expect(isSquadType('RECREATIONAL')).toBe(false);
    expect(isSquadType('elite')).toBe(false);
  });
});

describe('storage widths', () => {
  // The entity columns are varchar(40) for discipline and varchar(20) for
  // squad_type. Values are stored as written here, so a longer member would be
  // truncated or rejected at insert time.
  it('keeps every stored value inside its column', () => {
    for (const discipline of Object.values(Discipline)) {
      expect(discipline.length).toBeLessThanOrEqual(40);
    }
    for (const flag of Object.values(ProgrammeFlag)) {
      expect(flag.length).toBeLessThanOrEqual(40);
    }
    for (const type of Object.values(SquadType)) {
      expect(type.length).toBeLessThanOrEqual(20);
    }
  });
});
