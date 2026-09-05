import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

/**
 * Whether the swimming times/strokes competitions module is enabled.
 *
 * OFF by default (TEM-15): the module is swimming-only and stays in the tree
 * for a possible future gymnastics scoring module, but ships disabled. Only
 * the exact string 'true' enables it, matching the strict comparison used by
 * LEGACY_GOCARDLESS_ENV_FALLBACK.
 *
 * Read from process.env rather than ConfigService because AppModule and
 * ParentModule consult it at module-composition time, before Nest's injector
 * exists. ParentModule's decorator evaluates during import hoisting, before
 * ConfigModule.forRoot() runs, so main.ts preloads .env files first via
 * config/env.preload.ts; without that preload the two modules could disagree.
 */
export function competitionsEnabled(): boolean {
  return process.env.ENABLE_COMPETITIONS === 'true';
}

/**
 * Guards routes that only make sense while the competitions module is on
 * (the parent portal's results and personal-bests endpoints). With the flag
 * off the routes 404, indistinguishable from not existing at all.
 */
@Injectable()
export class CompetitionsEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!competitionsEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
