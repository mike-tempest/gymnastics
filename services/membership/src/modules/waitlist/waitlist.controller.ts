import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Public()
  @Post()
  async join(@Body() dto: CreateWaitlistDto) {
    return this.waitlistService.create(dto);
  }

  @Public()
  @Get('count')
  async getCount() {
    const count = await this.waitlistService.count();
    return { count };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    return this.waitlistService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post('process-drips')
  async processDrips() {
    return this.waitlistService.processDrips();
  }
}
