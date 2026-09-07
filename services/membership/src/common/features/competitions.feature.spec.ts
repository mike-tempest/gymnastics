import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { competitionsEnabled, CompetitionsEnabledGuard } from './competitions.feature';
import { ParentController } from '../../modules/parent/parent.controller';

describe('competitions feature flag (TEM-15)', () => {
  const previous = process.env.ENABLE_COMPETITIONS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.ENABLE_COMPETITIONS;
    } else {
      process.env.ENABLE_COMPETITIONS = previous;
    }
  });

  describe('competitionsEnabled', () => {
    it('is off by default', () => {
      delete process.env.ENABLE_COMPETITIONS;

      expect(competitionsEnabled()).toBe(false);
    });

    it("does not treat a non-'true' value as enabling the module", () => {
      for (const value of ['1', 'TRUE', 'True', 'yes', 'on', 'false', '']) {
        process.env.ENABLE_COMPETITIONS = value;

        expect(competitionsEnabled()).toBe(false);
      }
    });

    it("is enabled by the exact string 'true'", () => {
      process.env.ENABLE_COMPETITIONS = 'true';

      expect(competitionsEnabled()).toBe(true);
    });
  });

  describe('CompetitionsEnabledGuard', () => {
    it('404s while the flag is off', () => {
      delete process.env.ENABLE_COMPETITIONS;

      expect(() => new CompetitionsEnabledGuard().canActivate()).toThrow(NotFoundException);
    });

    it('allows the request while the flag is on', () => {
      process.env.ENABLE_COMPETITIONS = 'true';

      expect(new CompetitionsEnabledGuard().canActivate()).toBe(true);
    });
  });

  describe('parent portal route gating', () => {
    it('guards the results and personal-bests routes with CompetitionsEnabledGuard', () => {
      for (const handler of ['getChildResults', 'getChildPersonalBests'] as const) {
        const guards: unknown[] =
          Reflect.getMetadata('__guards__', ParentController.prototype[handler]) ?? [];

        expect(guards).toContain(CompetitionsEnabledGuard);
      }
    });
  });

  describe('ParentModule composition', () => {
    // The flag is read at module-composition time, so each case re-requires
    // the module in an isolated registry after setting the environment.
    function importedModuleNames(): string[] {
      let names: string[] = [];
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ParentModule } = require('../../modules/parent/parent.module');
        const imports: unknown[] = Reflect.getMetadata('imports', ParentModule) ?? [];
        names = imports
          .filter((entry): entry is { name: string } => typeof entry === 'function')
          .map((entry) => entry.name);
      });
      return names;
    }

    it('leaves CompetitionsModule out by default', () => {
      delete process.env.ENABLE_COMPETITIONS;

      expect(importedModuleNames()).not.toContain('CompetitionsModule');
    });

    it('imports CompetitionsModule when the flag is on', () => {
      process.env.ENABLE_COMPETITIONS = 'true';

      expect(importedModuleNames()).toContain('CompetitionsModule');
    });
  });
});
