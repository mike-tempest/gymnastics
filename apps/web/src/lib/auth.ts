import { UserRole } from '@club-manager/shared-types';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Call the membership service auth endpoint
          const apiBase =
            process.env.MEMBERSHIP_API_URL ||
            process.env.NEXT_PUBLIC_API_URL ||
            'http://localhost:3001';
          const loginUrl = `${apiBase}${apiBase.endsWith('/api') ? '' : '/api'}/auth/login`;
          // Auth request to membership service
          const res = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) {
            return null;
          }

          const data = await res.json();

          if (data?.user) {
            return {
              id: data.user.user_id,
              email: data.user.email,
              name: `${data.user.first_name} ${data.user.last_name}`,
              role: data.user.role,
              clubId: data.user.club_id,
              accessToken: data.access_token,
            };
          }

          return null;
        } catch (error) {
          // Auth error -- credentials.email failed to authenticate
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.clubId = user.clubId;
        token.accessToken = (user as { accessToken?: string }).accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.clubId = token.clubId as string;
      }
      session.accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
