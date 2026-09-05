import { UserRole } from '@club-manager/shared-types';

export class LoginResponseDto {
  user_id: string;
  club_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}
