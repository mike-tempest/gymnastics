import { DirectDebitMandateStatus } from '../enums';

export interface DirectDebitMandate {
  mandate_id: string;
  family_id: string;
  /** Which provider holds this mandate. */
  provider: string;
  /** Provider-side mandate id, unique together with `provider`. */
  provider_mandate_id: string;
  status: DirectDebitMandateStatus;
  scheme: string;
  created_at: Date;
  updated_at: Date;
}
