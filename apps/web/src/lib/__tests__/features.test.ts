import { isCompetitionsEnabled } from '../features';

describe('isCompetitionsEnabled (TEM-15)', () => {
  const previous = process.env.NEXT_PUBLIC_ENABLE_COMPETITIONS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_COMPETITIONS;
    } else {
      process.env.NEXT_PUBLIC_ENABLE_COMPETITIONS = previous;
    }
  });

  it('is off by default', () => {
    delete process.env.NEXT_PUBLIC_ENABLE_COMPETITIONS;

    expect(isCompetitionsEnabled()).toBe(false);
  });

  it("does not treat a non-'true' value as enabling the module", () => {
    for (const value of ['1', 'TRUE', 'True', 'yes', 'on', 'false', '']) {
      process.env.NEXT_PUBLIC_ENABLE_COMPETITIONS = value;

      expect(isCompetitionsEnabled()).toBe(false);
    }
  });

  it("is enabled by the exact string 'true'", () => {
    process.env.NEXT_PUBLIC_ENABLE_COMPETITIONS = 'true';

    expect(isCompetitionsEnabled()).toBe(true);
  });
});
