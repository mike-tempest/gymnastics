import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import GoCardlessImportPage from '@/app/admin/import/gocardless/page';
import {
  MIGRATION_JOURNEY_STORAGE_KEY,
  createJourney,
  saveJourney,
} from '@/lib/import/migration-journey';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
  usePathname: () => '/admin/import/gocardless',
}));

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Admin', role: 'ADMIN' } }, status: 'authenticated' }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/components/layout/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockPreview = jest.fn();
const mockImport = jest.fn();
jest.mock('@/lib/api/data-import', () => ({
  previewGoCardlessImport: (...args: unknown[]) => mockPreview(...args),
  importGoCardless: (...args: unknown[]) => mockImport(...args),
}));

const CUSTOMERS_CSV =
  'id,created_at,email,given_name,family_name,company_name,address_line1,address_line2,city,region,postal_code,country_code,phone_number\n' +
  'CU0001,2023-09-04T09:12:44.000Z,sarah.hartley@example.co.uk,Sarah,Hartley,,14 Meadow Lane,,Leeds,West Yorkshire,LS6 3AB,GB,07700 900123\n';

const MANDATES_CSV =
  'id,created_at,status,scheme,reference,customer\n' +
  'MD0001,2023-09-04T09:13:02.000Z,active,bacs,CLUB-0001,CU0001\n';

function uploadFiles(...files: { name: string; content: string }[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, {
    target: {
      files: files.map((f) => new File([f.content], f.name, { type: 'text/csv' })),
    },
  });
}

function storedJourney() {
  const raw = window.localStorage.getItem(MIGRATION_JOURNEY_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function runTheImport() {
  uploadFiles(
    { name: 'customers.csv', content: CUSTOMERS_CSV },
    { name: 'mandates.csv', content: MANDATES_CSV }
  );

  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Continue to Preview/ })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: /Continue to Preview/ }));

  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Import 1 mandate/ })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: /Import 1 mandate/ }));

  await waitFor(() => expect(screen.getByText(/Takeover complete/)).toBeInTheDocument());
}

describe('An importer reached through the migration wizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();

    mockPreview.mockResolvedValue({
      summary: {
        families_to_create: 1,
        families_matched: 0,
        mandates_to_create: 1,
        active_mandates_to_create: 1,
        mandates_skipped: 0,
      },
      customer_results: [],
      mandate_results: [],
    });
    mockImport.mockResolvedValue({
      summary: {
        families_created: 1,
        families_matched: 0,
        mandates_created: 1,
        active_mandates_created: 1,
        mandates_skipped: 0,
        payments_imported: 0,
      },
      errors: [],
      warnings: [],
    });
  });

  it('shows where the club is in the journey and records what came across', async () => {
    saveJourney(createJourney(['spreadsheet', 'gocardless']));

    render(<GoCardlessImportPage />);

    await waitFor(() =>
      expect(screen.getByText('Step 5 of 5 of your migration')).toBeInTheDocument()
    );

    await runTheImport();

    expect(storedJourney().outcomes.gocardless).toMatchObject({
      counts: { families: 1, mandates: 1, activeMandates: 1 },
      errorCount: 0,
      warningCount: 0,
    });
    expect(screen.getByRole('link', { name: /Continue your migration/ })).toHaveAttribute(
      'href',
      '/admin/import/migration'
    );
  });

  it('leaves the importer alone when there is no migration in progress', async () => {
    render(<GoCardlessImportPage />);

    await runTheImport();

    expect(screen.queryByText(/of your migration/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Continue your migration/ })).not.toBeInTheDocument();
    expect(storedJourney()).toBeNull();
  });

  it('does not join a journey that never included this importer', async () => {
    saveJourney(createJourney(['spreadsheet']));

    render(<GoCardlessImportPage />);

    await runTheImport();

    expect(screen.queryByText(/of your migration/)).not.toBeInTheDocument();
    expect(storedJourney().outcomes).toEqual({});
  });
});
