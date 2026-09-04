import { readFileSync } from 'fs';
import { join } from 'path';
import * as Handlebars from 'handlebars';

/**
 * Renders the real activation template files (not mocks) so a broken
 * placeholder or malformed template fails in CI rather than in a customer's
 * inbox. Rendered for a GB club and a non-GB (AU) club; the templates carry
 * no region-specific vocabulary, so both must come out clean.
 */
describe('activation email templates', () => {
  const templatesDir = join(__dirname, 'templates');

  const render = (name: string, context: Record<string, unknown>) => {
    const source = readFileSync(join(templatesDir, `${name}.hbs`), 'utf8');
    return Handlebars.compile(source)({ year: 2026, appUrl: 'https://app.swimly.uk', ...context });
  };

  const regions = [
    { label: 'GB', clubName: 'Whitby Seals', firstName: 'Sam' },
    { label: 'AU', clubName: 'Hervey Bay Swim Club', firstName: 'Jo' },
  ];

  for (const region of regions) {
    it(`renders activation-schedule-sessions for a ${region.label} club`, () => {
      const html = render('activation-schedule-sessions', {
        firstName: region.firstName,
        activationClubName: region.clubName,
        sessionsUrl: 'https://app.swimly.uk/sessions',
        unsubscribeUrl: 'https://app.swimly.uk/unsubscribe?email=x&token=y',
      });

      expect(html).toContain(`Hi ${region.firstName}`);
      expect(html).toContain(region.clubName);
      expect(html).toContain('https://app.swimly.uk/sessions');
      expect(html).toContain('unsubscribe');
      expect(html).not.toMatch(/{{[^}]+}}/);
    });

    it(`renders activation-first-register for a ${region.label} club`, () => {
      const html = render('activation-first-register', {
        firstName: region.firstName,
        activationClubName: region.clubName,
        sessionsUrl: 'https://app.swimly.uk/sessions',
        unsubscribeUrl: 'https://app.swimly.uk/unsubscribe?email=x&token=y',
      });

      expect(html).toContain(region.clubName);
      expect(html).toContain('register');
      expect(html).not.toMatch(/{{[^}]+}}/);
    });
  }

  it('falls back to a neutral greeting without a first name', () => {
    const html = render('activation-schedule-sessions', {
      activationClubName: 'Whitby Seals',
      sessionsUrl: 'https://app.swimly.uk/sessions',
      unsubscribeUrl: 'https://app.swimly.uk/unsubscribe?email=x&token=y',
    });
    expect(html).toContain('Hi there');
  });
});
