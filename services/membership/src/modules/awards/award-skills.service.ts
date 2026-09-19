import { MEMBER_NOUN_LOWER } from '../../common/brand';
import { AwardLevel } from './entities/award-level.entity';
import { UpdateAwardLevelDto } from './dto/award-level.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import {
  criterionSchema,
  criterionUpdateSchema,
  progressionSchema,
  skillAssessmentSchema,
  parseAwardInput,
} from './award-skills.schemas';

export interface SkillCriterion {
  criterion_id: string;
  level_id: string;
  name: string;
  guidance: string | null;
  sort_order: number;
  required: boolean;
  active: boolean;
  version: number;
}
export interface SkillProgress {
  member_id: string;
  criterion_id: string;
  status: 'working_towards' | 'achieved';
  version: number;
  assessed_on: string;
  parent_note: string | null;
}
@Injectable()
export class AwardSkillsService {
  constructor(
    private readonly db: DataSource,
    private readonly tenant: TenantContextService,
  ) {}
  private club() {
    return this.tenant.getClubId();
  }
  async lock(em: EntityManager) {
    await em.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `awards:${this.club()}`,
    ]);
  }
  async level(em: EntityManager, id: string, active = false) {
    const [row] = await em.query(
      `SELECT l.*,s.active AS scheme_active FROM award_levels l JOIN award_schemes s ON s.scheme_id=l.scheme_id AND s.club_id=l.club_id WHERE l.club_id=$1 AND l.level_id=$2 FOR SHARE OF l,s`,
      [this.club(), id],
    );
    if (!row || (active && (!row.active || !row.scheme_active)))
      throw new NotFoundException('Active award level not found');
    return row;
  }
  async criteria(levelId: string): Promise<SkillCriterion[]> {
    await this.level(this.db.manager, levelId);
    return this.db.query(
      'SELECT criterion_id,level_id,name,guidance,sort_order,required,active,version FROM award_criteria WHERE club_id=$1 AND level_id=$2 ORDER BY sort_order,name,criterion_id',
      [this.club(), levelId],
    );
  }
  async createCriterion(levelId: string, body: unknown) {
    const dto = parseAwardInput(criterionSchema, body);
    return this.db.transaction(async (em) => {
      await this.lock(em);
      await this.level(em, levelId, true);
      const [row] = await em.query(
        'INSERT INTO award_criteria(club_id,level_id,name,guidance,sort_order,required,active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [
          this.club(),
          levelId,
          dto.name,
          dto.guidance ?? null,
          dto.sort_order,
          dto.required,
          dto.active,
        ],
      );
      return row;
    });
  }
  async updateCriterion(id: string, body: unknown) {
    const dto = parseAwardInput(criterionUpdateSchema, body);
    return this.db.transaction(async (em) => {
      await this.lock(em);
      const [old] = await em.query(
        'SELECT * FROM award_criteria WHERE club_id=$1 AND criterion_id=$2 FOR UPDATE',
        [this.club(), id],
      );
      if (!old) throw new NotFoundException('Criterion not found');
      if (old.version !== dto.version)
        throw new ConflictException('Criterion changed. Reload before saving.');
      const next = { ...old, ...dto };
      const [row] = await em.query(
        'UPDATE award_criteria SET name=$3,guidance=$4,sort_order=$5,required=$6,active=$7,version=version+1,updated_at=now() WHERE club_id=$1 AND criterion_id=$2 RETURNING *',
        [this.club(), id, next.name, next.guidance, next.sort_order, next.required, next.active],
      );
      return row;
    });
  }
  async setProgression(levelId: string, body: unknown) {
    const dto = parseAwardInput(progressionSchema, body);
    return this.db.transaction(async (em) => {
      await this.lock(em);
      const level = await this.level(em, levelId, true);
      if (dto.next_level_id) {
        const target = await this.level(em, dto.next_level_id, true);
        if (target.scheme_id !== level.scheme_id)
          throw new BadRequestException('Next level must belong to the same scheme');
      }
      await em.query(
        'UPDATE award_levels SET next_level_id=$3,updated_at=now() WHERE club_id=$1 AND level_id=$2',
        [this.club(), levelId, dto.next_level_id],
      );
      await this.validateProgression(em, level.scheme_id);
      return { next_level_id: dto.next_level_id };
    });
  }
  async validateProgression(em: EntityManager, schemeId: string) {
    const rows: { level_id: string; next_level_id: string | null; active: boolean }[] =
      await em.query(
        'SELECT level_id,next_level_id,active FROM award_levels WHERE club_id=$1 AND scheme_id=$2 ORDER BY sort_order,name,level_id',
        [this.club(), schemeId],
      );
    const links = new Map(
      rows.map((r, i) => [
        r.level_id,
        r.next_level_id ?? rows.slice(i + 1).find((n) => n.active)?.level_id ?? null,
      ]),
    );
    for (const row of rows) {
      const seen = new Set<string>();
      let next: string | null = row.level_id;
      while (next) {
        if (seen.has(next)) throw new BadRequestException('Progression cannot contain a cycle');
        seen.add(next);
        next = links.get(next) ?? null;
      }
    }
  }
  async updateLevel(id: string, dto: UpdateAwardLevelDto) {
    return this.db.transaction(async (em) => {
      await this.lock(em);
      const old = await this.level(em, id);
      if (
        dto.fee_structure_id &&
        !(
          await em.query(
            'SELECT fee_structure_id FROM fee_structures WHERE club_id=$1 AND fee_structure_id=$2',
            [this.club(), dto.fee_structure_id],
          )
        ).length
      )
        throw new NotFoundException('Fee structure not found');
      await em.update(AwardLevel, { club_id: this.club(), level_id: id }, dto);
      await this.validateProgression(em, old.scheme_id);
      return (await em.findOneBy(AwardLevel, { club_id: this.club(), level_id: id }))!;
    });
  }
  async roster(em: EntityManager, sessionId?: string, squadId?: string) {
    if (sessionId) {
      const [session] = await em.query(
        'SELECT session_id,squad_id,session_date::text,status FROM sessions WHERE club_id=$1 AND session_id=$2',
        [this.club(), sessionId],
      );
      if (!session) throw new NotFoundException('Session not found');
      const members = await em.query(
        `SELECT member_id,first_name,last_name,family_id FROM members m WHERE m.club_id=$1 AND (m.squad_id=$2 OR EXISTS(SELECT 1 FROM attendance a WHERE a.club_id=$1 AND a.session_id=$3 AND a.member_id=m.member_id)) ORDER BY last_name,first_name,member_id`,
        [this.club(), session.squad_id, sessionId],
      );
      return { session, members };
    }
    if (squadId) {
      const [s] = await em.query('SELECT squad_id FROM squads WHERE club_id=$1 AND squad_id=$2', [
        this.club(),
        squadId,
      ]);
      if (!s) throw new NotFoundException('Class not found');
    }
    const members = await em.query(
      'SELECT member_id,first_name,last_name,family_id FROM members WHERE club_id=$1 AND ($2::uuid IS NULL OR squad_id=$2) ORDER BY last_name,first_name,member_id',
      [this.club(), squadId ?? null],
    );
    return { session: null, members };
  }
  async assessmentContext(levelId: string, sessionId?: string, squadId?: string) {
    const level = await this.level(this.db.manager, levelId, true);
    const roster = await this.roster(this.db.manager, sessionId, squadId);
    const criteria = await this.criteria(levelId);
    const progress: SkillProgress[] = await this.db.query(
      `SELECT p.member_id,p.criterion_id,p.status,p.version,p.assessed_on::text,p.parent_note FROM award_skill_progress p JOIN award_criteria c ON c.club_id=p.club_id AND c.criterion_id=p.criterion_id WHERE p.club_id=$1 AND c.level_id=$2 AND p.member_id=ANY($3::uuid[])`,
      [this.club(), levelId, roster.members.map((m: { member_id: string }) => m.member_id)],
    );
    const levelProgress = await this.db.query(
      'SELECT member_id,status,awarded_on::text,invoice_id IS NOT NULL AS has_invoice FROM member_award_progress WHERE club_id=$1 AND level_id=$2 AND member_id=ANY($3::uuid[])',
      [this.club(), levelId, roster.members.map((m: { member_id: string }) => m.member_id)],
    );
    return { level, ...roster, criteria, progress, level_progress: levelProgress };
  }
  async assess(body: unknown, assessor: string) {
    const dto = parseAwardInput(skillAssessmentSchema, body);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ kind: 'skills', ...dto }))
      .digest('hex');
    return this.db.transaction(async (em) => {
      await this.lock(em);
      const [saved] = await em.query(
        'SELECT fingerprint,result FROM award_requests WHERE club_id=$1 AND request_key=$2',
        [this.club(), dto.request_key],
      );
      if (saved) {
        if (saved.fingerprint !== fingerprint)
          throw new ConflictException('Request key already used for different results');
        return saved.result;
      }
      await this.level(em, dto.level_id, true);
      const [user] = await em.query(
        'SELECT user_id FROM users WHERE club_id=$1 AND user_id=$2 AND active=true',
        [this.club(), assessor],
      );
      if (!user) throw new NotFoundException('Assessor not found');
      const roster = await this.roster(em, dto.session_id, dto.squad_id);
      if (roster.session?.status === 'cancelled')
        throw new BadRequestException('Cannot assess a cancelled session');
      const allowed = new Set(roster.members.map((m: { member_id: string }) => m.member_id));
      const seen = new Set<string>();
      for (const item of dto.results) {
        const key = `${item.member_id}:${item.criterion_id}`;
        if (seen.has(key)) throw new BadRequestException('Duplicate criterion result');
        seen.add(key);
        if (!allowed.has(item.member_id))
          throw new NotFoundException(`Selected ${MEMBER_NOUN_LOWER} is not on this register`);
        const [criterion] = await em.query(
          'SELECT * FROM award_criteria WHERE club_id=$1 AND criterion_id=$2 AND level_id=$3 AND active=true',
          [this.club(), item.criterion_id, dto.level_id],
        );
        if (!criterion) throw new NotFoundException('Active criterion not found');
        if (criterion.version !== item.criterion_version)
          throw new ConflictException('Criterion changed. Reload before assessing.');
        const [old] = await em.query(
          'SELECT version FROM award_skill_progress WHERE club_id=$1 AND member_id=$2 AND criterion_id=$3 FOR UPDATE',
          [this.club(), item.member_id, item.criterion_id],
        );
        if ((old?.version ?? 0) !== item.expected_version)
          throw new ConflictException(
            'Another assessor changed this result. Reload and review the history.',
          );
        const version = (old?.version ?? 0) + 1;
        await em.query(
          `INSERT INTO award_skill_progress(club_id,member_id,criterion_id,status,version,assessed_on,parent_note) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(club_id,member_id,criterion_id) DO UPDATE SET status=EXCLUDED.status,version=EXCLUDED.version,assessed_on=EXCLUDED.assessed_on,parent_note=EXCLUDED.parent_note`,
          [
            this.club(),
            item.member_id,
            item.criterion_id,
            item.status,
            version,
            dto.assessed_on,
            item.parent_note ?? null,
          ],
        );
        await em.query(
          `INSERT INTO award_skill_assessments(club_id,member_id,criterion_id,criterion_name,criterion_guidance,status,assessed_on,assessed_by_user_id,session_id,internal_note,parent_note,progress_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            this.club(),
            item.member_id,
            item.criterion_id,
            criterion.name,
            criterion.guidance,
            item.status,
            dto.assessed_on,
            assessor,
            dto.session_id ?? null,
            item.internal_note ?? null,
            item.parent_note ?? null,
            version,
          ],
        );
        await em.query(
          `INSERT INTO member_award_progress(club_id,member_id,level_id,status,started_on) VALUES($1,$2,$3,'working_towards',$4) ON CONFLICT(member_id,level_id) DO NOTHING`,
          [this.club(), item.member_id, dto.level_id, dto.assessed_on],
        );
      }
      const result = { recorded: dto.results.length, request_key: dto.request_key };
      await em.query(
        'INSERT INTO award_requests(club_id,request_key,fingerprint,result) VALUES($1,$2,$3,$4::jsonb)',
        [this.club(), dto.request_key, fingerprint, JSON.stringify(result)],
      );
      return result;
    });
  }
  async history(memberId: string, levelId: string) {
    await this.level(this.db.manager, levelId);
    return this.db.query(
      `SELECT h.assessment_id,h.criterion_id,h.criterion_name,h.criterion_guidance,h.status,h.assessed_on::text,h.created_at,h.assessed_by_user_id,concat_ws(' ',u.first_name,u.last_name) AS assessor_name,h.session_id,h.internal_note,h.parent_note,h.progress_version FROM award_skill_assessments h LEFT JOIN users u ON u.club_id=h.club_id AND u.user_id=h.assessed_by_user_id JOIN award_criteria c ON c.club_id=h.club_id AND c.criterion_id=h.criterion_id WHERE h.club_id=$1 AND h.member_id=$2 AND c.level_id=$3 ORDER BY h.created_at DESC,h.assessment_id LIMIT 200`,
      [this.club(), memberId, levelId],
    );
  }
  async parentProgress(memberId: string) {
    return this.db.query(
      `SELECT c.criterion_id,c.level_id,c.name,c.guidance,c.required,c.active,p.status,p.assessed_on::text,p.parent_note FROM award_criteria c JOIN award_levels l ON l.club_id=c.club_id AND l.level_id=c.level_id JOIN award_schemes s ON s.club_id=l.club_id AND s.scheme_id=l.scheme_id LEFT JOIN award_skill_progress p ON p.club_id=c.club_id AND p.criterion_id=c.criterion_id AND p.member_id=$2 WHERE c.club_id=$1 AND ((c.active AND l.active AND s.active) OR p.status='achieved') ORDER BY c.sort_order,c.name,c.criterion_id`,
      [this.club(), memberId],
    );
  }
}
