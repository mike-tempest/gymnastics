/**
 * Feature flags for the web app.
 *
 * Whether the swimming times/strokes competitions UI is enabled. OFF by
 * default (TEM-15): the module stays in the tree for a possible future
 * gymnastics scoring module, but its nav items, routes and page sections are
 * hidden. Only the exact string 'true' enables it.
 *
 * NEXT_PUBLIC_ variables are inlined at build time, so this must read the
 * variable as a literal property access for Next.js to substitute it.
 */
export function isCompetitionsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_COMPETITIONS === 'true';
}
