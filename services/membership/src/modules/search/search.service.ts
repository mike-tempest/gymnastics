import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

export interface SearchResult {
  id: string;
  kind: 'member' | 'family' | 'session';
  title: string;
  detail: string;
  href: string;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly tenant: TenantContextService,
  ) {}

  async search(
    query: string,
    user: Pick<User, 'role' | 'family_id' | 'club_id'>,
  ): Promise<{ results: SearchResult[]; truncated: boolean }> {
    const club = this.tenant.getClubId();
    if (club !== user.club_id) return { results: [], truncated: false };
    const admin = [UserRole.SUPER_ADMIN, UserRole.TREASURER].includes(user.role);
    const coach = [UserRole.HEAD_COACH, UserRole.SQUAD_COACH].includes(user.role);
    const parent = user.role === UserRole.PARENT;
    const welfare = user.role === UserRole.WELFARE_OFFICER;
    if (!(admin || coach || welfare || (parent && user.family_id)))
      return { results: [], truncated: false };
    const term = query.trim();
    if (term.length < 2) return { results: [], truncated: false };
    // Treat wildcard characters as literal search text. Values never form SQL.
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    const parameters = [club, pattern, parent ? user.family_id : null];
    const tasks: Promise<SearchResult[]>[] = [];
    tasks.push(
      this.db.query(
        `SELECT m.member_id AS id, 'member' AS kind,
      concat_ws(' ', m.first_name, m.last_name) AS title,
      concat_ws(' · ', s.squad_name, 'Ref ' || left(m.member_id::text, 8)) AS detail,
      $4 || m.member_id::text AS href
      FROM members m LEFT JOIN squads s ON s.squad_id = m.squad_id AND s.club_id = m.club_id
      WHERE m.club_id = $1 AND ($3::uuid IS NULL OR m.family_id = $3)
        AND concat_ws(' ', m.first_name, m.last_name) ILIKE $2
      ORDER BY lower(m.last_name), lower(m.first_name), m.member_id LIMIT 6`,
        [...parameters, parent ? '/parent/children/' : '/members/'],
      ),
    );
    if (admin || parent) {
      tasks.push(
        this.db.query(
          `SELECT f.family_id AS id, 'family' AS kind, f.family_name AS title,
        concat_ws(' · ', f.primary_contact_name, 'Ref ' || left(f.family_id::text, 8)) AS detail,
        CASE WHEN $3::uuid IS NULL THEN '/families/' || f.family_id::text ELSE '/parent/settings' END AS href
        FROM families f WHERE f.club_id = $1 AND ($3::uuid IS NULL OR f.family_id = $3)
        AND (f.family_name ILIKE $2 OR f.primary_contact_name ILIKE $2)
        ORDER BY lower(f.family_name), f.family_id LIMIT 6`,
          parameters,
        ),
      );
    }
    if (admin || coach || parent) {
      tasks.push(
        this.db.query(
          `SELECT s.session_id AS id, 'session' AS kind, s.session_name AS title,
        to_char(s.session_date, 'DD/MM/YYYY') || ' ' || to_char(s.start_time, 'HH24:MI') || ' · ' || s.status AS detail,
        CASE WHEN $3::uuid IS NULL THEN '/sessions/' || s.session_id::text
        ELSE '/parent/children/' || (SELECT min(m.member_id::text) FROM members m
          WHERE m.club_id = s.club_id AND m.family_id = $3 AND m.squad_id = s.squad_id) || '#session-' || s.session_id::text END AS href
        FROM sessions s WHERE s.club_id = $1 AND s.session_name ILIKE $2
        AND ($3::uuid IS NULL OR (s.session_date >= CURRENT_DATE AND s.session_date <= CURRENT_DATE + 30
          AND EXISTS (SELECT 1 FROM members m WHERE m.club_id = s.club_id AND m.family_id = $3 AND m.squad_id = s.squad_id)))
        ORDER BY s.session_date DESC, s.start_time, s.session_id LIMIT 6`,
          parameters,
        ),
      );
    }
    const groups = await Promise.all(tasks);
    return {
      results: groups.flatMap((group) => group.slice(0, 5)),
      truncated: groups.some((group) => group.length > 5),
    };
  }
}
