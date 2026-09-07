import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentOutcomeResult, AwardProgressStatus } from '@club-manager/shared-types';
import { AwardsController } from './awards.controller';
import { AwardsService } from './awards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';

describe('AwardsController', () => {
  let controller: AwardsController;

  const mockAwardsService = {
    listSchemes: jest.fn(),
    getScheme: jest.fn(),
    createScheme: jest.fn(),
    updateScheme: jest.fn(),
    removeScheme: jest.fn(),
    installDefaultSchemes: jest.fn(),
    createLevel: jest.fn(),
    updateLevel: jest.fn(),
    removeLevel: jest.fn(),
    getMemberProgress: jest.fn(),
    getProgressForMembers: jest.fn(),
    setProgress: jest.fn(),
    recordAssessment: jest.fn(),
    listEvents: jest.fn(),
    getEvent: jest.fn(),
    exportRiseCsv: jest.fn(),
    previewRiseImport: jest.fn(),
    importRiseCsv: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AwardsController],
      providers: [{ provide: AwardsService, useValue: mockAwardsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AwardsController>(AwardsController);
  });

  describe('schemes', () => {
    it('lists active schemes by default', async () => {
      await controller.listSchemes();
      expect(mockAwardsService.listSchemes).toHaveBeenCalledWith(false);
    });

    it('includes inactive schemes when the query says so', async () => {
      await controller.listSchemes('true');
      expect(mockAwardsService.listSchemes).toHaveBeenCalledWith(true);
    });

    it('installs the starter schemes', async () => {
      await controller.installDefaults();
      expect(mockAwardsService.installDefaultSchemes).toHaveBeenCalled();
    });

    it('passes a scheme update straight through', async () => {
      await controller.updateScheme('scheme-1', { active: false });
      expect(mockAwardsService.updateScheme).toHaveBeenCalledWith('scheme-1', { active: false });
    });
  });

  describe('progress', () => {
    it('reads one gymnast progress', async () => {
      await controller.getMemberProgress('member-1');
      expect(mockAwardsService.getMemberProgress).toHaveBeenCalledWith('member-1');
    });

    it('splits a comma separated member id list', async () => {
      await controller.getProgressForMembers('member-1,member-2');
      expect(mockAwardsService.getProgressForMembers).toHaveBeenCalledWith([
        'member-1',
        'member-2',
      ]);
    });

    it('handles a missing member id list', async () => {
      await controller.getProgressForMembers();
      expect(mockAwardsService.getProgressForMembers).toHaveBeenCalledWith([]);
    });

    it('sets a single progress row', async () => {
      const dto = {
        member_id: 'member-1',
        level_id: 'level-1',
        status: AwardProgressStatus.WORKING_TOWARDS,
      };
      await controller.setProgress(dto);
      expect(mockAwardsService.setProgress).toHaveBeenCalledWith(dto);
    });
  });

  describe('assessments', () => {
    it('passes the authenticated coach id to the service', async () => {
      const dto = {
        level_id: 'level-1',
        assessed_at: '2026-09-01',
        outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
      };

      await controller.recordAssessment(dto, { user: { user_id: 'coach-9' } });

      expect(mockAwardsService.recordAssessment).toHaveBeenCalledWith(dto, 'coach-9');
    });

    it('copes with a request that carries no user', async () => {
      const dto = {
        level_id: 'level-1',
        assessed_at: '2026-09-01',
        outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
      };

      await controller.recordAssessment(dto, {});

      expect(mockAwardsService.recordAssessment).toHaveBeenCalledWith(dto, undefined);
    });

    it('ignores a non-numeric limit rather than passing NaN down', async () => {
      await controller.listAssessments('level-1', 'lots');
      expect(mockAwardsService.listEvents).toHaveBeenCalledWith('level-1', undefined);
    });

    it('passes a numeric limit through', async () => {
      await controller.listAssessments(undefined, '10');
      expect(mockAwardsService.listEvents).toHaveBeenCalledWith(undefined, 10);
    });
  });

  describe('Rise CSV bridge', () => {
    it('exports with the scheme filter and assessed flag', async () => {
      await controller.exportRiseCsv('scheme-1', 'true');
      expect(mockAwardsService.exportRiseCsv).toHaveBeenCalledWith({
        schemeId: 'scheme-1',
        includeAssessed: true,
      });
    });

    it('defaults the assessed flag to false', async () => {
      await controller.exportRiseCsv();
      expect(mockAwardsService.exportRiseCsv).toHaveBeenCalledWith({
        schemeId: undefined,
        includeAssessed: false,
      });
    });

    it('previews an import without writing', async () => {
      await controller.previewRiseImport({ csv: 'first_name\nAva' });
      expect(mockAwardsService.previewRiseImport).toHaveBeenCalled();
      expect(mockAwardsService.importRiseCsv).not.toHaveBeenCalled();
    });

    it('applies an import', async () => {
      await controller.importRiseCsv({ csv: 'first_name\nAva' });
      expect(mockAwardsService.importRiseCsv).toHaveBeenCalled();
    });
  });

  describe('route authorisation', () => {
    /** Reads the @Roles metadata a route handler carries. */
    function rolesFor(handler: keyof AwardsController): UserRole[] {
      return Reflect.getMetadata('roles', AwardsController.prototype[handler]) ?? [];
    }

    it('restricts scheme management to an admin', () => {
      expect(rolesFor('createScheme')).toEqual([UserRole.SUPER_ADMIN]);
      expect(rolesFor('updateScheme')).toEqual([UserRole.SUPER_ADMIN]);
      expect(rolesFor('removeScheme')).toEqual([UserRole.SUPER_ADMIN]);
      expect(rolesFor('createLevel')).toEqual([UserRole.SUPER_ADMIN]);
      expect(rolesFor('installDefaults')).toEqual([UserRole.SUPER_ADMIN]);
    });

    it('lets coaches assess and award', () => {
      expect(rolesFor('recordAssessment')).toEqual([
        UserRole.SUPER_ADMIN,
        UserRole.HEAD_COACH,
        UserRole.SQUAD_COACH,
      ]);
      expect(rolesFor('setProgress')).toContain(UserRole.SQUAD_COACH);
    });

    it('lets coaches read the catalogue and progress', () => {
      expect(rolesFor('listSchemes')).toContain(UserRole.SQUAD_COACH);
      expect(rolesFor('getMemberProgress')).toContain(UserRole.HEAD_COACH);
      expect(rolesFor('exportRiseCsv')).toContain(UserRole.SUPER_ADMIN);
    });

    it('never exposes a badge route to a parent', () => {
      const handlers: Array<keyof AwardsController> = [
        'listSchemes',
        'getScheme',
        'createScheme',
        'updateScheme',
        'removeScheme',
        'installDefaults',
        'createLevel',
        'updateLevel',
        'removeLevel',
        'getMemberProgress',
        'getProgressForMembers',
        'setProgress',
        'recordAssessment',
        'listAssessments',
        'getAssessment',
        'exportRiseCsv',
        'previewRiseImport',
        'importRiseCsv',
      ];

      for (const handler of handlers) {
        const roles = rolesFor(handler);
        expect(roles.length).toBeGreaterThan(0);
        expect(roles).not.toContain(UserRole.PARENT);
      }
    });
  });
});
