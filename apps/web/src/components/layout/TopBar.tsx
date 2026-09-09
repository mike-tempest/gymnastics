'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import { MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on Escape
  useEffect(() => {
    if (!showUserMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowUserMenu(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showUserMenu]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showUserMenu) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showUserMenu]);

  return (
    <header className="bg-dark-primary border-b border-white/10 sticky top-0 z-30 backdrop-blur-xl bg-opacity-95">
      <div className="flex items-center justify-between px-3 sm:px-6 py-3.5">
        {/* Left Side - Mobile menu */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors text-text-secondary hover:text-white"
            aria-label="Toggle menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-xl mx-2 sm:mx-4 md:mx-8">
          <div className="relative hidden sm:block">
            <label htmlFor="topbar-search" className="sr-only">
              Search {MEMBER_NOUN_PLURAL_LOWER}, families, sessions
            </label>
            <input
              id="topbar-search"
              type="text"
              placeholder={`Search ${MEMBER_NOUN_PLURAL_LOWER}, families, sessions...`}
              className="w-full px-4 py-2 pl-10 bg-white/10 border border-transparent rounded-xl text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-brand/30 focus:ring-2 focus:ring-brand/20 transition-all"
            />
            <svg
              className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center space-x-3">
          {/* Notifications */}
          <button
            aria-label="Notifications"
            className="relative p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors text-text-secondary hover:text-white group"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
            </svg>
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand rounded-full ring-2 ring-dark-primary"
              aria-hidden="true"
            ></span>
            <span className="sr-only">You have unread notifications</span>
          </button>

          {/* User Profile */}
          {session && (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-label={'User menu for ' + session.user.name}
                aria-expanded={showUserMenu}
                aria-haspopup="true"
                className="flex items-center space-x-2 sm:space-x-2.5 p-1.5 pr-2 sm:pr-3 hover:bg-white/10 rounded-xl transition-colors group"
              >
                <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center font-semibold text-dark-primary text-sm shadow-sm transition-all">
                  {session.user.name?.charAt(0) || 'U'}
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-sm font-medium text-white leading-tight">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-text-secondary capitalize leading-tight">
                    {session.user.role?.replace('_', ' ')}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-white/70 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>

              {/* Dropdown */}
              {showUserMenu && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 max-w-[calc(100vw-2rem)] bg-dark-primary rounded-xl shadow-xl border border-white/10 overflow-hidden"
                >
                  <div className="py-1">
                    <button
                      role="menuitem"
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-white/10 hover:text-white transition-colors flex items-center space-x-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
