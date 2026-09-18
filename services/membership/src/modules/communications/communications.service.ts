import { Injectable, NotFoundException } from '@nestjs/common';
import { CommunicationsRepository } from './communications.repository';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { Communication } from './entities/communication.entity';
import { OperationalMessagesService } from '../notification-deliveries/operational-messages.service';

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly communicationsRepository: CommunicationsRepository,
    private readonly messages: OperationalMessagesService,
  ) {}

  async create(createCommunicationDto: CreateCommunicationDto): Promise<Communication> {
    return this.messages.broadcast(createCommunicationDto);
  }

  async findAll(): Promise<Communication[]> {
    return await this.communicationsRepository.findAll();
  }

  async findOne(id: string): Promise<Communication> {
    const communication = await this.communicationsRepository.findOne(id);
    if (!communication) {
      throw new NotFoundException(`Communication with ID ${id} not found`);
    }
    return communication;
  }
}
