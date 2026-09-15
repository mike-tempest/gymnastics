'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

interface TopBarProps {
  onMenuClick: () => void;
  menuOpen?: boolean;
}

export default function TopBar({ onMenuClick, menuOpen = false }: TopBarProps) {
  const { data: session } = useSession();

  return (
    <header className="bg-dark-primary border-b border-white/10 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-3 px-3 sm:px-6 py-3.5">
        <button
          id="navigation-trigger"
          onClick={onMenuClick}
          className="lg:hidden min-w-[48px] min-h-[48px] flex items-center justify-center hover:bg-white/10 rounded-xl text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          aria-controls={menuOpen ? 'mobile-navigation' : undefined}
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="flex-1" />
        {session && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label={`User menu for ${session.user.name || 'User'}`}
                className="min-h-[48px] min-w-[48px] flex items-center gap-2 p-2 hover:bg-white/10 rounded-xl text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span
                  className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center font-semibold text-dark-primary text-sm"
                  aria-hidden="true"
                >
                  {session.user.name?.charAt(0) || 'U'}
                </span>
                <span className="text-left hidden md:block max-w-48">
                  <span className="block text-sm font-medium truncate">{session.user.name}</span>
                  <span className="block text-xs text-white/80 capitalize">
                    {session.user.role?.replaceAll('_', ' ')}
                  </span>
                </span>
                <ChevronDown className="w-4 h-4 text-white/80" aria-hidden="true" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 w-48 max-w-[calc(100vw-2rem)] bg-dark-primary rounded-xl shadow-xl border border-white/20 p-1"
              >
                <DropdownMenu.Item
                  onSelect={() => signOut({ callbackUrl: '/login' })}
                  className="min-h-[48px] flex items-center gap-2 px-3 text-sm text-white/80 rounded-lg cursor-pointer outline-none focus:bg-white/10 focus:text-white focus:ring-2 focus:ring-brand"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  Sign Out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>
    </header>
  );
}
