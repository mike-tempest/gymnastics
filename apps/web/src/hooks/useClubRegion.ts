'use client';

import { useQuery } from '@tanstack/react-query';

import { getMyClub, type MyClub } from '@/lib/api/clubs';
import {
  countryName,
  countyLabel,
  defaultTimezoneForCountry,
  postcodeLabel,
  timezonesForCountry,
} from '@/lib/utils/region-labels';

export interface ClubRegion {
  country: string;
  currency: string;
  timezone: string;
  locale: string;
}

const GB_DEFAULTS: ClubRegion = {
  country: 'GB',
  currency: 'GBP',
  timezone: 'Europe/London',
  locale: 'en-GB',
};

export interface UseClubRegionResult extends ClubRegion {
  /** Raw club payload, if the /clubs/me call succeeded. */
  club?: MyClub;
  isLoading: boolean;
  /** Human-readable name of the club's country. */
  countryName: string;
  /** Label for postal-code fields in the club's country. */
  postcodeLabel: string;
  /** Label for county-level region fields in the club's country. */
  countyLabel: string;
  /** Timezones available in the club's country (first entry is the default). */
  timezones: readonly string[];
}

/**
 * Resolve the current club's region from GET /clubs/me. Any error, or any
 * missing field, falls back to the GB defaults so the app renders sensibly
 * before the regional backend is deployed and for existing UK clubs.
 */
export function useClubRegion(): UseClubRegionResult {
  const { data: club, isLoading } = useQuery({
    queryKey: ['clubs', 'me'],
    queryFn: getMyClub,
    retry: false,
  });

  const country = club?.country || GB_DEFAULTS.country;

  return {
    club,
    isLoading,
    country,
    currency: club?.currency || GB_DEFAULTS.currency,
    timezone: club?.timezone || defaultTimezoneForCountry(country),
    locale: club?.locale || GB_DEFAULTS.locale,
    countryName: countryName(country),
    postcodeLabel: postcodeLabel(country),
    countyLabel: countyLabel(country),
    timezones: timezonesForCountry(country),
  };
}
