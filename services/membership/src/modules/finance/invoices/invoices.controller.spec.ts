import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let _service: jest.Mocked<InvoicesService>;

  const mockInvoice = {
    invoice_id: '123e4567-e89b-12d3-a456-426614174000',
    family_id: '334e5678-e89b-12d3-a456-426614174002',
    invoice_number: 'INV-2026-0001',
    total_amount: 50.0,
    status: InvoiceStatus.PENDING,
    due_date: new Date('2026-03-01'),
    issued_date: new Date('2026-02-15'),
  };

  const mockInvoicesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByFamily: jest.fn(),
    findByStatus: jest.fn(),
    findOverdue: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    sendReminder: jest.fn(),
    generateMonthlyInvoices: jest.fn(),
    generateInvoicesForFeeStructure: jest.fn(),
  };

  const mockInvoicePdfService = {
    pdfForInvoice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        { provide: InvoicesService, useValue: mockInvoicesService },
        { provide: InvoicePdfService, useValue: mockInvoicePdfService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InvoicesController>(InvoicesController);
    _service = module.get(InvoicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call invoicesService.create and return the result', async () => {
      const createDto = {
        family_id: mockInvoice.family_id,
        due_date: new Date('2026-03-01'),
        issued_date: new Date('2026-02-15'),
      };

      mockInvoicesService.create.mockResolvedValue(mockInvoice as unknown as Invoice);

      const result = await controller.create(createDto as unknown as CreateInvoiceDto);

      expect(result).toEqual(mockInvoice);
      expect(mockInvoicesService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return all invoices when no status filter is provided', async () => {
      mockInvoicesService.findAll.mockResolvedValue([mockInvoice as unknown as Invoice]);

      const result = await controller.findAll();

      expect(result).toEqual([mockInvoice]);
      expect(mockInvoicesService.findAll).toHaveBeenCalled();
    });

    it('should filter by status when provided', async () => {
      mockInvoicesService.findByStatus.mockResolvedValue([mockInvoice as unknown as Invoice]);

      const result = await controller.findAll(InvoiceStatus.PENDING);

      expect(result).toEqual([mockInvoice]);
      expect(mockInvoicesService.findByStatus).toHaveBeenCalledWith(InvoiceStatus.PENDING);
    });
  });

  describe('findOverdue', () => {
    it('should return overdue invoices', async () => {
      const overdueInvoice = { ...mockInvoice, status: InvoiceStatus.OVERDUE };
      mockInvoicesService.findOverdue.mockResolvedValue([overdueInvoice as unknown as Invoice]);

      const result = await controller.findOverdue();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(InvoiceStatus.OVERDUE);
    });
  });

  describe('findByFamily', () => {
    it('should return invoices for a specific family', async () => {
      mockInvoicesService.findByFamily.mockResolvedValue([mockInvoice as unknown as Invoice]);

      const result = await controller.findByFamily(mockInvoice.family_id);

      expect(result).toEqual([mockInvoice]);
      expect(mockInvoicesService.findByFamily).toHaveBeenCalledWith(mockInvoice.family_id);
    });
  });

  describe('findOne', () => {
    it('should return a single invoice', async () => {
      mockInvoicesService.findOne.mockResolvedValue(mockInvoice as unknown as Invoice);

      const result = await controller.findOne(mockInvoice.invoice_id);

      expect(result).toEqual(mockInvoice);
    });
  });

  describe('downloadPdf', () => {
    it('returns the rendered PDF with attachment headers', async () => {
      const buffer = Buffer.from('%PDF-1.3 test');
      mockInvoicesService.findOne.mockResolvedValue(mockInvoice as unknown as Invoice);
      mockInvoicePdfService.pdfForInvoice.mockResolvedValue({
        buffer,
        filename: 'invoice-INV-2026-0001.pdf',
      });
      const res = { set: jest.fn() } as unknown as Response;

      const result = await controller.downloadPdf(mockInvoice.invoice_id, res);

      expect(mockInvoicesService.findOne).toHaveBeenCalledWith(mockInvoice.invoice_id);
      expect(mockInvoicePdfService.pdfForInvoice).toHaveBeenCalledWith(mockInvoice);
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="invoice-INV-2026-0001.pdf"',
        'Content-Length': String(buffer.length),
      });
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it('propagates not-found from the tenant-scoped lookup without rendering', async () => {
      mockInvoicesService.findOne.mockRejectedValue(new NotFoundException());
      const res = { set: jest.fn() } as unknown as Response;

      await expect(controller.downloadPdf('other-club-invoice', res)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockInvoicePdfService.pdfForInvoice).not.toHaveBeenCalled();
      expect(res.set).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update an invoice', async () => {
      const updateDto = { notes: 'Updated note' };
      const updated = { ...mockInvoice, notes: 'Updated note' };

      mockInvoicesService.update.mockResolvedValue(updated as unknown as Invoice);

      const result = await controller.update(mockInvoice.invoice_id, updateDto as UpdateInvoiceDto);

      expect(result).toEqual(updated);
    });
  });

  describe('sendReminder', () => {
    it('should send a reminder for an invoice', async () => {
      const expectedResponse = { message: 'Payment reminder sent successfully' };
      mockInvoicesService.sendReminder.mockResolvedValue(expectedResponse);

      const result = await controller.sendReminder(mockInvoice.invoice_id);

      expect(result).toEqual(expectedResponse);
      expect(mockInvoicesService.sendReminder).toHaveBeenCalledWith(mockInvoice.invoice_id);
    });
  });

  describe('generateMonthly', () => {
    it('should generate monthly invoices', async () => {
      mockInvoicesService.generateMonthlyInvoices.mockResolvedValue([]);

      const result = await controller.generateMonthly();

      expect(result).toEqual([]);
      expect(mockInvoicesService.generateMonthlyInvoices).toHaveBeenCalledWith(undefined);
    });

    it('should generate monthly invoices for a specific squad', async () => {
      const squadId = '223e4567-e89b-12d3-a456-426614174001';
      mockInvoicesService.generateMonthlyInvoices.mockResolvedValue([]);

      await controller.generateMonthly(squadId);

      expect(mockInvoicesService.generateMonthlyInvoices).toHaveBeenCalledWith(squadId);
    });
  });

  describe('generate', () => {
    it('should run the generation engine for the given fee structure', async () => {
      const feeStructureId = '777e0000-e89b-12d3-a456-426614174777';
      const summary = { created: 3, skipped: 1, invoices: [] };
      mockInvoicesService.generateInvoicesForFeeStructure.mockResolvedValue(summary);

      const result = await controller.generate({ fee_structure_id: feeStructureId });

      expect(result).toEqual(summary);
      expect(mockInvoicesService.generateInvoicesForFeeStructure).toHaveBeenCalledWith(
        feeStructureId,
        undefined,
      );
    });

    it('should pass an explicit billing period through to the engine', async () => {
      const feeStructureId = '777e0000-e89b-12d3-a456-426614174777';
      mockInvoicesService.generateInvoicesForFeeStructure.mockResolvedValue({
        created: 0,
        skipped: 2,
        invoices: [],
      });

      await controller.generate({
        fee_structure_id: feeStructureId,
        billing_period: 'Term 1 2027',
      });

      expect(mockInvoicesService.generateInvoicesForFeeStructure).toHaveBeenCalledWith(
        feeStructureId,
        'Term 1 2027',
      );
    });
  });

  describe('remove', () => {
    it('should remove an invoice', async () => {
      mockInvoicesService.remove.mockResolvedValue(undefined);

      await controller.remove(mockInvoice.invoice_id);

      expect(mockInvoicesService.remove).toHaveBeenCalledWith(mockInvoice.invoice_id);
    });
  });
});
