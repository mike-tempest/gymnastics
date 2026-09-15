'use client';

import {
  governingBodyConfig,
  defaultGoverningBodyForCountry,
  UserRole,
} from '@club-manager/shared-types';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Home,
  Users,
  Award,
  UsersRound,
  Shield,
  Calendar,
  MessageSquare,
  CheckSquare,
  Trophy,
  ClipboardList,
  CreditCard,
  FileText,
  DollarSign,
  Banknote,
  FileSignature,
  ShieldCheck,
  ShieldAlert,
  FileCheck,
  Lock,
  Settings,
  BarChart,
  ChevronDown,
  ChevronRight,
  User,
  LogOut,
  Heart,
  X,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState, useEffect, useMemo } from 'react';

import { useClubRegion } from '@/hooks/useClubRegion';
import { BRAND, MEMBER_NOUN_PLURAL } from '@/lib/brand';
import { isCompetitionsEnabled } from '@/lib/features';
import { useRole, isAdmin, isCoach, isParent, isWelfareOfficer } from '@/lib/hooks/useRole';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  name: string;
  icon: LucideIcon;
  children: NavItem[];
}

type NavEntry = NavItem | NavSection;

function isSection(entry: NavEntry): entry is NavSection {
  return 'children' in entry;
}

// Full navigation entries (admin sees everything)
const allNavEntries: NavEntry[] = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: MEMBER_NOUN_PLURAL, href: '/members', icon: Users },
  { name: 'Families', href: '/families', icon: UsersRound },
  { name: 'Squads', href: '/squads', icon: Shield },
  // The club's own waiting list (TEM-22), not the launch waitlist under Admin.
  { name: 'Waiting list', href: '/waiting-list', icon: ClipboardList },
  { name: 'Sessions', href: '/sessions', icon: Calendar },
  {
    name: 'Communications',
    icon: MessageSquare,
    children: [
      { name: 'All Messages', href: '/communications', icon: MessageSquare },
      { name: 'Compose', href: '/communications/compose', icon: FileText },
    ],
  },
  { name: 'Attendance', href: '/attendance', icon: CheckSquare },
  { name: 'Badges', href: '/awards', icon: Award },
  // Swimming times/strokes module, feature-flagged off by default (TEM-15).
  ...(isCompetitionsEnabled()
    ? [{ name: 'Competitions', href: '/competitions', icon: Trophy }]
    : []),
  {
    name: 'Billing',
    icon: CreditCard,
    children: [
      { name: 'Overview', href: '/billing', icon: CreditCard },
      { name: 'Create Invoice', href: '/billing/create', icon: FileSignature },
      { name: 'Fee Structures', href: '/fee-structures', icon: DollarSign },
      { name: 'Payments', href: '/payments', icon: Banknote },
    ],
  },
  {
    name: 'Compliance',
    icon: ShieldCheck,
    children: [
      { name: 'Overview', href: '/compliance', icon: ShieldCheck },
      // Renamed at render time to the club's background-check framework
      // (DBS for GB clubs, WWCC for Australian clubs).
      { name: 'DBS', href: '/compliance/dbs', icon: ShieldAlert },
      { name: 'Consent', href: '/compliance/consent', icon: FileCheck },
      { name: 'Safeguarding', href: '/compliance/safeguarding', icon: Lock },
    ],
  },
  {
    name: 'Admin',
    icon: Settings,
    children: [
      { name: 'Dashboard', href: '/admin', icon: Home },
      { name: 'Reports', href: '/admin/reports', icon: BarChart },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
      { name: 'Waitlist', href: '/admin/waitlist', icon: ClipboardList },
    ],
  },
];

// Items visible to coaches
const COACH_NAV_NAMES = new Set([
  'Dashboard',
  MEMBER_NOUN_PLURAL,
  'Squads',
  'Sessions',
  'Communications',
  'Attendance',
  // Head coaches offer places and enrol from the waiting list (TEM-22), so
  // they get the link rather than having to know the URL.
  'Waiting list',
  // Coaches assess and award badges (TEM-18).
  'Badges',
  // 'Competitions' stays a plain member: this set only filters allNavEntries,
  // which already omits the entry while the module is flagged off (TEM-15).
  'Competitions',
]);

// The Welfare Officer's navigation, in the order they need it: compliance is
// the job, the gymnast list is the context for it. Every entry here is backed
// by an endpoint the role can already read, so none of them leads to a 403.
// There is deliberately no wellbeing entry: the only wellbeing screens in the
// app are the parent ones, and a staff link would lead nowhere.
const WELFARE_NAV_ORDER = ['Compliance', MEMBER_NOUN_PLURAL];

// Parent navigation (entirely separate set of routes)
const parentNavEntries: NavEntry[] = [
  { name: 'Dashboard', href: '/parent', icon: Home },
  { name: 'My Children', href: '/parent/children', icon: Users },
  { name: 'Wellbeing', href: '/parent/wellbeing', icon: Heart },
  { name: 'Invoices', href: '/parent/invoices', icon: FileText },
];

function formatRoleLabel(role: string): string {
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role, user } = useRole();
  const { country, club } = useClubRegion();
  // The compliance nav item carries the club's own framework short label:
  // "DBS" for GB clubs (unchanged), "WWCC" for Australian clubs.
  const checkShortLabel = governingBodyConfig(
    club?.governing_body ?? defaultGoverningBodyForCountry(country)
  ).backgroundCheckShortLabel;

  const navEntries = useMemo(() => {
    const localiseCheckItem = (entries: NavEntry[]): NavEntry[] =>
      entries.map((entry) =>
        isSection(entry) && entry.name === 'Compliance'
          ? {
              ...entry,
              children: entry.children.map((child) =>
                child.href === '/compliance/dbs' ? { ...child, name: checkShortLabel } : child
              ),
            }
          : entry
      );

    if (!role) return [];
    if (isParent(role)) return parentNavEntries;
    if (isAdmin(role)) return localiseCheckItem(allNavEntries);
    if (isCoach(role)) {
      return localiseCheckItem(
        allNavEntries.filter(
          (entry) =>
            COACH_NAV_NAMES.has(entry.name) &&
            (entry.name !== 'Waiting list' || role === UserRole.HEAD_COACH)
        )
      );
    }
    if (isWelfareOfficer(role)) {
      const byName = new Map(allNavEntries.map((entry) => [entry.name, entry]));
      const welfareEntries = WELFARE_NAV_ORDER.map((name) => byName.get(name)).filter(
        (entry): entry is NavEntry => entry !== undefined
      );
      return localiseCheckItem(welfareEntries);
    }
    return [];
  }, [role, checkShortLabel]);

  function isSectionActive(section: NavSection): boolean {
    return section.children.some((child) => pathname.startsWith(child.href));
  }

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const entry of navEntries) {
      if (isSection(entry) && isSectionActive(entry)) {
        initial[entry.name] = true;
      }
    }
    return initial;
  });

  // Auto-expand sections when route changes to a child
  useEffect(() => {
    for (const entry of navEntries) {
      if (isSection(entry) && entry.children.some((child) => pathname.startsWith(child.href))) {
        setOpenSections((prev) => ({ ...prev, [entry.name]: true }));
      }
    }
  }, [pathname, navEntries]);

  function toggleSection(name: string) {
    setOpenSections((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function isItemActive(href: string): boolean {
    if (href === '/' || href === '/parent') return pathname === href;
    const links = navEntries.flatMap((entry) => (isSection(entry) ? entry.children : [entry]));
    return (
      (pathname === href || pathname.startsWith(`${href}/`)) &&
      !links.some(
        (item) =>
          item.href.length > href.length &&
          (pathname === item.href || pathname.startsWith(`${item.href}/`))
      )
    );
  }

  const displayName = user?.name || 'User';
  const displayEmail = user?.email || '';
  const displayRole = role ? formatRoleLabel(role) : '';

  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2">
        <Link
          href={isParent(role) ? '/parent' : isWelfareOfficer(role) ? '/compliance' : '/'}
          onClick={onClose}
          className="flex min-h-[48px] items-center space-x-3 group"
        >
          <div>
            <Image
              src="/tumblebase-logo.svg"
              alt={BRAND.name}
              width={120}
              height={32}
              className="h-8 w-auto"
            />
            <p className="text-xs text-grey-300 mt-1">Club Management</p>
          </div>
        </Link>
        {!isDesktop && (
          <Dialog.Close
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
            aria-label="Close menu"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </Dialog.Close>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navEntries.map((entry) => {
          if (isSection(entry)) {
            const sectionActive = isSectionActive(entry);
            const expanded = openSections[entry.name] ?? false;
            const Icon = entry.icon;

            return (
              <div key={entry.name}>
                <button
                  onClick={() => toggleSection(entry.name)}
                  aria-expanded={expanded}
                  aria-controls={`nav-section-${entry.name.toLowerCase()}`}
                  className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[48px] rounded-xl transition-all duration-200 group ${
                    sectionActive ? 'text-brand' : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        sectionActive ? 'text-brand' : 'text-white/70 group-hover:text-white/60'
                      }`}
                    />
                    <span className="font-medium text-sm">{entry.name}</span>
                  </div>
                  {expanded ? (
                    <ChevronDown className="w-4 h-4 text-white/70" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white/70" />
                  )}
                </button>

                <div id={`nav-section-${entry.name.toLowerCase()}`} hidden={!expanded}>
                  <div className="ml-3 pl-3 border-l border-white/10 space-y-0.5 py-1">
                    {entry.children.map((child) => {
                      const active = isItemActive(child.href);
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={active ? 'page' : undefined}
                          onClick={onClose}
                          className={`flex items-center space-x-3 px-3 py-2 min-h-[48px] rounded-lg transition-all duration-200 group ${
                            active
                              ? 'bg-brand/20 text-brand'
                              : 'text-white/60 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <ChildIcon
                            className={`w-4 h-4 transition-colors ${
                              active ? 'text-brand' : 'text-white/70 group-hover:text-white/60'
                            }`}
                          />
                          <span className="font-medium text-sm">{child.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          const active = isItemActive(entry.href);
          const Icon = entry.icon;
          return (
            <Link
              key={entry.href}
              href={entry.href}
              aria-current={active ? 'page' : undefined}
              onClick={onClose}
              className={`flex items-center space-x-3 px-3 py-2.5 min-h-[48px] rounded-xl transition-all duration-200 group ${
                active
                  ? 'bg-brand/20 text-brand border border-brand/20'
                  : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-colors ${
                  active ? 'text-brand' : 'text-white/70 group-hover:text-white/60'
                }`}
              />
              <span className="font-medium text-sm">{entry.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="px-3 py-3 border-t border-white/10">
        <div className="flex items-center space-x-3 px-3 py-2.5">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white/80" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{displayName}</p>
            <p className="text-xs text-grey-300 truncate">{displayRole || displayEmail}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1.5 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-xs font-medium text-white mb-1">Need help?</p>
          <p className="text-xs text-white/80">Contact support</p>
        </div>
      </div>
    </div>
  );

  const navigationClasses =
    'h-full w-64 max-w-[calc(100vw-1rem)] bg-dark-primary border-r border-white/10 [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-brand [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-brand';

  if (isDesktop) {
    return (
      <aside aria-label="Main navigation sidebar" className={navigationClasses}>
        {content}
      </aside>
    );
  }

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          id="mobile-navigation"
          aria-describedby={undefined}
          className={`fixed left-0 top-0 z-50 ${navigationClasses}`}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById('navigation-trigger')?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Main navigation</Dialog.Title>
          {content}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
