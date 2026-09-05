import { Member } from './member.entity';

export interface Family {
  family_id: string;
  family_name: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postcode?: string | null;
  invite_token?: string | null;
  invite_status?: 'pending' | 'accepted' | null;
  invited_at?: string | null;
  invite_accepted_at?: string | null;
  created_at: string;
  updated_at: string;
  members?: Member[];
}
