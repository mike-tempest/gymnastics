import { UserRole } from '@club-manager/shared-types';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      clubId: string;
    } & DefaultSession['user'];
    accessToken?: string;
  }

  interface User {
    id: string;
    role: UserRole;
    clubId: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    clubId: string;
    accessToken?: string;
  }
}
