# Safeguarding incident access

TEM-112 closes inherited role access to incident records. The change uses the existing exact-role guard and leaves the general role hierarchy unchanged.

| Route                                                     | Allowed current account role         |
| --------------------------------------------------------- | ------------------------------------ |
| Read club safeguarding incidents                          | Super administrator, Welfare Officer |
| Record a safeguarding incident                            | Super administrator, Welfare Officer |
| Download the full club export, including incident records | Super administrator only             |

Treasurers, head coaches, squad coaches, competition secretaries and member/parent roles do not inherit incident access. The safeguarding page does not request or display incidents for these roles. The full-export component offers its download action only to a super administrator. API enforcement remains authoritative if the browser session is stale.

Authentication reloads the current account for every API request and rejects inactive accounts and invalidated session versions. The role in an old token does not grant incident access after the account's role is removed. This fork has one role per account; additional-role support is not introduced by this fix.

Incident reads and creates retain the existing tenant-scoped service. Full exports retain their existing tenant boundary and audit trail. The incident lifecycle, sensitive-read audit policy, restricted notes and broader compliance permission policies remain discovery work in TEM-76.

Verification includes real HTTP RolesGuard checks for every primary role on read, create and full export; a role-removal regression; frontend request/render tests; existing incident service tenant tests; export tenant-isolation tests; and inactive/session-version authentication tests. The HTTP permission tests stub authentication to supply a current role and do not claim to test JWT signature validation or a live provider.
