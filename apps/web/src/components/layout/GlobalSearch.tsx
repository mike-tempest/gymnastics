'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useId, useState } from 'react';

import { api } from '@/lib/api/api-client';
import { MEMBER_NOUN, MEMBER_NOUN_PLURAL } from '@/lib/brand';

interface Result {
  id: string;
  kind: 'member' | 'family' | 'session';
  title: string;
  detail: string;
  href: string;
}
interface Results {
  results: Result[];
  truncated: boolean;
}

export default function GlobalSearch() {
  const { data: session } = useSession();
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const timeout = setTimeout(() => setQuery(term.trim()), 250);
    return () => clearTimeout(timeout);
  }, [term]);
  const search = useQuery<Results>({
    queryKey: ['global-search', session?.user.id, session?.user.clubId, session?.user.role, query],
    queryFn: ({ signal }) => api.get(`/search?q=${encodeURIComponent(query)}`, { signal }),
    enabled: open && !!session && query.length >= 2,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const waiting = term.trim() !== query || search.isFetching;
  const results = waiting ? [] : (search.data?.results ?? []);
  useEffect(() => {
    if (active >= 0)
      document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, id]);
  const choose = (result: Result) => {
    setOpen(false);
    setTerm('');
    setQuery('');
    setActive(-1);
    router.push(result.href);
  };
  const role = session?.user.role?.toLowerCase();
  if (
    !role ||
    ![
      'super_admin',
      'treasurer',
      'head_coach',
      'squad_coach',
      'welfare_officer',
      'parent',
    ].includes(role)
  )
    return null;
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setTerm('');
        setQuery('');
        setActive(-1);
      }}
    >
      <Dialog.Trigger asChild>
        <button
          className="flex min-h-[48px] min-w-[48px] items-center gap-2 rounded-xl px-3 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          aria-label="Search club records"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(`${id}-input`)?.focus();
          }}
          className="ph-no-capture fixed left-1/2 top-[8vh] z-50 max-h-[84dvh] w-[calc(100%_-_2rem)] max-w-xl -translate-x-1/2 overflow-y-auto rounded-2xl bg-surface p-5 text-text-primary shadow-xl"
        >
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="text-xl font-bold">Search club records</Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close search"
                className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
              >
                <X aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-sm text-text-secondary">
            Find {MEMBER_NOUN_PLURAL.toLowerCase()}, families and sessions you have access to. Enter
            at least two characters.
          </Dialog.Description>
          <label htmlFor={`${id}-input`} className="sr-only">
            Search by name
          </label>
          <input
            id={`${id}-input`}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={term.trim().length >= 2}
            aria-controls={`${id}-results`}
            aria-activedescendant={active >= 0 && results[active] ? `${id}-${active}` : undefined}
            autoComplete="off"
            maxLength={100}
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setActive(-1);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (results.length)
                  setActive((index) =>
                    event.key === 'ArrowDown'
                      ? (index + 1) % results.length
                      : index <= 0
                        ? results.length - 1
                        : index - 1
                  );
              }
              if (event.key === 'Enter' && active >= 0 && results[active]) {
                event.preventDefault();
                choose(results[active]);
              }
            }}
            className="min-h-[48px] w-full rounded-lg border border-grey-400 bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
          />
          <div className="mt-3 text-sm" role="status" aria-live="polite">
            {term.trim().length >= 2 &&
              (waiting
                ? 'Searching...'
                : search.isError
                  ? ''
                  : results.length
                    ? `${results.length} results`
                    : 'No matching records. Try another name.')}
          </div>
          {search.isError && !waiting && query.length >= 2 && (
            <div role="alert" className="mt-3">
              <p>Search could not load. Please try again.</p>
              <button onClick={() => search.refetch()} className="min-h-[48px] px-3 underline">
                Retry search
              </button>
            </div>
          )}
          <ul
            id={`${id}-results`}
            role="listbox"
            aria-label="Search results"
            className="mt-2 space-y-1"
          >
            {results.map((result, index) => (
              <li
                key={`${result.kind}-${result.id}`}
                id={`${id}-${index}`}
                role="option"
                aria-selected={active === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(result)}
                className={`min-h-[48px] cursor-pointer rounded-lg p-3 ${active === index ? 'bg-brand' : 'hover:bg-canvas-dark'}`}
              >
                <span className="block text-xs font-semibold text-text-secondary">
                  {result.kind === 'member'
                    ? MEMBER_NOUN
                    : result.kind === 'family'
                      ? 'Family'
                      : 'Session'}
                </span>
                <span className="block font-semibold">{result.title}</span>
                <span className="block text-sm text-text-secondary">{result.detail}</span>
              </li>
            ))}
          </ul>
          {search.data?.truncated && !waiting && (
            <p className="mt-3 text-sm text-text-secondary">
              Showing the first five matches in each category. Refine your search for more specific
              results.
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
