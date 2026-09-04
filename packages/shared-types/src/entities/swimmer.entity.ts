import { Gender, GoverningBody } from '../enums';

export interface Swimmer {
  swimmer_id: string;
  family_id: string;
  club_id: string;
  se_number: string | null;
  governing_body: GoverningBody | null;
  first_name: string;
  last_name: string;
  dob: string; // ISO date
  gender: Gender;
  squad_id: string | null;
  medical_notes: string | null;
  emergency_contact: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}
