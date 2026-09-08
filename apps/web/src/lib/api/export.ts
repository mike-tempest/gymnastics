import { apiDownload } from './api-client';

/**
 * The full club data export.
 *
 * A club can take its whole record out at any time, without asking anyone and
 * without paying for it. The service answers with a ZIP of CSVs and names the
 * file in the Content-Disposition header; the fallback below is only used if
 * that header is stripped by a proxy.
 */
export async function downloadClubExport(): Promise<void> {
  return apiDownload('/export/club.zip', 'club-data-export.zip');
}
