'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

import { BRAND, MEMBER_NOUN_PLURAL } from '@/lib/brand';

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-brand">
              {BRAND.name}
            </Link>

            {session && (
              <div className="hidden md:flex space-x-4">
                <Link
                  href="/members"
                  className="text-grey-600 hover:text-brand px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {MEMBER_NOUN_PLURAL}
                </Link>
                <Link
                  href="/families"
                  className="text-grey-600 hover:text-brand px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Families
                </Link>
                <Link
                  href="/squads"
                  className="text-grey-600 hover:text-brand px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Squads
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <div className="text-sm">
                  <p className="font-medium text-grey-900">{session.user.name}</p>
                  <p className="text-grey-500 text-xs capitalize">
                    {session.user.role?.replace('_', ' ')}
                  </p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="bg-grey-100 hover:bg-grey-200 text-grey-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-dark-primary text-white hover:bg-brand hover:text-dark-primary px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
