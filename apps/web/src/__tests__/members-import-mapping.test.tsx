import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import MembersImportPage from '@/app/admin/import/members/page';
import { BRAND } from '@/lib/brand';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/admin/import/members',
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

const mockPreview = jest.fn();
const mockImport = jest.fn();
jest.mock('@/lib/api/data-import', () => ({
  previewMembersImport: (...args: unknown[]) => mockPreview(...args),
  importMembers: (...args: unknown[]) => mockImport(...args),
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

const PARENT_COLUMNS = 'Parent Name,Parent Email';
const PARENT_VALUES = 'Amy Chen,amy.chen@example.com';

describe('Members import mapping flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockPreview.mockResolvedValue({
      summary: {
        families_to_create: 1,
        families_matched: 0,
        members_to_create: 1,
        members_to_update: 0,
        squads_matched: [],
        squads_missing: [],
      },
      row_results: [],
    });
  });

  it('shows the Swim Central hint for AU clubs', () => {
    render(<MembersImportPage />);
    expect(screen.getByText(/Importing from Swim Central\?/)).toBeInTheDocument();
    expect(screen.getByText(/Full Members Report/)).toBeInTheDocument();
  });

  it('auto-maps familiar export headers and goes straight to the preview', async () => {
    render(<MembersImportPage />);

    uploadCsv(
      `Member Number,Given Name,Surname,Date of Birth,Gender,${PARENT_COLUMNS}\n` +
        `12345,Mia,Chen,05/06/2015,Female,${PARENT_VALUES}\n`
    );

    // Straight past the mapping step to the preview table.
    await waitFor(() => {
      expect(screen.getByText('1 valid row')).toBeInTheDocument();
    });
    expect(
      screen.queryByText(`Match your columns to ${BRAND.name} fields`)
    ).not.toBeInTheDocument();

    // Rendered through the mapping: names, day-first date, normalised gender.
    expect(screen.getByText('Mia')).toBeInTheDocument();
    expect(screen.getByText('Chen')).toBeInTheDocument();
    expect(screen.getByText('2015-06-05')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.getByText('1 valid row')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import 1 Gymnast/ })).toBeEnabled();
  });

  it('shows the mapping step when a required column cannot be guessed', async () => {
    render(<MembersImportPage />);

    uploadCsv(
      `Given Name,Surname,Born,Gender,${PARENT_COLUMNS}\nMia,Chen,14/03/2015,F,${PARENT_VALUES}\n`
    );

    await waitFor(() => {
      expect(screen.getByText(`Match your columns to ${BRAND.name} fields`)).toBeInTheDocument();
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
    render(<MembersImportPage />);

    uploadCsv(
      `First Name,Last Name,DOB,Gender,${PARENT_COLUMNS}\n` +
        `Mia,Chen,31/02/2015,F,${PARENT_VALUES}\n` +
        `Noah,Singh,14/03/2015,M,Raj Singh,raj.singh@example.com\n`
    );

    await waitFor(() => {
      expect(screen.getByText('1 valid row')).toBeInTheDocument();
    });
    expect(screen.getByText('1 row with errors')).toBeInTheDocument();
    expect(screen.getByText(/Row 1: Date of birth must be a valid date/)).toBeInTheDocument();
  });
});
