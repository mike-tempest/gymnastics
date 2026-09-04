import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import SwimmersImportPage from '@/app/swimmers/import/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/swimmers/import',
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Admin', role: 'ADMIN' } }, status: 'authenticated' }),
}));

// Mock sonner
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// Keep the layout out of the way
jest.mock('@/components/layout/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockBulkImport = jest.fn();
jest.mock('@/lib/api/swimmers', () => ({
  bulkImportSwimmers: (...args: unknown[]) => mockBulkImport(...args),
}));

const mockRegion = {
  country: 'AU',
  currency: 'AUD',
  timezone: 'Australia/Sydney',
  locale: 'en-AU',
  club: undefined,
  isLoading: false,
  countryName: 'Australia',
  postcodeLabel: 'Postcode',
  countyLabel: 'State',
  timezones: ['Australia/Sydney'],
};
jest.mock('@/hooks/useClubRegion', () => ({
  useClubRegion: () => mockRegion,
}));

function uploadCsv(content: string, name = 'roster.csv') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([content], name, { type: 'text/csv' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('Swimmers import mapping flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the Swim Central hint for AU clubs', () => {
    render(<SwimmersImportPage />);
    expect(screen.getByText(/Importing from Swim Central\?/)).toBeInTheDocument();
    expect(screen.getByText(/Full Members Report/)).toBeInTheDocument();
  });

  it('auto-maps Swim Central style headers and goes straight to the preview', async () => {
    render(<SwimmersImportPage />);

    uploadCsv(
      'Member Number,Given Name,Family Name,Date of Birth,Gender\n' +
        '12345,Mia,Chen,05/06/2015,Female\n',
    );

    await waitFor(() => {
      expect(screen.getByText(/matched automatically/i)).toBeInTheDocument();
    });

    // Rendered through the mapping: names, day-first date, normalised gender.
    expect(screen.getByText('Mia')).toBeInTheDocument();
    expect(screen.getByText('Chen')).toBeInTheDocument();
    expect(screen.getByText('2015-06-05')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('1 valid row')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import 1 Swimmer/ })).toBeEnabled();
  });

  it('shows the mapping step when a required column cannot be guessed', async () => {
    render(<SwimmersImportPage />);

    uploadCsv('Given Name,Family Name,Born\nMia,Chen,14/03/2015\n');

    await waitFor(() => {
      expect(screen.getByText('Match your columns to Swimly fields')).toBeInTheDocument();
    });

    // The unrecognised column is flagged, not fatal.
    expect(screen.getByText(/will be ignored/)).toBeInTheDocument();
    expect(screen.getByText(/Map these required fields before continuing/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue to Preview/ })).toBeDisabled();

    // Map "Born" onto the date of birth field and continue.
    fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: 'Born' } });
    const continueButton = screen.getByRole('button', { name: /Continue to Preview/ });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText('2015-03-14')).toBeInTheDocument();
    });
    expect(screen.getByText('1 valid row')).toBeInTheDocument();
  });

  it('flags invalid dates per row instead of failing the file', async () => {
    render(<SwimmersImportPage />);

    uploadCsv(
      'First Name,Last Name,DOB\n' +
        'Mia,Chen,31/02/2015\n' +
        'Noah,Singh,14/03/2015\n',
    );

    await waitFor(() => {
      expect(screen.getByText('1 valid row')).toBeInTheDocument();
    });
    expect(screen.getByText('1 row with errors')).toBeInTheDocument();
    expect(
      screen.getByText(/Row 1: Date of birth must be a valid date/),
    ).toBeInTheDocument();
  });
});
