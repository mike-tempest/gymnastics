import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ApiKeyCreatedResponse, ApiKeySummary } from '@club-manager/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { UuidParam } from '../../common/validation/parse-uuid.pipe';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

interface AuthenticatedRequest {
  user?: { user_id?: string };
}

/**
 * Key management for club admins (TEM-32).
 *
 * This is an internal, JWT-authenticated surface, not part of the published
 * read API, so it is excluded from the OpenAPI document. Minting a credential
 * that can read a club's whole membership is an administrative act: only
 * super admins may do it, which is a deliberately narrower grant than the
 * read routes the key itself unlocks.
 */
@ApiExcludeController()
@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  /**
   * Mints a key. The response is the only time the plaintext credential
   * exists outside the caller's own client, so the UI warns before showing it
   * and offers no way to fetch it again.
   */
  @Post()
  create(
    @Body() dto: CreateApiKeyDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<ApiKeyCreatedResponse> {
    return this.apiKeysService.create(dto, req.user?.user_id ?? null);
  }

  /** Lists this club's keys by prefix and label. Never returns a secret. */
  @Get()
  findAll(): Promise<ApiKeySummary[]> {
    return this.apiKeysService.findAll();
  }

  /**
   * Revokes a key. Modelled as DELETE because that is what it means to the
   * caller, but the row is retained with revoked_at set so the audit trail of
   * what once had access to this club survives.
   */
  @Delete(':apiKeyId')
  revoke(@Param('apiKeyId', UuidParam) apiKeyId: string): Promise<ApiKeySummary> {
    return this.apiKeysService.revoke(apiKeyId);
  }
}
