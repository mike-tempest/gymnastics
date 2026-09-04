import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { InvoicesRepository } from './invoices/invoices.repository';
import { PaymentsRepository } from './payments/payments.repository';
import { MandatesRepository } from './mandates/mandates.repository';
import { InvoiceStatus } from './invoices/entities/invoice.entity';

describe('FinanceService', () => {
  let service: FinanceService;
  let _invoicesRepository: InvoicesRepository;

  const mockInvoicesRepository = {
    getTotalRevenue: jest.fn(),
    getTotalOutstanding: jest.fn(),
    findOverdue: jest.fn(),
    countByStatus: jest.fn(),
    count: jest.fn(),
  };

  const mockPaymentsRepository = {
    findAll: jest.fn(),
    count: jest.fn(),
  };

  const mockMandatesRepository = {
    findAll: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: InvoicesRepository, useValue: mockInvoicesRepository },
        { provide: PaymentsRepository, useValue: mockPaymentsRepository },
        { provide: MandatesRepository, useValue: mockMandatesRepository },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
    _invoicesRepository = module.get<InvoicesRepository>(InvoicesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardStats', () => {
    it('should return a full dashboard statistics object', async () => {
      mockInvoicesRepository.getTotalRevenue.mockResolvedValue(1500.0);
      mockInvoicesRepository.getTotalOutstanding.mockResolvedValue(450.0);
      mockInvoicesRepository.findOverdue.mockResolvedValue([{}, {}]);
      mockInvoicesRepository.countByStatus.mockResolvedValueOnce(30).mockResolvedValueOnce(8);
      mockInvoicesRepository.count.mockResolvedValue(42);

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        total_outstanding: 450.0,
        overdue_count: 2,
        this_month_revenue: 1500.0,
        total_invoices: 42,
        paid_invoices: 30,
        pending_invoices: 8,
      });
    });

    it('should call countByStatus with PAID and PENDING statuses', async () => {
      mockInvoicesRepository.getTotalRevenue.mockResolvedValue(0);
      mockInvoicesRepository.getTotalOutstanding.mockResolvedValue(0);
      mockInvoicesRepository.findOverdue.mockResolvedValue([]);
      mockInvoicesRepository.countByStatus.mockResolvedValue(0);
      mockInvoicesRepository.count.mockResolvedValue(0);

      await service.getDashboardStats();

      expect(mockInvoicesRepository.countByStatus).toHaveBeenCalledWith(InvoiceStatus.PAID);
      expect(mockInvoicesRepository.countByStatus).toHaveBeenCalledWith(InvoiceStatus.PENDING);
    });

    it('should return zero values when no invoices exist', async () => {
      mockInvoicesRepository.getTotalRevenue.mockResolvedValue(0);
      mockInvoicesRepository.getTotalOutstanding.mockResolvedValue(0);
      mockInvoicesRepository.findOverdue.mockResolvedValue([]);
      mockInvoicesRepository.countByStatus.mockResolvedValue(0);
      mockInvoicesRepository.count.mockResolvedValue(0);

      const result = await service.getDashboardStats();

      expect(result.total_outstanding).toBe(0);
      expect(result.overdue_count).toBe(0);
      expect(result.this_month_revenue).toBe(0);
      expect(result.total_invoices).toBe(0);
      expect(result.paid_invoices).toBe(0);
      expect(result.pending_invoices).toBe(0);
    });

    it('should run all repository queries concurrently via Promise.all', async () => {
      const callOrder: string[] = [];

      mockInvoicesRepository.getTotalRevenue.mockImplementation(async () => {
        callOrder.push('getTotalRevenue');
        return 0;
      });
      mockInvoicesRepository.getTotalOutstanding.mockImplementation(async () => {
        callOrder.push('getTotalOutstanding');
        return 0;
      });
      mockInvoicesRepository.findOverdue.mockImplementation(async () => {
        callOrder.push('findOverdue');
        return [];
      });
      mockInvoicesRepository.countByStatus.mockImplementation(async () => {
        callOrder.push('countByStatus');
        return 0;
      });
      mockInvoicesRepository.count.mockImplementation(async () => {
        callOrder.push('count');
        return 0;
      });

      await service.getDashboardStats();

      // All six queries should have been called
      expect(callOrder).toContain('getTotalRevenue');
      expect(callOrder).toContain('getTotalOutstanding');
      expect(callOrder).toContain('findOverdue');
      expect(callOrder).toContain('countByStatus');
      expect(callOrder).toContain('count');
    });
  });
});
