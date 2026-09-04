import { FeeFrequency, AppliesToType } from '../enums';

export interface FeeStructure {
  fee_structure_id: string;
  name: string;
  description?: string | null;
  amount: number;
  frequency: FeeFrequency;
  applies_to_type: AppliesToType;
  applies_to_id?: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}
