import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CompetitionsRepository } from './competitions.repository';
import { PersonalBestsService } from './personal-bests.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { CreateEntryDto } from './dto/create-entry.dto';
import { CreateResultDto } from './dto/create-result.dto';
import { UpdateResultDto } from './dto/update-result.dto';
import { Competition } from './entities/competition.entity';
import { CompetitionEntry } from './entities/competition-entry.entity';
import { CompetitionResult, RelayLeg } from './entities/competition-result.entity';

@Injectable()
export class CompetitionsService {
  private readonly logger = new Logger(CompetitionsService.name);

  constructor(
    private readonly repository: CompetitionsRepository,
    private readonly personalBests: PersonalBestsService,
  ) {}

  async create(dto: CreateCompetitionDto): Promise<Competition> {
    return await this.repository.createCompetition(dto);
  }

  async findAll(): Promise<Competition[]> {
    return await this.repository.findAllCompetitions();
  }

  async findOne(id: string): Promise<Competition> {
    const competition = await this.repository.findCompetitionById(id);
    if (!competition) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }
    return competition;
  }

  async update(id: string, dto: UpdateCompetitionDto): Promise<Competition> {
    await this.findOne(id);
    const updated = await this.repository.updateCompetition(id, dto);
    if (!updated) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repository.removeCompetition(id);
  }

  // --- Entry management ---

  async addEntries(competitionId: string, entries: CreateEntryDto[]): Promise<CompetitionEntry[]> {
    await this.findOne(competitionId);
    return await this.repository.createEntries(competitionId, entries);
  }

  async getEntries(competitionId: string): Promise<CompetitionEntry[]> {
    await this.findOne(competitionId);
    return await this.repository.findEntriesByCompetition(competitionId);
  }

  // --- Results ---

  async getResults(competitionId: string): Promise<CompetitionResult[]> {
    await this.findOne(competitionId);
    return await this.repository.findResultsByCompetition(competitionId);
  }

  async getSwimmerResults(swimmerId: string): Promise<CompetitionResult[]> {
    return await this.repository.findResultsBySwimmer(swimmerId);
  }

  async getSwimmerPersonalBests(swimmerId: string) {
    const [personalBests, seasonBests] = await Promise.all([
      this.personalBests.getForSwimmer(swimmerId),
      this.personalBests.getSeasonBests(swimmerId),
    ]);
    return {
      personalBests,
      seasonBests: seasonBests.bests,
      seasonStart: seasonBests.seasonStart,
    };
  }

  async addResult(competitionId: string, dto: CreateResultDto): Promise<CompetitionResult> {
    const competition = await this.findOne(competitionId);
    const result = await this.repository.createResult({
      ...dto,
      relay_legs: (dto.relay_legs as RelayLeg[] | undefined) ?? null,
      competition_id: competitionId,
      // A time swum at a meet is swum in that meet's pool unless stated.
      course: dto.course ?? competition.course,
      time: dto.dq ? 0 : dto.time,
    });
    await this.personalBests.recomputeForSwimmer(result.swimmer_id);
    return (await this.repository.findResultById(result.result_id)) ?? result;
  }

  async updateResult(
    competitionId: string,
    resultId: string,
    dto: UpdateResultDto,
  ): Promise<CompetitionResult> {
    await this.findOne(competitionId);
    const existing = await this.repository.findResultById(resultId);
    if (!existing || existing.competition_id !== competitionId) {
      throw new NotFoundException(`Result with ID ${resultId} not found`);
    }
    const updated = await this.repository.updateResult(resultId, {
      ...dto,
      relay_legs: (dto.relay_legs as RelayLeg[] | undefined) ?? existing.relay_legs,
    });
    if (!updated) {
      throw new NotFoundException(`Result with ID ${resultId} not found`);
    }
    await this.personalBests.recomputeForSwimmer(existing.swimmer_id);
    return (await this.repository.findResultById(resultId)) ?? updated;
  }

  async removeResult(competitionId: string, resultId: string): Promise<void> {
    await this.findOne(competitionId);
    const existing = await this.repository.findResultById(resultId);
    if (!existing || existing.competition_id !== competitionId) {
      throw new NotFoundException(`Result with ID ${resultId} not found`);
    }
    await this.repository.removeResult(resultId);
    await this.personalBests.recomputeForSwimmer(existing.swimmer_id);
  }
}
