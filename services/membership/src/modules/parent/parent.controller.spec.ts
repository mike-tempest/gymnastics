import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';
import { InvoicePdfService } from '../finance/invoices/invoice-pdf.service';

describe('ParentController', () => {
  let controller: ParentController;
  let service: ParentService;

  const familyId = 'family-uuid-1';

  const mockParentService = {
    getProfile: jest.fn().mockResolvedValue({ family: {}, members: [] }),
    getDashboard: jest.fn().mockResolvedValue({
      childrenCount: 0,
      upcomingSessions: [],
      outstandingInvoices: [],
      totalOutstanding: 0,
    }),
    getChildren: jest.fn().mockResolvedValue([]),
    getChild: jest.fn().mockResolvedValue({}),
    getChildAttendance: jest.fn().mockResolvedValue([]),
    getChildSchedule: jest.fn().mockResolvedValue([]),
    getChildBadges: jest.fn().mockResolvedValue({
      schemes: [],
      total_awarded: 0,
      latest_award: null,
    }),
    getInvoices: jest.fn().mockResolvedValue([]),
    getInvoice: jest.fn().mockResolvedValue({}),
    getPayments: jest.fn().mockResolvedValue([]),
    getUpcomingSessions: jest.fn().mockResolvedValue([]),
    initiatePayment: jest.fn().mockResolvedValue({ status: 'initiated' }),
  };

  const mockInvoicePdfService = {
    pdfForInvoice: jest.fn(),
  };

  const reqWithFamily = { user: { family_id: familyId } };
  const reqWithoutFamily = { user: {} } as { user?: { family_id?: string } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParentController],
      providers: [
        { provide: ParentService, useValue: mockParentService },
        { provide: InvoicePdfService, useValue: mockInvoicePdfService },
      ],
    }).compile();

    controller = module.get<ParentController>(ParentController);
    service = module.get<ParentService>(ParentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should delegate to ParentService.getProfile with the family_id', async () => {
      await controller.getProfile(reqWithFamily);
      expect(service.getProfile).toHaveBeenCalledWith(familyId);
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getProfile(reqWithoutFamily)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDashboard', () => {
    it('should delegate to ParentService.getDashboard with the family_id', async () => {
      await controller.getDashboard(reqWithFamily);
      expect(service.getDashboard).toHaveBeenCalledWith(familyId);
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getDashboard(reqWithoutFamily)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getChildren', () => {
    it('should delegate to ParentService.getChildren with the family_id', async () => {
      await controller.getChildren(reqWithFamily);
      expect(service.getChildren).toHaveBeenCalledWith(familyId);
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getChildren(reqWithoutFamily)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getChild', () => {
    it('should delegate to ParentService.getChild with family_id and child id', async () => {
      await controller.getChild(reqWithFamily, 'child-1');
      expect(service.getChild).toHaveBeenCalledWith(familyId, 'child-1');
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getChild(reqWithoutFamily, 'child-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getChildAttendance', () => {
    it('should delegate to ParentService.getChildAttendance with all parameters', async () => {
      await controller.getChildAttendance(reqWithFamily, 'child-1', '2025-01-01', '2025-06-30');
      expect(service.getChildAttendance).toHaveBeenCalledWith(
        familyId,
        'child-1',
        '2025-01-01',
        '2025-06-30',
      );
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getChildAttendance(reqWithoutFamily, 'child-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getChildSchedule', () => {
    it('should delegate to ParentService.getChildSchedule with family_id, child id and days', async () => {
      await controller.getChildSchedule(reqWithFamily, 'child-1', 14);
      expect(service.getChildSchedule).toHaveBeenCalledWith(familyId, 'child-1', 14);
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getChildSchedule(reqWithoutFamily, 'child-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getChildBadges', () => {
    it("returns exactly the calling parent's own child's badge progress", async () => {
      const badges = {
        schemes: [
          {
            scheme_id: 'scheme-1',
            name: 'British Gymnastics Rise',
            description: null,
            levels: [
              {
                level_id: 'level-1',
                name: 'Discover 1',
                description: null,
                sort_order: 1,
                status: 'awarded',
                started_on: '2026-01-05',
                assessed_on: '2026-02-10',
                awarded_on: '2026-02-10',
              },
            ],
            awarded_count: 1,
            current_level: null,
            latest_award: null,
          },
        ],
        total_awarded: 1,
        latest_award: null,
      };
      mockParentService.getChildBadges.mockResolvedValue(badges);

      const result = await controller.getChildBadges(reqWithFamily, 'child-1');

      // The family id comes from the authenticated request, never the client,
      // so the service can only ever be asked about this family's children.
      expect(service.getChildBadges).toHaveBeenCalledWith(familyId, 'child-1');
      expect(result).toEqual(badges);
    });

    it('404s for a child in another family and returns nothing', async () => {
      mockParentService.getChildBadges.mockRejectedValue(
        new NotFoundException('Child not found or not associated with your family'),
      );

      await expect(controller.getChildBadges(reqWithFamily, 'other-family-child')).rejects.toThrow(
        NotFoundException,
      );
      expect(service.getChildBadges).toHaveBeenCalledWith(familyId, 'other-family-child');
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getChildBadges(reqWithoutFamily, 'child-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(service.getChildBadges).not.toHaveBeenCalled();
    });
  });

  describe('getInvoices', () => {
    it('should delegate to ParentService.getInvoices with family_id and optional status', async () => {
      await controller.getInvoices(reqWithFamily, 'paid');
      expect(service.getInvoices).toHaveBeenCalledWith(familyId, 'paid');
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getInvoices(reqWithoutFamily)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getInvoice', () => {
    it('should delegate to ParentService.getInvoice with family_id and invoice id', async () => {
      await controller.getInvoice(reqWithFamily, 'inv-1');
      expect(service.getInvoice).toHaveBeenCalledWith(familyId, 'inv-1');
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getInvoice(reqWithoutFamily, 'inv-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getInvoicePdf', () => {
    const mockRes = () => ({ set: jest.fn() }) as unknown as Response;

    it('should run the same ownership check and return the PDF with attachment headers', async () => {
      const invoice = { invoice_id: 'inv-1', family_id: familyId };
      const buffer = Buffer.from('%PDF-1.3 test');
      mockParentService.getInvoice.mockResolvedValue(invoice);
      mockInvoicePdfService.pdfForInvoice.mockResolvedValue({
        buffer,
        filename: 'invoice-INV-001.pdf',
      });
      const res = mockRes();

      const result = await controller.getInvoicePdf(reqWithFamily, 'inv-1', res);

      expect(mockParentService.getInvoice).toHaveBeenCalledWith(familyId, 'inv-1');
      expect(mockInvoicePdfService.pdfForInvoice).toHaveBeenCalledWith(invoice);
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="invoice-INV-001.pdf"',
        'Content-Length': String(buffer.length),
      });
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it("should not render a PDF for another family's invoice", async () => {
      // The ownership check throws for an invoice outside the calling
      // parent's family, so no PDF is ever rendered.
      mockParentService.getInvoice.mockRejectedValue(
        new NotFoundException('Invoice not found or not associated with your family'),
      );
      const res = mockRes();

      await expect(
        controller.getInvoicePdf(reqWithFamily, 'other-family-invoice', res),
      ).rejects.toThrow(NotFoundException);
      expect(mockInvoicePdfService.pdfForInvoice).not.toHaveBeenCalled();
      expect(res.set).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getInvoicePdf(reqWithoutFamily, 'inv-1', mockRes())).rejects.toThrow(
        NotFoundException,
      );
      expect(mockParentService.getInvoice).not.toHaveBeenCalled();
    });
  });

  describe('getPayments', () => {
    it('should delegate to ParentService.getPayments with the family_id', async () => {
      await controller.getPayments(reqWithFamily);
      expect(service.getPayments).toHaveBeenCalledWith(familyId);
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getPayments(reqWithoutFamily)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUpcomingSessions', () => {
    it('should delegate to ParentService.getUpcomingSessions with the family_id', async () => {
      await controller.getUpcomingSessions(reqWithFamily);
      expect(service.getUpcomingSessions).toHaveBeenCalledWith(familyId);
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.getUpcomingSessions(reqWithoutFamily)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('payInvoice', () => {
    it('should delegate to ParentService.initiatePayment with family_id and invoice id', async () => {
      await controller.payInvoice(reqWithFamily, 'inv-1');
      expect(service.initiatePayment).toHaveBeenCalledWith(familyId, 'inv-1');
    });

    it('should throw NotFoundException when family_id is missing', async () => {
      await expect(controller.payInvoice(reqWithoutFamily, 'inv-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
