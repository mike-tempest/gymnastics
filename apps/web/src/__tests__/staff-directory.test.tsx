import { GoverningBody, governingBodyConfig } from '@club-manager/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AddCheckModal from '@/components/compliance/AddCheckModal';
import { createDbsCheck } from '@/lib/api/compliance';
import { listStaffDirectory } from '@/lib/api/staff';

jest.mock('@/lib/api/staff', () => ({ listStaffDirectory: jest.fn() }));
jest.mock('@/lib/api/compliance', () => ({ createDbsCheck: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

function renderForm() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AddCheckModal
        config={governingBodyConfig(GoverningBody.BRITISH_GYMNASTICS)}
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />
    </QueryClientProvider>
  );
}

describe('DBS staff picker', () => {
  beforeEach(() => jest.clearAllMocks());
  it('selects staff from the narrow directory and attributes the check', async () => {
    (listStaffDirectory as jest.Mock).mockResolvedValue([
      { user_id: 'staff-id', first_name: 'Rachel', last_name: 'Oduya', role: 'head_coach' },
    ]);
    (createDbsCheck as jest.Mock).mockResolvedValue({});
    renderForm();
    expect(await screen.findByRole('option', { name: 'Rachel Oduya' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Staff member or volunteer'), 'staff-id');
    await userEvent.type(screen.getByLabelText(/certificate number/i), 'DBS123');
    await userEvent.type(screen.getByLabelText('Issue date'), '2026-09-01');
    await userEvent.click(screen.getByRole('button', { name: 'Save check' }));
    await waitFor(() =>
      expect(createDbsCheck).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'staff-id', certificate_number: 'DBS123' })
      )
    );
  });
  it('shows a directory failure instead of an unexplained empty list', async () => {
    (listStaffDirectory as jest.Mock).mockRejectedValue(new Error('Forbidden'));
    renderForm();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load staff');
  });
});
