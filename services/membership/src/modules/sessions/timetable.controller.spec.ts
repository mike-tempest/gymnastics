import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { TimetableController } from './timetable.controller';
import { SessionsController } from './sessions.controller';
import { EditOccurrenceDto } from './dto/timetable.dto';

describe('timetable access boundaries', () => {
  const guard = new RolesGuard(new Reflector());
  it.each([UserRole.PARENT, UserRole.SQUAD_COACH, UserRole.WELFARE_OFFICER, UserRole.TREASURER])(
    'rejects %s on timetable and legacy session edits',
    (role) => {
      for (const [controller, handler] of [
        [TimetableController, TimetableController.prototype.edit],
        [TimetableController, TimetableController.prototype.commit],
        [TimetableController, TimetableController.prototype.list],
        [SessionsController, SessionsController.prototype.update],
      ]) {
        expect(
          guard.canActivate({
            getClass: () => controller,
            getHandler: () => handler,
            switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
          } as unknown as ExecutionContext),
        ).toBe(false);
      }
    },
  );
  it.each([UserRole.SUPER_ADMIN, UserRole.HEAD_COACH])('permits %s', (role) => {
    expect(
      guard.canActivate({
        getClass: () => TimetableController,
        getHandler: () => TimetableController.prototype.edit,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      } as unknown as ExecutionContext),
    ).toBe(true);
  });
  it('rejects a missing edit definition before calling the service', async () => {
    await expect(
      new ValidationPipe({ transform: true, whitelist: true }).transform(
        { scope: 'one' },
        { type: 'body', metatype: EditOccurrenceDto },
      ),
    ).rejects.toThrow('Bad Request');
  });
});
