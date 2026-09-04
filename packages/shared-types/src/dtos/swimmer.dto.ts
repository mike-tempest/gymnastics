import { Gender, GoverningBody } from '../enums';

export interface CreateSwimmerDto {
  family_id: string;
  se_number?: string | null;
  governing_body?: GoverningBody | null;
  first_name: string;
  last_name: string;
  dob: string; // ISO date
  gender: Gender;
  squad_id?: string;
  medical_notes?: string;
}

export interface UpdateSwimmerDto {
  se_number?: string | null;
  governing_body?: GoverningBody | null;
  first_name?: string;
  last_name?: string;
  dob?: string;
  gender?: Gender;
  squad_id?: string;
  medical_notes?: string;
  photo_url?: string;
}

export interface SwimmerResponse {
  swimmer_id: string;
  family_id: string;
  club_id: string;
  se_number: string | null;
  governing_body: GoverningBody | null;
  first_name: string;
  last_name: string;
  dob: string;
  gender: Gender;
  squad_id: string | null;
  age: number; // calculated
  squad_name?: string;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}
