import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { MEMBER_NOUN_LOWER } from '../../common/brand';
import { SquadCapacityEvents } from '../../common/capacity/squad-capacity.events';
import { MemberFilters, MembersRepository } from './members.repository';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { Member } from './entities/member.entity';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly membersRepository: MembersRepository,
    private readonly capacityEvents: SquadCapacityEvents,
  ) {}

  async create(createMemberDto: CreateMemberDto): Promise<Member> {
    try {
      return await this.membersRepository.create(createMemberDto);
    } catch (error: unknown) {
      if (error instanceof Object && 'code' in error && error.code === '23505') {
        // Unique constraint violation
        throw new BadRequestException(
          `A ${MEMBER_NOUN_LOWER} with this registration number already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Lists members for the active club. Supplied filters compose: family,
   * squad and discipline all narrow the same query rather than picking one
   * branch, so a caller can ask for the WAG gymnasts in one squad.
   */
  async findAll(filters: MemberFilters = {}): Promise<Member[]> {
    return await this.membersRepository.findAll(filters);
  }

  async findOne(id: string): Promise<Member> {
    const member = await this.membersRepository.findOne(id);
    if (!member) {
      throw new NotFoundException(`Member with ID ${id} not found`);
    }
    return member;
  }

  async findByFamilyId(familyId: string): Promise<Member[]> {
    return await this.membersRepository.findByFamilyId(familyId);
  }

  async findByClubId(clubId: string): Promise<Member[]> {
    return await this.membersRepository.findByClubId(clubId);
  }

  async findBySquadId(squadId: string): Promise<Member[]> {
    return await this.membersRepository.findBySquadId(squadId);
  }

  async update(id: string, updateMemberDto: UpdateMemberDto): Promise<Member> {
    const before = await this.findOne(id); // This will throw if not found

    try {
      const updated = await this.membersRepository.update(id, updateMemberDto);
      if (!updated) {
        throw new NotFoundException(`Member with ID ${id} not found`);
      }
      // Moving to a different squad leaves a place behind in the old one, so
      // the waiting list gets a chance to fill it.
      if (
        updateMemberDto.squad_id !== undefined &&
        before.squad_id &&
        updateMemberDto.squad_id !== before.squad_id
      ) {
        await this.capacityEvents.emitPlaceMayHaveOpened(before.squad_id);
      }
      return updated;
    } catch (error: unknown) {
      if (error instanceof Object && 'code' in error && error.code === '23505') {
        throw new BadRequestException(
          `A ${MEMBER_NOUN_LOWER} with this registration number already exists`,
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const member = await this.findOne(id); // This will throw if not found
    await this.membersRepository.remove(id);
    // A departing member frees their place for whoever is next on the list.
    await this.capacityEvents.emitPlaceMayHaveOpened(member.squad_id);
  }

  async getStatistics() {
    const total = await this.membersRepository.count();
    return {
      total,
    };
  }

  /**
   * Bulk create members with validation per row.
   * Processes each member individually and collects errors.
   * Returns successfully created members and any errors encountered.
   */
  async bulkCreate(createMemberDtos: CreateMemberDto[]): Promise<{
    created: Member[];
    errors: Array<{ row: number; message: string }>;
  }> {
    const created: Member[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    // Process each member individually to handle validation errors gracefully
    for (let i = 0; i < createMemberDtos.length; i++) {
      try {
        const member = await this.create(createMemberDtos[i]);
        created.push(member);
      } catch (error: unknown) {
        errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : `Failed to create ${MEMBER_NOUN_LOWER}`,
        });
      }
    }

    return { created, errors };
  }
}
