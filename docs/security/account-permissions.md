# Account management boundaries

TEM-113 uses explicit administrator permission for account creation, bulk staff import and account deletion. Other authenticated users can update only their own first name, last name, email and password. Role, active state, family association and another account's profile are administrator-only changes. Rejected requests do not call the write service.

Account-management reads and writes require the current club in their database predicates. New users are stamped with that club; family associations must resolve in the same club. A guessed user ID in another club cannot be read, edited or deleted, including by an administrator. Missing tenant context fails closed.

Authentication is intentionally separate: JWT validation performs an explicitly named global user lookup before the tenant interceptor runs, requires an active account with the token's club and session version, and returns the current account role. Login credentials and global email uniqueness checks keep their existing purpose. Ordinary request routes do not use the authentication lookup.

The existing password-change session invalidation and reset-link revocation are preserved. No new roles, database migration or changes to other modules' role hierarchy are introduced. The staff-import page displays an administrator-only message to other roles; the API remains authoritative for stale browser sessions.

Existing-account invitation acceptance now requires authentication and uses the current account ID. The optional legacy userId must match that account. Public token verification and new-account registration with an invitation remain available. The scoped account write also rejects invitations for a different club's family.

Verification covers every primary role on account creation/deletion and own/other account edits, restricted field injection, scoped reads and mutations, foreign family references, missing tenant context, inactive accounts, stale roles and token-club mismatch. Repository tenant tests use a predicate-aware in-memory store; they do not claim live PostgreSQL execution. Full repository gates and synthetic deployed acceptance must be recorded separately before closure.
