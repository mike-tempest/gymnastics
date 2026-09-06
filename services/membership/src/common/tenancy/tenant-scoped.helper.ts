import { Injectable } from '@nestjs/common';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { TenantContextService } from './tenant-context.service';

/**
 * Tenant-scoped query helper.
 *
 * Every tenant-owned table has a `club_id` column (Phase 1). This helper
 * automatically injects `club_id = <active tenant>` into reads and stamps it
 * onto writes, so Phase 3 module services never have to remember to add the
 * filter by hand. The active club comes from CLS via TenantContextService.
 *
 * Inject it alongside a TypeORM repository, then route reads/writes through it:
 *
 * ```ts
 * @Injectable()
 * export class MembersService {
 *   constructor(
 *     @InjectRepository(Member) private readonly repo: Repository<Member>,
 *     private readonly scoped: TenantScopedHelper,
 *   ) {}
 *
 *   // SELECT ... WHERE club_id = :clubId AND active = true
 *   findActive() {
 *     return this.scoped.scopedFind(this.repo, { where: { active: true } });
 *   }
 *
 *   // SELECT ... WHERE club_id = :clubId AND member_id = :id
 *   findOne(id: string) {
 *     return this.scoped.scopedFindOne(this.repo, { where: { member_id: id } });
 *   }
 *
 *   // Query builder pre-filtered to the active club
 *   search(term: string) {
 *     return this.scoped
 *       .scopedQueryBuilder(this.repo, 's')
 *       .andWhere('s.last_name ILIKE :term', { term: `%${term}%` })
 *       .getMany();
 *   }
 *
 *   // INSERT ... with club_id set from the active tenant
 *   create(dto: CreateMemberDto) {
 *     const entity = this.scoped.stampCreate<Member>(dto);
 *     return this.repo.save(entity);
 *   }
 * }
 * ```
 *
 * All methods throw (via TenantContextService.getClubId) if invoked outside an
 * authenticated, tenant-scoped request. Do not use it on public routes.
 */
@Injectable()
export class TenantScopedHelper {
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * find() restricted to the active tenant. Merges `club_id` into any caller
   * supplied `where` (object form).
   */
  async scopedFind<T extends ObjectLiteral>(
    repo: Repository<T>,
    options: FindManyOptions<T> = {},
  ): Promise<T[]> {
    return repo.find({ ...options, where: this.scopedWhere(options.where) });
  }

  /**
   * findOne() restricted to the active tenant.
   */
  async scopedFindOne<T extends ObjectLiteral>(
    repo: Repository<T>,
    options: FindOneOptions<T>,
  ): Promise<T | null> {
    return repo.findOne({ ...options, where: this.scopedWhere(options.where) });
  }

  /**
   * A SelectQueryBuilder pre-filtered to the active tenant via
   * `WHERE <alias>.club_id = :clubId`. Chain further `.andWhere(...)` calls.
   */
  scopedQueryBuilder<T extends ObjectLiteral>(
    repo: Repository<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    return repo
      .createQueryBuilder(alias)
      .where(`${alias}.club_id = :clubId`, { clubId: this.tenantContext.getClubId() });
  }

  /**
   * Returns a copy of `entityLike` with `club_id` set to the active tenant,
   * ready to be passed to `repo.create()` / `repo.save()`.
   */
  stampCreate<T extends ObjectLiteral>(entityLike: DeepPartial<T>): DeepPartial<T> {
    return {
      ...entityLike,
      club_id: this.tenantContext.getClubId(),
    } as DeepPartial<T>;
  }

  /**
   * Merge `club_id = <active tenant>` into a find options `where`. Supports both
   * the object form and the array-of-conditions form. The return type mirrors
   * the input `where` type for the relevant entity.
   */
  private scopedWhere<W>(where: W): W {
    const clubId = this.tenantContext.getClubId();

    if (Array.isArray(where)) {
      return where.map((condition) => ({ ...condition, club_id: clubId })) as W;
    }

    return { ...(where as object), club_id: clubId } as W;
  }
}
