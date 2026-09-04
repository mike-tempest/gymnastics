import {
  AU_STATES,
  BackgroundCheckType,
  COUNTRY_GOVERNING_BODIES,
  GOVERNING_BODY_CONFIG,
  GOVERNING_BODY_LABELS,
  GoverningBody,
  UK_GOVERNING_BODIES,
  checkNoun,
  defaultGoverningBodyForCountry,
  governingBodyConfig,
  orderedBackgroundCheckTypes,
} from '@swim-nexus/shared-types';

describe('GOVERNING_BODY_CONFIG', () => {
  it('covers every governing body with a complete entry', () => {
    for (const body of Object.values(GoverningBody)) {
      const config = GOVERNING_BODY_CONFIG[body];
      expect(config).toBeDefined();
      expect(config.label).toBe(GOVERNING_BODY_LABELS[body]);
      expect(config.country).toMatch(/^[A-Z]{2}$/);
      expect(config.registrationNumberLabel.length).toBeGreaterThan(0);
      expect(config.backgroundCheckFramework.length).toBeGreaterThan(0);
      expect(config.backgroundCheckShortLabel.length).toBeGreaterThan(0);
      expect(config.certificateNumberLabel.length).toBeGreaterThan(0);
      expect(config.backgroundCheckTypes.length).toBeGreaterThan(0);
      expect(config.safeguardingFramework.length).toBeGreaterThan(0);
      expect(config.safeguardingOfficerLabel.length).toBeGreaterThan(0);
      expect(config.dataSharingRecipient.length).toBeGreaterThan(0);
    }
  });

  it('keeps the exact GB strings previously hardcoded across the app', () => {
    const se = GOVERNING_BODY_CONFIG[GoverningBody.SWIM_ENGLAND];
    expect(se.registrationNumberLabel).toBe('SE number');
    expect(se.backgroundCheckFramework).toBe('DBS');
    expect(se.safeguardingFramework).toBe('Wavepower');
    expect(se.dataSharingRecipient).toBe('Swim England');
    expect(se.backgroundCheckTypes.map((t) => t.label)).toEqual([
      'Basic DBS Check',
      'Standard DBS Check',
      'Enhanced DBS Check',
      'Enhanced DBS Check with Barred Lists',
    ]);
  });

  it('keeps the GB-facing new fields on the previous GB wording', () => {
    const se = GOVERNING_BODY_CONFIG[GoverningBody.SWIM_ENGLAND];
    expect(se.backgroundCheckShortLabel).toBe('DBS');
    expect(se.safeguardingOfficerLabel).toBe('Club Welfare Officer');
    expect(GOVERNING_BODY_CONFIG[GoverningBody.SWIM_WALES].safeguardingOfficerLabel).toBe(
      'Club Welfare Officer',
    );
    expect(GOVERNING_BODY_CONFIG[GoverningBody.SCOTTISH_SWIMMING].backgroundCheckShortLabel).toBe(
      'PVG',
    );
  });

  it('gives US clubs SafeSport checks', () => {
    const usa = GOVERNING_BODY_CONFIG[GoverningBody.USA_SWIMMING];
    expect(usa.backgroundCheckTypes.map((t) => t.value)).toEqual([
      BackgroundCheckType.SAFESPORT_CERTIFICATION,
      BackgroundCheckType.BACKGROUND_CHECK,
    ]);
  });

  it('models the eight Australian state and territory schemes', () => {
    const au = GOVERNING_BODY_CONFIG[GoverningBody.SWIMMING_AUSTRALIA];
    expect(au.backgroundCheckTypes).toHaveLength(8);

    const byRegion = new Map(au.backgroundCheckTypes.map((t) => [t.regions?.[0], t]));
    expect(byRegion.get('NSW')).toMatchObject({
      value: BackgroundCheckType.WORKING_WITH_CHILDREN_CHECK,
      label: 'Working With Children Check (NSW)',
      renewalYears: 5,
    });
    expect(byRegion.get('VIC')).toMatchObject({
      value: BackgroundCheckType.WORKING_WITH_CHILDREN_CHECK,
      renewalYears: 5,
    });
    expect(byRegion.get('QLD')).toMatchObject({
      value: BackgroundCheckType.BLUE_CARD,
      label: 'Blue Card (QLD)',
      renewalYears: 3,
    });
    expect(byRegion.get('WA')).toMatchObject({
      value: BackgroundCheckType.WORKING_WITH_CHILDREN_CHECK,
      label: 'Working With Children Check Card (WA)',
      renewalYears: 3,
    });
    expect(byRegion.get('SA')).toMatchObject({
      value: BackgroundCheckType.WORKING_WITH_CHILDREN_CHECK,
      renewalYears: 5,
    });
    expect(byRegion.get('TAS')).toMatchObject({
      value: BackgroundCheckType.RWVP_REGISTRATION,
      label: 'Registration to Work with Vulnerable People (TAS)',
      renewalYears: 3,
    });
    expect(byRegion.get('ACT')).toMatchObject({
      value: BackgroundCheckType.WWVP_REGISTRATION,
      renewalYears: 3,
    });
    expect(byRegion.get('NT')).toMatchObject({
      value: BackgroundCheckType.OCHRE_CARD,
      label: 'Ochre Card (NT)',
      renewalYears: 2,
    });

    expect(au.backgroundCheckShortLabel).toBe('WWCC');
    expect(au.certificateNumberLabel).toBe('Card or application number');
    expect(au.safeguardingFramework).toBe('Safe Sport');
    expect(au.safeguardingOfficerLabel).toBe('Member Protection Information Officer (MPIO)');
  });

  it('models British Gymnastics per the compliance brief', () => {
    const bg = GOVERNING_BODY_CONFIG[GoverningBody.BRITISH_GYMNASTICS];
    expect(bg.label).toBe('British Gymnastics');
    expect(bg.country).toBe('GB');
    expect(bg.registrationNumberLabel).toBe('BG membership number');
    expect(bg.backgroundCheckFramework).toBe('DBS');
    expect(bg.backgroundCheckShortLabel).toBe('DBS');
    expect(bg.certificateNumberLabel).toBe('Certificate number');
    expect(bg.safeguardingFramework).toBe('Safeguarding and Protecting Children Policy');
    expect(bg.safeguardingOfficerLabel).toBe('Welfare Officer');
    expect(bg.dataSharingRecipient).toBe('British Gymnastics');
    // DBS types for England and Wales, plus the Scottish and Northern Irish
    // home-nation schemes.
    expect(bg.backgroundCheckTypes.map((t) => t.label)).toEqual([
      'Basic DBS Check',
      'Standard DBS Check',
      'Enhanced DBS Check',
      'Enhanced DBS Check with Barred Lists',
      'PVG Scheme Membership (Scotland)',
      'AccessNI Check (Northern Ireland)',
    ]);
    expect(bg.backgroundCheckTypes.map((t) => t.value)).toEqual([
      BackgroundCheckType.BASIC,
      BackgroundCheckType.STANDARD,
      BackgroundCheckType.ENHANCED,
      BackgroundCheckType.ENHANCED_BARRED,
      BackgroundCheckType.BACKGROUND_CHECK,
      BackgroundCheckType.CRIMINAL_RECORD_CHECK,
    ]);
  });
});

describe('AU_STATES', () => {
  it('lists all eight states and territories with codes matching check regions', () => {
    expect(AU_STATES.map((s) => s.code)).toEqual([
      'NSW',
      'VIC',
      'QLD',
      'WA',
      'SA',
      'TAS',
      'ACT',
      'NT',
    ]);
    const au = GOVERNING_BODY_CONFIG[GoverningBody.SWIMMING_AUSTRALIA];
    const stateCodes = new Set(AU_STATES.map((s) => s.code));
    for (const type of au.backgroundCheckTypes) {
      for (const region of type.regions ?? []) {
        expect(stateCodes.has(region)).toBe(true);
      }
    }
  });
});

describe('checkNoun', () => {
  it('leaves GB framework names untouched', () => {
    expect(checkNoun('DBS')).toBe('DBS');
    expect(checkNoun('PVG')).toBe('PVG');
    expect(checkNoun('SafeSport')).toBe('SafeSport');
  });

  it('strips a trailing Check so composed copy never doubles it', () => {
    expect(checkNoun('Working With Children Check')).toBe('Working With Children');
    expect(`${checkNoun('Working With Children Check')} checks`).toBe(
      'Working With Children checks',
    );
    expect(`${checkNoun('DBS')} checks`).toBe('DBS checks');
  });
});

describe('orderedBackgroundCheckTypes', () => {
  const au = GOVERNING_BODY_CONFIG[GoverningBody.SWIMMING_AUSTRALIA];

  it('puts the club state first without hiding interstate checks', () => {
    const ordered = orderedBackgroundCheckTypes(au, 'QLD');
    expect(ordered[0].label).toBe('Blue Card (QLD)');
    expect(ordered).toHaveLength(au.backgroundCheckTypes.length);
  });

  it('returns the configured order without a region or for an unknown region', () => {
    expect(orderedBackgroundCheckTypes(au, null)).toEqual(au.backgroundCheckTypes);
    expect(orderedBackgroundCheckTypes(au, 'ZZZ')).toEqual(au.backgroundCheckTypes);
    const se = GOVERNING_BODY_CONFIG[GoverningBody.SWIM_ENGLAND];
    expect(orderedBackgroundCheckTypes(se, 'London')).toEqual(se.backgroundCheckTypes);
  });
});

describe('UK_GOVERNING_BODIES', () => {
  it('contains exactly the four UK bodies', () => {
    expect(UK_GOVERNING_BODIES).toEqual([
      GoverningBody.SWIM_ENGLAND,
      GoverningBody.SCOTTISH_SWIMMING,
      GoverningBody.SWIM_WALES,
      GoverningBody.BRITISH_GYMNASTICS,
    ]);
  });
});

describe('COUNTRY_GOVERNING_BODIES', () => {
  it('resolves a default body for every supported country', () => {
    expect(defaultGoverningBodyForCountry('GB')).toBe(GoverningBody.SWIM_ENGLAND);
    expect(defaultGoverningBodyForCountry('US')).toBe(GoverningBody.USA_SWIMMING);
    expect(defaultGoverningBodyForCountry('CA')).toBe(GoverningBody.SWIMMING_CANADA);
    expect(defaultGoverningBodyForCountry('AU')).toBe(GoverningBody.SWIMMING_AUSTRALIA);
    expect(defaultGoverningBodyForCountry('IE')).toBe(GoverningBody.SWIM_IRELAND);
  });

  it('falls back to Swim England for unknown or missing countries', () => {
    expect(defaultGoverningBodyForCountry('FR')).toBe(GoverningBody.SWIM_ENGLAND);
    expect(defaultGoverningBodyForCountry(undefined)).toBe(GoverningBody.SWIM_ENGLAND);
  });

  it('lists British Gymnastics for GB clubs after the swimming bodies', () => {
    expect(COUNTRY_GOVERNING_BODIES.GB).toEqual([
      GoverningBody.SWIM_ENGLAND,
      GoverningBody.SCOTTISH_SWIMMING,
      GoverningBody.SWIM_WALES,
      GoverningBody.BRITISH_GYMNASTICS,
    ]);
    // The GB default stays pinned to Swim England: defaultGoverningBodyForCountry
    // returns the first entry, so British Gymnastics must be appended last.
    expect(defaultGoverningBodyForCountry('GB')).toBe(GoverningBody.SWIM_ENGLAND);
  });

  it('only lists bodies whose config country matches', () => {
    for (const [country, bodies] of Object.entries(COUNTRY_GOVERNING_BODIES)) {
      for (const body of bodies) {
        expect(GOVERNING_BODY_CONFIG[body].country).toBe(country);
      }
    }
  });
});

describe('governingBodyConfig', () => {
  it('returns the matching config for a valid body string', () => {
    expect(governingBodyConfig('USA_SWIMMING').label).toBe('USA Swimming');
    expect(governingBodyConfig('BRITISH_GYMNASTICS').label).toBe('British Gymnastics');
  });

  it('falls back to Swim England for null, undefined or unknown values', () => {
    expect(governingBodyConfig(null).label).toBe('Swim England');
    expect(governingBodyConfig(undefined).label).toBe('Swim England');
    expect(governingBodyConfig('NOT_A_BODY').label).toBe('Swim England');
  });
});
