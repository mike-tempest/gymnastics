import records from '../data/clubs.json';
import { BRAND } from '../config';

export interface Club {
  slug: string;
  name: string;
  nation: string;
  region: string;
  town: string;
  addresses: string[];
  website: string | null;
  disciplines: string[];
  sources: { label: string; url: string }[];
  checkedAt: string;
}
export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const clubs: Club[] = [...records].sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
export const regions = [...new Set(clubs.map((club) => club.region))].sort();
export const clubPath = (club: Club) => `/clubs/${slugify(club.region)}/${club.slug}/`;
export const regionPath = (region: string) => `/clubs/${slugify(region)}/`;
export const directoryPaths = ['/clubs/', ...regions.map(regionPath), ...clubs.map(clubPath)];
export const absolute = (path: string) => new URL(path, BRAND.website).href;
export const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
export const formatDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
