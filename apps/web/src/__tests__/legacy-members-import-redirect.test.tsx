const mockRedirect = jest.fn();
jest.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

import LegacyMembersImportPage from '@/app/members/import/page';

describe('The retired roster wizard at /members/import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends old links and bookmarks to the importer that replaced it', () => {
    LegacyMembersImportPage();

    expect(mockRedirect).toHaveBeenCalledWith('/admin/import/members');
  });
});
