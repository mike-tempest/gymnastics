import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Club } from '../../clubs/entities/club.entity';
import { ClubsRepository } from '../../clubs/clubs.repository';
import { formatClubDate, formatMoney } from '../../../common/region/format.util';
import {
  regionForCountry,
  taxRegistrationLabelForCountry,
} from '../../../common/region/region.util';

/** Dark body text, matching the product's near-black type. */
const TEXT = '#1f2933';
/** Muted secondary text for labels and footnotes. */
const MUTED = '#6b7280';
/** Hairline rule colour; light enough to organise without cluttering. */
const RULE = '#e5e7eb';

/** Generous A4 margin (roughly 20mm). */
const MARGIN = 56;

/**
 * Renders invoices as downloadable A4 PDF documents using pdfkit (pure JS, no
 * headless browser). Single built-in Helvetica face, no images, muted rules.
 *
 * The tax presentation mirrors the invoice web pages and emails exactly: an
 * Australian club with tax applied and an ABN on file issues a document headed
 * "Tax Invoice"; the registration line (ABN, VAT number, GST/HST number)
 * renders for any country once tax is applied and a number is stored;
 * tax-inclusive clubs show the tax within the total ("Includes GST") rather
 * than as an added-on-top breakdown. A GB club with no tax configuration gets
 * a plain "Invoice" with a single Total row.
 */
@Injectable()
export class InvoicePdfService {
  constructor(private readonly clubsRepository: ClubsRepository) {}

  /**
   * True when the document must be headed "Tax Invoice": Australian club,
   * tax actually applied, and a tax registration number (ABN) on file. Same
   * rule as the invoice web pages.
   */
  isTaxInvoice(invoice: Invoice, club: Club | null): boolean {
    return (
      (club?.country ?? 'GB').toUpperCase() === 'AU' &&
      Number(invoice.tax_amount) > 0 &&
      !!club?.tax_registration_number
    );
  }

  /** Download filename: tax-invoice-<number>.pdf when it is one, else invoice-<number>.pdf. */
  filenameFor(invoice: Invoice, club: Club | null): string {
    const prefix = this.isTaxInvoice(invoice, club) ? 'tax-invoice' : 'invoice';
    return `${prefix}-${invoice.invoice_number}.pdf`;
  }

  /**
   * Convenience for controllers: resolves the invoice's owning club by the
   * stamped club_id (the invoice itself was already loaded through a
   * tenant-scoped or ownership-checked path) and renders the document.
   */
  async pdfForInvoice(invoice: Invoice): Promise<{ buffer: Buffer; filename: string }> {
    const club = await this.clubsRepository.findOne(invoice.club_id);
    const buffer = await this.renderInvoicePdf(invoice, club);
    return { buffer, filename: this.filenameFor(invoice, club) };
  }

  /**
   * Renders the invoice as an A4 PDF and resolves with the complete document
   * buffer. Pure presentation: callers pass the (already authorised) invoice
   * and its owning club.
   */
  async renderInvoicePdf(invoice: Invoice, club: Club | null): Promise<Buffer> {
    const region = regionForCountry(club?.country);
    const currency = invoice.currency ?? club?.currency ?? region.currency;
    const locale = club?.locale ?? region.locale;
    const taxApplied = Number(invoice.tax_amount) > 0;
    const taxInclusive = club?.tax_inclusive === true;
    const taxLabel = club?.tax_label ?? 'Tax';
    const title = this.isTaxInvoice(invoice, club) ? 'Tax Invoice' : 'Invoice';

    // Intl can emit narrow no-break spaces that Helvetica's WinAnsi encoding
    // cannot represent; normalise them to plain spaces.
    const money = (amount: number | string): string =>
      formatMoney(amount, currency, locale).replace(/[\u00a0\u202f]/g, ' ');

    // issued_date and due_date are date-only columns stored as UTC midnight,
    // so format them with the UTC timezone: the stored calendar date must
    // appear as-is and never shift with the club timezone (codebase
    // convention, see InvoicesService).
    const date = (d: Date | string): string => formatClubDate(d, locale, 'UTC');

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title: `${title} ${invoice.invoice_number}`,
        Author: club?.name ?? 'Swimly',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const left = MARGIN;
    const rightEdge = doc.page.width - MARGIN;
    const contentWidth = rightEdge - left;
    const pageBottom = doc.page.height - MARGIN - 48;

    const hairline = (y: number): void => {
      doc.moveTo(left, y).lineTo(rightEdge, y).lineWidth(0.5).strokeColor(RULE).stroke();
    };

    let y = MARGIN;

    // Header: club name, then the document title.
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(TEXT)
      .text(club?.name ?? 'Swimly', left, y, { width: contentWidth });
    y = doc.y + 4;
    doc.font('Helvetica').fontSize(24).fillColor(TEXT).text(title, left, y, {
      width: contentWidth,
    });
    y = doc.y + 12;
    hairline(y);
    y += 16;

    // Reference block: number, dates, and the tax registration line.
    const metaRow = (label: string, value: string): void => {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, left, y + 1, { width: 130 });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(TEXT)
        .text(value, left + 140, y, { width: contentWidth - 140 });
      y = doc.y + 6;
    };

    metaRow('Invoice number', invoice.invoice_number);
    metaRow('Issue date', date(invoice.issued_date));
    metaRow('Due date', date(invoice.due_date));
    if (taxApplied && club?.tax_registration_number) {
      metaRow(taxRegistrationLabelForCountry(club?.country), club.tax_registration_number);
    }

    // Bill-to block.
    y += 12;
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(MUTED)
      .text('BILLED TO', left, y, { width: contentWidth, characterSpacing: 0.5 });
    y = doc.y + 4;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(TEXT)
      .text(invoice.family?.family_name ?? 'Family', left, y, { width: contentWidth });
    y = doc.y + 2;
    if (invoice.family?.primary_contact_email) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(MUTED)
        .text(invoice.family.primary_contact_email, left, y, { width: contentWidth });
      y = doc.y + 2;
    }

    // Line items table.
    y += 18;
    const cols = {
      desc: { x: left, w: 240 },
      qty: { x: left + 250, w: 50 },
      unit: { x: left + 308, w: 85 },
      total: { x: left + 401, w: contentWidth - 401 },
    };

    const tableHeader = (): void => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED);
      doc.text('DESCRIPTION', cols.desc.x, y, { width: cols.desc.w, characterSpacing: 0.5 });
      doc.text('QTY', cols.qty.x, y, {
        width: cols.qty.w,
        align: 'right',
        characterSpacing: 0.5,
      });
      doc.text('UNIT PRICE', cols.unit.x, y, {
        width: cols.unit.w,
        align: 'right',
        characterSpacing: 0.5,
      });
      doc.text('AMOUNT', cols.total.x, y, {
        width: cols.total.w,
        align: 'right',
        characterSpacing: 0.5,
      });
      y += 14;
      hairline(y);
      y += 10;
    };

    tableHeader();

    const items: InvoiceItem[] = invoice.items ?? [];
    if (items.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(MUTED)
        .text('No line items', cols.desc.x, y, { width: contentWidth });
      y = doc.y + 10;
    }

    for (const item of items) {
      doc.font('Helvetica').fontSize(10);
      const descHeight = doc.heightOfString(item.description, { width: cols.desc.w });
      const rowHeight = Math.max(descHeight, 12);

      if (y + rowHeight > pageBottom) {
        doc.addPage();
        y = MARGIN;
        tableHeader();
      }

      doc.fillColor(TEXT).text(item.description, cols.desc.x, y, { width: cols.desc.w });
      doc.fillColor(TEXT).text(String(item.quantity), cols.qty.x, y, {
        width: cols.qty.w,
        align: 'right',
      });
      doc.fillColor(TEXT).text(money(item.unit_price), cols.unit.x, y, {
        width: cols.unit.w,
        align: 'right',
      });
      doc.fillColor(TEXT).text(money(item.total), cols.total.x, y, {
        width: cols.total.w,
        align: 'right',
      });
      y += rowHeight + 8;
      hairline(y - 4);
      y += 4;
    }

    // Totals block, right-aligned. Exclusive tax shows Subtotal / tax / Total;
    // inclusive shows Total then an "Includes GST" note; no tax shows Total
    // only.
    if (y + 90 > pageBottom) {
      doc.addPage();
      y = MARGIN;
    }
    y += 8;

    const totalsLabelX = rightEdge - 260;
    const totalsValueX = rightEdge - 110;
    const totalsRow = (label: string, value: string, opts?: { bold?: boolean; muted?: boolean }): void => {
      doc
        .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(opts?.bold ? 11 : 10)
        .fillColor(opts?.muted ? MUTED : TEXT);
      doc.text(label, totalsLabelX, y, { width: 140, align: 'right' });
      doc.text(value, totalsValueX, y, { width: 110, align: 'right' });
      y += opts?.bold ? 18 : 16;
    };

    if (taxApplied && !taxInclusive) {
      totalsRow('Subtotal', money(invoice.subtotal));
      totalsRow(taxLabel, money(invoice.tax_amount));
      totalsRow('Total', money(invoice.total_amount), { bold: true });
    } else if (taxApplied && taxInclusive) {
      totalsRow('Total', money(invoice.total_amount), { bold: true });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(MUTED)
        .text(`Includes ${taxLabel}: ${money(invoice.tax_amount)}`, totalsLabelX - 60, y, {
          width: rightEdge - (totalsLabelX - 60),
          align: 'right',
        });
      y = doc.y + 4;
    } else {
      totalsRow('Total', money(invoice.total_amount), { bold: true });
    }

    // Footer, pinned to the bottom of the final page: club contact details on
    // the left, attribution on the right.
    const footerY = doc.page.height - MARGIN - 12;
    hairline(footerY - 10);
    const contact = [club?.contact_email, club?.website].filter(Boolean).join('   ');
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    if (contact) {
      doc.text(contact, left, footerY, { width: contentWidth - 140, lineBreak: false });
    }
    doc.text('Generated by Swimly', rightEdge - 140, footerY, {
      width: 140,
      align: 'right',
      lineBreak: false,
    });

    doc.end();
    return finished;
  }
}
