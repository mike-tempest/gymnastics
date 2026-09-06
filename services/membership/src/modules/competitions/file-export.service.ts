import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CompetitionsRepository } from './competitions.repository';
import { MembersRepository } from '../members/members.repository';
import { ClubsService } from '../clubs/clubs.service';
import { ParserFactory } from '../../parsers/parser-factory';
import {
  FileFormat,
  ParsedMeetData,
  ParsedEntry,
  ParsedMember,
} from '../../parsers/parser.interface';

@Injectable()
export class FileExportService {
  private readonly logger = new Logger(FileExportService.name);

  constructor(
    private readonly repository: CompetitionsRepository,
    private readonly membersRepository: MembersRepository,
    private readonly clubsService: ClubsService,
  ) {}

  /**
   * Generate an entry file for a competition in the specified format.
   * Retrieves entries from the database, resolves member details,
   * and produces a formatted file string.
   */
  async generateEntryFile(
    competitionId: string,
    format: FileFormat = FileFormat.HY3,
  ): Promise<{ fileName: string; content: string }> {
    // Load competition and entries
    const competition = await this.repository.findCompetitionById(competitionId);
    if (!competition) {
      throw new NotFoundException(`Competition with ID ${competitionId} not found`);
    }

    const entries = await this.repository.findEntriesByCompetition(competitionId);
    if (entries.length === 0) {
      throw new NotFoundException('No entries found for this competition');
    }

    // Resolve member details
    const memberIds = [...new Set(entries.map((e) => e.member_id))];
    const members = await Promise.all(memberIds.map((id) => this.membersRepository.findOne(id)));
    const memberMap = new Map(members.filter(Boolean).map((s) => [s!.member_id, s!]));

    // Build parsed data structure
    const parsedEntries: ParsedEntry[] = [];
    for (const entry of entries) {
      const member = memberMap.get(entry.member_id);
      if (!member) continue;

      const parsedMember: ParsedMember = {
        registrationNumber: member.registration_number || '0000000',
        lastName: member.last_name,
        firstName: member.first_name,
        gender: member.gender as 'M' | 'F',
        dateOfBirth: new Date(member.dob),
      };

      parsedEntries.push({
        member: parsedMember,
        eventName: entry.event_name || undefined,
        distance: entry.distance,
        stroke: entry.stroke,
        entryTime: entry.entry_time ? Number(entry.entry_time) : 0,
        seedTime: entry.seed_time ? Number(entry.seed_time) : undefined,
      });
    }

    // The club's country drives the C1 team-record country code (mapped to
    // Hy-Tek's ISO alpha-3 form by the parser; GBR for GB clubs, AUS for AU).
    const club = await this.clubsService.findCurrent();

    const meetData: ParsedMeetData = {
      meetName: competition.name,
      meetDate: new Date(competition.start_date),
      venue: competition.venue || undefined,
      country: club.country || undefined,
      entries: parsedEntries,
      results: [],
    };

    // Generate file
    const parser = ParserFactory.getParser(format);
    const content = parser.generateEntryFile(meetData);

    // File extension
    const ext = format === FileFormat.HY3 ? 'hy3' : 'csv';
    const safeName = competition.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const fileName = `${safeName}-entries.${ext}`;

    this.logger.log(
      `Generated ${format} entry file for competition ${competitionId} (${entries.length} entries)`,
    );

    return { fileName, content };
  }
}
