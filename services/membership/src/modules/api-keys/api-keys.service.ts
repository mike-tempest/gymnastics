import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ApiKeyCreatedResponse, ApiKeyScope, ApiKeySummary } from '@club-manager/shared-types';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { ApiKey } from './entities/api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { generateApiKey, parseApiKey, verifyApiKeySecret } from './api-key-crypto';

/**
 * How stale `last_used_at` is allowed to get before the guard writes it again.
 *
 * A write on every request would put an UPDATE in front of every read the API
 * serves. "Last used" only needs to answer "is this key still in use", so a
 * minute of slack costs nothing and removes almost all of that write load.
 */
const LAST_USED_WRITE_INTERVAL_MS = 60_000;

/**
 * The subset of a key row that authentication needs. Deliberately does not
 * carry `key_hash`, so nothing downstream of verification can leak it.
 */
export interface AuthenticatedApiKey {
  api_key_id: string;
  club_id: string;
  key_prefix: string;
  scopes: ApiKeyScope[];
}

/**
 * Management and verification of club-scoped read API keys (TEM-32).
 *
 * Two very different jobs live here, and the difference matters:
 *
 *  - The management methods run on ordinary authenticated admin requests, so
 *    they go through TenantScopedHelper like every other module.
 *  - `authenticate` runs *before* any tenant context exists, because
 *    establishing that context is its whole purpose. It is therefore the one
 *    place that reads api_keys unscoped, by unique prefix, and it is named to
 *    say so.
 *
 * Nothing in this class logs a raw key or a hash.
 */
@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    @InjectRepository(ApiKey) private readonly repo: Repository<ApiKey>,
    private readonly scoped: TenantScopedHelper,
  ) {}

  /**
   * Mints a key for the active club. The plaintext credential is in the
   * response and nowhere else: only its prefix and digest are stored, so this
   * is the single moment it can be captured.
   */
  async create(
    dto: CreateApiKeyDto,
    createdByUserId: string | null,
  ): Promise<ApiKeyCreatedResponse> {
    const generated = generateApiKey();

    const entity = this.repo.create(
      this.scoped.stampCreate<ApiKey>({
        key_prefix: generated.prefix,
        key_hash: generated.hash,
        label: dto.label,
        scopes: dto.scopes,
        created_by_user_id: createdByUserId,
        last_used_at: null,
        revoked_at: null,
      }),
    );

    const saved = await this.repo.save(entity);

    return {
      api_key: ApiKeysService.toSummary(saved),
      plaintext_key: generated.plaintext,
    };
  }

  /** Every key belonging to the active club, revoked ones included. */
  async findAll(): Promise<ApiKeySummary[]> {
    const rows = await this.scoped.scopedFind(this.repo, {
      order: { created_at: 'DESC' },
    });
    return rows.map(ApiKeysService.toSummary);
  }

  /**
   * Revokes a key belonging to the active club. The row survives so the audit
   * trail of what once had access does too. Revoking an already-revoked key
   * keeps the original timestamp rather than moving it.
   */
  async revoke(apiKeyId: string): Promise<ApiKeySummary> {
    const existing = await this.scoped.scopedFindOne(this.repo, {
      where: { api_key_id: apiKeyId },
    });

    if (!existing) {
      // A key belonging to another club is not-found here, never forbidden:
      // a 403 would confirm the id exists somewhere.
      throw new NotFoundException('API key not found');
    }

    if (existing.revoked_at) {
      return ApiKeysService.toSummary(existing);
    }

    existing.revoked_at = new Date();
    const saved = await this.repo.save(existing);
    return ApiKeysService.toSummary(saved);
  }

  /**
   * Verifies a presented credential and returns the key it belongs to, or
   * null if it is malformed, unknown or revoked.
   *
   * There is no cache in front of this lookup. One indexed SELECT per request
   * is cheap, and it makes revocation take effect on the very next request
   * rather than whenever a cache entry happens to expire. That immediacy is
   * worth more than the round trip.
   *
   * Unscoped by necessity: this call is what decides which tenant the request
   * belongs to, so there is no tenant to scope it by yet. The lookup is by a
   * unique prefix, so it can only ever resolve one row.
   */
  async authenticate(presentedKey: string): Promise<AuthenticatedApiKey | null> {
    const parsed = parseApiKey(presentedKey);
    if (!parsed) {
      return null;
    }

    const row = await this.repo.findOne({
      where: { key_prefix: parsed.prefix, revoked_at: IsNull() },
    });

    if (!row) {
      // Still burn a comparison against a dummy digest so an unknown prefix
      // and a known prefix with a wrong secret take a similar amount of work.
      verifyApiKeySecret(parsed.secret, '0'.repeat(64));
      return null;
    }

    if (!verifyApiKeySecret(parsed.secret, row.key_hash)) {
      return null;
    }

    this.touchLastUsed(row);

    return {
      api_key_id: row.api_key_id,
      club_id: row.club_id,
      key_prefix: row.key_prefix,
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
    };
  }

  /**
   * Records that a key was used, without the request waiting on it.
   *
   * Deliberately not awaited and deliberately throttled: see
   * LAST_USED_WRITE_INTERVAL_MS. A failure here must never fail the read the
   * caller actually asked for, so it is swallowed into a log line that
   * mentions only the non-secret prefix.
   */
  private touchLastUsed(row: ApiKey): void {
    const now = Date.now();
    const lastUsed = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
    if (now - lastUsed < LAST_USED_WRITE_INTERVAL_MS) {
      return;
    }

    void this.repo
      .update({ api_key_id: row.api_key_id }, { last_used_at: new Date(now) })
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not record last_used_at for API key ${row.key_prefix}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      });
  }

  /**
   * Projects a row to the shape the API returns. The hash is dropped here,
   * which is why every read path goes through it.
   */
  private static toSummary(row: ApiKey): ApiKeySummary {
    return {
      api_key_id: row.api_key_id,
      club_id: row.club_id,
      key_prefix: row.key_prefix,
      label: row.label,
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
      created_by_user_id: row.created_by_user_id ?? null,
      created_at: new Date(row.created_at).toISOString(),
      last_used_at: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
      revoked_at: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    };
  }
}
