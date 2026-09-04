import { Test, TestingModule } from '@nestjs/testing';
import * as zlib from 'zlib';
import { InvoicePdfService } from './invoice-pdf.service';
import { ClubsRepository } from '../../clubs/clubs.repository';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { Club } from '../../clubs/entities/club.entity';

/** Decodes a PDF hex string (<48656c6c6f>) to latin1 text. */
function decodeHexString(hex: string): string {
  return Buffer.from(hex, 'hex').toString('latin1');
}

/**
 * Inflates every FlateDecode stream in the PDF and decodes the text-showing
 * operators back to readable strings. pdfkit writes each line as a TJ array
 * of hex strings interleaved with kerning adjustments, so the hex chunks of
 * one array are concatenated to reconstruct the line. Pragmatic: no full PDF
 * parser needed.
 */
function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const contents: string[] = [];
  const streamRegex = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    if (end === -1) {
      break;
    }
    const slice = buffer.subarray(start, end);
    try {
      contents.push(zlib.inflateSync(slice).toString('latin1'));
    } catch {
      // Not a deflated stream (e.g. font data); keep the raw slice so
      // uncompressed content still participates.
      contents.push(slice.toString('latin1'));
    }
  }

  const lines: string[] = [];
  for (const content of contents) {
    // TJ arrays: [<hex> kern <hex> ...] TJ
    const tjArrayRegex = /\[((?:<[0-9a-fA-F]+>|-?\d+(?:\.\d+)?|\s)+)\]\s*TJ/g;
    let tj: RegExpExecArray | null;
    while ((tj = tjArrayRegex.exec(content)) !== null) {
      const hexChunks = tj[1].match(/<[0-9a-fA-F]+>/g) ?? [];
      lines.push(hexChunks.map((chunk) => decodeHexString(chunk.slice(1, -1))).join(''));
    }
    // Single-string forms: <hex> Tj and (literal) Tj
    const hexTjRegex = /<([0-9a-fA-F]+)>\s*Tj/g;
    while ((tj = hexTjRegex.exec(content)) !== null) {
      lines.push(decodeHexString(tj[1]));
    }
    const literalTjRegex = /\(((?:\\.|[^)\\])*)\)\s*Tj/g;
    while ((tj = literalTjRegex.exec(content)) !== null) {
      lines.push(tj[1].replace(/\\([()\\])/g, '$1'));
    }
  }
  return lines.join('\n');
}

describe('InvoicePdfService', () => {
  let service: InvoicePdfService;

  const mockClubsRepository = {
    findOne: jest.fn(),
  };

  const baseInvoice = {
    invoice_id: 'invoice-uuid-1',
    club_id: 'club-uuid-1',
    family_id: 'family-uuid-1',
    invoice_number: 'INV-2026-0042',
    subtotal: 50.0,
    tax_amount: 0,
    total_amount: 50.0,
    currency: 'GBP',
    due_date: new Date('2026-08-14T00:00:00.000Z'),
    issued_date: new Date('2026-07-31T00:00:00.000Z'),
    status: InvoiceStatus.PENDING,
    notes: null,
    family: {
      family_id: 'family-uuid-1',
      family_name: 'Smith Family',
      primary_contact_email: 'smiths@example.com',
    },
    items: [
      {
        item_id: 'item-uuid-1',
        invoice_id: 'invoice-uuid-1',
        description: 'Squad fees July',
        quantity: 1,
        unit_price: 50.0,
        total: 50.0,
      },
    ],
  } as unknown as Invoice;

  const gbClub = {
    id: 'club-uuid-1',
    name: 'City of Leeds SC',
    country: 'GB',
    currency: 'GBP',
    locale: 'en-GB',
    timezone: 'Europe/London',
    tax_rate: null,
    tax_label: null,
    tax_inclusive: false,
    tax_registration_number: null,
    contact_email: 'admin@leedssc.org.uk',
    website: 'https://leedssc.org.uk',
  } as unknown as Club;

  const auClub = {
    id: 'club-uuid-1',
    name: 'Bondi Swim Club',
    country: 'AU',
    currency: 'AUD',
    locale: 'en-AU',
    timezone: 'Australia/Sydney',
    tax_rate: 10,
    tax_label: 'GST',
    tax_inclusive: true,
    tax_registration_number: '51 824 753 556',
    contact_email: 'admin@bondiswim.com.au',
    website: 'https://bondiswim.com.au',
  } as unknown as Club;

  const auInvoice = {
    ...baseInvoice,
    currency: 'AUD',
    subtotal: 50.0,
    tax_amount: 5.0,
    total_amount: 55.0,
  } as unknown as Invoice;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicePdfService,
        { provide: ClubsRepository, useValue: mockClubsRepository },
      ],
    }).compile();

    service = module.get<InvoicePdfService>(InvoicePdfService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('renderInvoicePdf', () => {
    it('produces a non-empty PDF containing the invoice number', async () => {
      const buffer = await service.renderInvoicePdf(baseInvoice, gbClub);

      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');

      const text = extractPdfText(buffer);
      expect(text).toContain('INV-2026-0042');
      expect(text).toContain('City of Leeds SC');
      expect(text).toContain('Smith Family');
      expect(text).toContain('smiths@example.com');
      expect(text).toContain('Squad fees July');
      expect(text).toContain('Generated by Swimly');
    });

    it('renders a plain Invoice with a single Total row for a GB club with no tax', async () => {
      const buffer = await service.renderInvoicePdf(baseInvoice, gbClub);
      const text = extractPdfText(buffer);

      expect(text).toContain('Invoice');
      expect(text).not.toContain('Tax Invoice');
      expect(text).not.toContain('Subtotal');
      expect(text).not.toContain('VAT number');
      expect(text).toContain('Total');
    });

    it('renders a Tax Invoice with ABN and an Includes GST row for an AU tax-inclusive club', async () => {
      const buffer = await service.renderInvoicePdf(auInvoice, auClub);
      const text = extractPdfText(buffer);

      expect(text).toContain('Tax Invoice');
      expect(text).toContain('ABN');
      expect(text).toContain('51 824 753 556');
      expect(text).toContain('Includes GST');
      // Inclusive pricing must not present the tax as added on top.
      expect(text).not.toContain('Subtotal');
    });

    it('renders Subtotal, tax and Total rows for a tax-exclusive club', async () => {
      const exclusiveClub = {
        ...auClub,
        country: 'GB',
        tax_label: 'VAT',
        tax_inclusive: false,
        tax_registration_number: 'GB123456789',
      } as unknown as Club;
      const exclusiveInvoice = {
        ...baseInvoice,
        currency: 'GBP',
        subtotal: 50.0,
        tax_amount: 10.0,
        total_amount: 60.0,
      } as unknown as Invoice;

      const buffer = await service.renderInvoicePdf(exclusiveInvoice, exclusiveClub);
      const text = extractPdfText(buffer);

      expect(text).toContain('Subtotal');
      expect(text).toContain('VAT');
      expect(text).toContain('VAT number');
      expect(text).toContain('GB123456789');
      // A GB club never issues a document headed "Tax Invoice".
      expect(text).not.toContain('Tax Invoice');
    });
  });

  describe('isTaxInvoice', () => {
    it('is true only for an AU club with tax applied and a registration number', () => {
      expect(service.isTaxInvoice(auInvoice, auClub)).toBe(true);
      expect(service.isTaxInvoice(baseInvoice, gbClub)).toBe(false);
      expect(
        service.isTaxInvoice(auInvoice, { ...auClub, tax_registration_number: null } as Club),
      ).toBe(false);
      expect(service.isTaxInvoice({ ...auInvoice, tax_amount: 0 } as Invoice, auClub)).toBe(false);
      expect(service.isTaxInvoice(auInvoice, null)).toBe(false);
    });
  });

  describe('filenameFor', () => {
    it('uses the tax-invoice prefix only for tax invoices', () => {
      expect(service.filenameFor(auInvoice, auClub)).toBe('tax-invoice-INV-2026-0042.pdf');
      expect(service.filenameFor(baseInvoice, gbClub)).toBe('invoice-INV-2026-0042.pdf');
    });
  });

  describe('pdfForInvoice', () => {
    it('resolves the owning club by the invoice club_id and renders the document', async () => {
      mockClubsRepository.findOne.mockResolvedValue(auClub);

      const result = await service.pdfForInvoice(auInvoice);

      expect(mockClubsRepository.findOne).toHaveBeenCalledWith(auInvoice.club_id);
      expect(result.filename).toBe('tax-invoice-INV-2026-0042.pdf');
      expect(result.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });
  });
});
