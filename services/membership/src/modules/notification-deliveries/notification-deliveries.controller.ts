import { Transform, Type } from 'class-transformer';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsString, IsUUID, Length, IsInt, Min, Max, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationDeliveriesService } from './notification-deliveries.service';
import { NotificationSource } from './notification-deliveries.types';

class ListDeliveriesDto {
  @IsIn(['session_cancellation', 'broadcast'])
  source_type: NotificationSource;
  @IsUUID()
  source_id: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  page: number = 0;
}
class FollowUpDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 1000)
  note: string;
}
type Actor = { user_id: string; role: string; roles?: Array<{ role: string }> };
export function assertDeliveryAccess(user: Actor, source: NotificationSource): void {
  const permitted =
    source === 'session_cancellation'
      ? ['super_admin', 'head_coach', 'squad_coach']
      : ['super_admin', 'head_coach'];
  if (!permitted.includes(user.role)) throw new ForbiddenException();
}
@Controller('notification-deliveries')
@UseGuards(JwtAuthGuard)
export class NotificationDeliveriesController {
  constructor(private readonly deliveries: NotificationDeliveriesService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListDeliveriesDto, @Request() req: { user: Actor }) {
    assertDeliveryAccess(req.user, query.source_type);
    return this.deliveries.list(query.source_type, query.source_id, query.page);
  }
  @Post(':id/retry')
  async retry(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: Actor }) {
    const row = await this.deliveries.find(id);
    assertDeliveryAccess(req.user, row.source_type);
    await this.deliveries.retry(id);
    return { success: true };
  }
  @Patch(':id/follow-up')
  async followUp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FollowUpDto,
    @Request() req: { user: Actor },
  ) {
    const row = await this.deliveries.find(id);
    assertDeliveryAccess(req.user, row.source_type);
    await this.deliveries.followUp(id, dto.note.trim(), req.user.user_id);
    return { success: true };
  }
}
