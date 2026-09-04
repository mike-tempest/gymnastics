import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantScopedHelper } from './tenant-scoped.helper';

/**
 * Global tenancy module.
 *
 * Exposes TenantContextService (active club_id from CLS) and TenantScopedHelper
 * (tenant-scoped query/insert helpers) to every other module without needing
 * to import this module explicitly. The CLS store and the TenantInterceptor
 * that populates it are wired up in app.module.ts.
 */
@Global()
@Module({
  providers: [TenantContextService, TenantScopedHelper],
  exports: [TenantContextService, TenantScopedHelper],
})
export class TenantModule {}
