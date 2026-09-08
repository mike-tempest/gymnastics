import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockDownloadClubExport = jest.fn();
jest.mock('@/lib/api/export', () => ({
  downloadClubExport: (...args: unknown[]) => mockDownloadClubExport(...args),
}));

import { DataExportCard } from '../components/settings/DataExportCard';
import { ApiError } from '../lib/api/api-client';
import { MEMBER_NOUN_PLURAL_LOWER } from '../lib/brand';

describe('DataExportCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadClubExport.mockResolvedValue(undefined);
  });

  it('says plainly that the data belongs to the club', () => {
    render(<DataExportCard />);

    expect(screen.getByText(/this is your data/i)).toBeInTheDocument();
    expect(screen.getByText(/no request, no charge/i)).toBeInTheDocument();
  });

  it('uses the display noun rather than hard-coding a sport', () => {
    render(<DataExportCard />);

    expect(screen.getAllByText(new RegExp(MEMBER_NOUN_PLURAL_LOWER)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\bmembers\b/i)).not.toBeInTheDocument();
  });

  it('names the deliberate exclusions rather than quietly dropping them', () => {
    render(<DataExportCard />);

    expect(screen.getByText(/wellbeing and cycle logs are left out/i)).toBeInTheDocument();
    expect(screen.getByText(/passwords and single-use invitation links/i)).toBeInTheDocument();
  });

  it('downloads the export and confirms it', async () => {
    const user = userEvent.setup();
    render(<DataExportCard />);

    await user.click(screen.getByRole('button', { name: /download all your data/i }));

    await waitFor(() => expect(mockDownloadClubExport).toHaveBeenCalledTimes(1));
    expect(mockToastSuccess).toHaveBeenCalledWith('Your export has been downloaded');
  });

  it('reports a failure instead of appearing to succeed', async () => {
    mockDownloadClubExport.mockRejectedValue(new Error('Unauthorised'));
    const user = userEvent.setup();
    render(<DataExportCard />);

    await user.click(screen.getByRole('button', { name: /download all your data/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Unauthorised'));
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('explains a refusal rather than showing a bare Forbidden', async () => {
    mockDownloadClubExport.mockRejectedValue(new ApiError('Forbidden resource', 403));
    const user = userEvent.setup();
    render(<DataExportCard />);

    await user.click(screen.getByRole('button', { name: /download all your data/i }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'Only a club administrator can download the full export'
      )
    );
  });

  it('explains a rate limit rather than looking broken', async () => {
    mockDownloadClubExport.mockRejectedValue(new ApiError('Too Many Requests', 429));
    const user = userEvent.setup();
    render(<DataExportCard />);

    await user.click(screen.getByRole('button', { name: /download all your data/i }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'An export was started very recently. Please try again in a few minutes.'
      )
    );
  });
});
