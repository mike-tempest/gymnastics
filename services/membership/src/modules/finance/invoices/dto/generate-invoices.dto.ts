import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Body for POST /invoices/generate. Runs the invoice-generation engine for a
 * single fee structure. billing_period is optional: when omitted the engine
 * derives the period from the fee frequency (see InvoicesService), and the UI
 * supplies an explicit label such as 'Term 1 2027' for term fees.
 */
export class GenerateInvoicesDto {
  @IsNotEmpty()
  @IsUUID()
  fee_structure_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  billing_period?: string;
}
