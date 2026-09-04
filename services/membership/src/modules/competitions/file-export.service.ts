import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CompetitionsRepository } from './competitions.repository';
import { SwimmersRepository } from '../swimmers/swimmers.repository';
import { ClubsService } from '../clubs/clubs.service';
import { ParserFactory } from '../../parsers/parser-factory';
import {
  FileFormat,
  ParsedMeetData,
  ParsedEntry,
  ParsedSwimmer,
} from '../../parsers/parser.interface';

@Injectable()
export class FileExportService {
  private readonly logger = new Logger(FileExportService.name);

  constructor(
    private readonly repository: CompetitionsRepository,
    private readonly swimmersRepository: SwimmersRepository,
    private readonly clubsService: ClubsService,
  ) {}

  /**
   * Generate an entry file for a competition in the specified format.
   * Retrieves entries from the database, resolves swimmer details,
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

    // Resolve swimmer details
    const swimmerIds = [...new Set(entries.map((e) => e.swimmer_id))];
    const swimmers = await Promise.all(swimmerIds.map((id) => this.swimmersRepository.findOne(id)));
    const swimmerMap = new Map(swimmers.filter(Boolean).map((s) => [s!.swimmer_id, s!]));

    // Build parsed data structure
    const parsedEntries: ParsedEntry[] = [];
    for (const entry of entries) {
      const swimmer = swimmerMap.get(entry.swimmer_id);
      if (!swimmer) continue;

      const parsedSwimmer: ParsedSwimmer = {
        seNumber: swimmer.se_number || '0000000',
        lastName: swimmer.last_name,
        firstName: swimmer.first_name,
        gender: swimmer.gender as 'M' | 'F',
        dateOfBirth: new Date(swimmer.dob),
      };

      parsedEntries.push({
        swimmer: parsedSwimmer,
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
