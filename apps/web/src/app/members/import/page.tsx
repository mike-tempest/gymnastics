import { redirect } from 'next/navigation';

/**
 * The original standalone roster wizard lived here. It duplicated the richer
 * importer at /admin/import/members (families, squads, a server-side preview),
 * so it was retired with the migration wizard in TEM-24.
 *
 * The route stays as a redirect: clubs bookmark it and older screens linked to
 * it, and landing on the working importer beats a 404.
 */
export default function LegacyMembersImportPage() {
  redirect('/admin/import/members');
}
