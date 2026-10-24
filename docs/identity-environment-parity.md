# Local and deployed identity/configuration parity

## Findings

| Symptom | Root cause | Classification |
| --- | --- | --- |
| Lakshman is Factory Administrator locally but Standard User on Vercel | The canonical hierarchy requires explicit client membership and factory assignments. A fresh deployment browser has none. The previous role resolver therefore returned Standard User even though the legacy directory supplies Zone Leader/Admin/Auditor roles. Local prepared Egmore data can supply a real Factory Admin assignment. | Confirmed resolver/default-data mismatch; origin-local assignments explain the reported administrator difference. The user's existing browser storage was not accessed. |
| Profile lists several roles while the header says Standard User | Profile read `AdminUser.roles`, while the header used `resolveCanonicalProfileRole`. These are different sources for legacy/scoped identities. | Confirmed presentation/identity-resolution defect. |
| Dynamic profile switcher is absent on Vercel | `NATIVE_DEMO_ENABLED` is compiled from `NODE_ENV === "development"`. Production builds hide the privileged persona menu and native reset tools. | Confirmed environment gate; intentionally preserved for the public deployment. |
| Administration is absent | Canonical administration navigation requires explicit active client/factory/independent assignments. The fresh deployment browser has no v3 membership payload. The legacy role named Admin is not a canonical Factory Admin assignment. | Confirmed data initialization/authorization distinction. No administrator privilege is inferred from the person's name or legacy role label. |
| Sidebar/module availability differs | Availability comes from the active context, canonical authorization and the origin's factory entitlement payload, including the compatibility projection of older module maps. These values are not shared between localhost and Vercel. | Confirmed origin-local data/context mechanism. Specific existing local entitlement values were not inspected. |
| A saved operational user loses factory context on a new session | Context is stored independently from identity; before this change no login bootstrap selected an unambiguous already-authorized scope. Factory-only users also had no context chooser when assigned several factories. | Confirmed context initialization/selection gap. |

A fresh isolated browser on the public deployment reproduced **Lakshman / Standard User**, missing privileged switching and no Administration link. The only stored access/configuration key after that check was the factory entitlement key; there were no persisted canonical client/factory memberships.

## Version comparison

- Local HEAD and GitHub `oe-admin/main`: `e83e65cf233576ec69b7879e49307c16a3146147` at investigation time.
- GitHub reports a successful Vercel deployment for that commit, with deployment status URL: <https://vercel.com/rrumeshbabu-5020s-projects/oe-admin/5XGeWT96ZVH6FTcAxaso1EkAVPqN>.
- The public alias does not expose its exact commit SHA, and GitHub's deployments list returned no records. The alias-to-immutable-deployment mapping could not be independently proven.
- No local/main version mismatch was found. The reported behavior was reproducible from the source's fresh-storage defaults and development-only feature gate; it does not require a stale deployment to explain it.

## Canonical resolution and corrections

`getCurrentDemoUser` still selects the existing identity ID. `resolveCanonicalProfile` now supplies a common primary role and responsibility list:

1. Scoped identities resolve active client/factory relationships through the existing canonical hierarchy and `resolveFactoryPerson` policy.
2. Canonical assignments are interpreted in the selected factory/client, rather than displaying the first role found in an unrelated factory.
3. Legacy ABC identities use their existing directory role fields only when they have no canonical relationship history and no foreign scope. This is presentation compatibility, not an administrator assignment or permission migration.
4. Inactive memberships and revoked assignments never revive legacy authority. Invalid/stale selections are preserved and rejected, rather than silently replaced.
5. Profile uses the same primary role as the header/sidebar/dashboard. Its separate Responsibilities field preserves the additional role information. Plant and Zone display follow the selected canonical factory.
6. Current-user rendering subscribes to canonical access/configuration changes, so role changes propagate without relying on unrelated component updates.

`initializeCurrentAccessContext` runs after demo authentication and on authenticated reload. It keeps valid saved selections, chooses only one unambiguous authorized administrative/factory context for the **same person**, and otherwise requires selection. It never changes identity IDs, creates assignments, modifies entitlements, or replaces invalid saved context. Factory-only users with multiple authorized factories can use the existing context selector; this changes scope for the same identity, not accounts.

## Fresh and populated storage behavior

- Fresh public/development baseline: the same source-controlled ABC/Egmore legacy defaults and initial Lakshman identity. The corrected primary role is Zone Leader. No canonical Factory Admin assignment is manufactured.
- Populated canonical Egmore data: Lakshman displays Factory Administrator only if the saved active relationships actually grant it. If his only authorized factory is Egmore and no context is saved, login restores that factory. Existing entitlements determine modules.
- Initialization does not import another origin's data, reset localStorage, or force a prepared local dataset onto the public deployment.
- Development native multi-client initialization and explicit reset are now separate operations. Repeated initialization of a supported initialized dataset is a no-op: identity, selection, user edits, revocations, revisions and history remain unchanged.
- An unsupported/incomplete manifest, unsupported administration schema, or populated workspace without a native manifest is preserved and initialization is rejected with a visible error. It is not overwritten to force a match. The explicitly confirmed development reset retains its existing separate behavior.
- Native first-time initialization expects an empty workspace. Normal app usage can already populate module records; use an isolated workspace before operational work for first-time native seeding. Initialization refuses such populated workspaces rather than resetting them.
- The privileged switcher's development UI remains gated. The switching function now additionally rejects production calls before any identity/storage mutation. Native initialization/reset remain development-only. No public demo-enable flag or client-side access token was added.

## Data architecture

| Data | Source of truth / persistence | Cross-device expectation |
| --- | --- | --- |
| ABC/Egmore default directory, plants, Zones, sample Actions/Audits and module seeds | Source-controlled fixtures and store defaults | The same build supplies the same default inputs; saved edits override them locally. |
| Native multi-client personas/records | Source-controlled compressed fixture, explicitly materialized in development browser storage | Not automatically initialized on the public production site; source fixture availability is not a shared database. |
| Egmore prepared memberships, Factory Admin, independent roles and module records | Source-controlled preparation routines, materialized in browser storage | Only browsers/origins where preparation was explicitly run have those persisted relationships. |
| Identity selection and demo login | `five-s-demo-role`, `ops-administration-demo-person-v1`, `5s-auth-session` | Browser/origin-local. The demo login is not server-backed authentication. |
| Selected client/factory | `ops-active-access-context-v1` (version 1) | Browser/origin-local and validated against the current identity. |
| Directory/configuration | `five-s-administration-users-v1`, `ops-organization-configuration-v1` | Browser/origin-local, with source defaults when absent. |
| Client/factory memberships and administration | `ops-access-v3-administration-v1` (version 1) | Browser/origin-local. Optional legacy `factoryRequests` and `auditorGrants` remain normalized in memory by the existing reader. |
| Independent assignments/Departments | `ops-access-v4-administration-v1` (schemaVersion 1) | Browser/origin-local; unsupported schemas remain rejected. |
| Factory modules | `ops-organization-modules-v1` (payload version 2 despite the historical key name) | Browser/origin-local. Existing legacy-to-factory normalization remains unchanged. |
| Demo launcher metadata | `ops-final-role-demo-v1` (version 1) | Browser/origin-local; metadata does not authorize a person. |
| Operational records, profile edits and evidence | Existing localStorage stores and browser binary/IndexedDB storage where implemented | Not synchronized across devices/origins. |
| Server-backed identity/organization/module records | No such backend was found in this repository | No shared multi-user record persistence is provided. Existing voice/KPI provider API routes do not constitute identity/module storage. |

Localhost, the public Vercel alias, preview URLs and other devices must be treated as separate storage contexts. Equivalent canonical records + identity + context + entitlement values now resolve consistently; a local Factory Admin assignment is not evidence that another origin has that assignment.

## Vercel configuration and deployment

No environment-variable change is required for these fixes. Keep the public deployment in normal production mode; do not set `NODE_ENV=development` or add a public demo-switching flag. Per the user's instruction, privileged production switching stays disabled.

The changes must be reviewed and deployed to take effect on Vercel. No commit, push or deployment was performed. Reproducing the prepared local administrator dataset publicly would require an explicitly authorized provisioning/data-transfer mechanism; no new backend, public impersonation route, storage overwrite or such mechanism was introduced. A protected privileged demo would need a real server-enforced access gate as a separate decision.

## Validation

- `npx tsc --noEmit`: passed.
- `npm run build`: blocked locally by the same Turbopack worker restriction (`binding to a port: Operation not permitted`). Build settings were not changed or checking suppressed.
- `npm run build -- --webpack`: passed compilation, TypeScript validation, page generation and production optimization.
- Focused identity/context/authorization/Profile/Action tests: 209 passed across 13 suites.
- Full suite: 1,438 passed, 125 failed. All remaining failure groups were already present before this task; no new failure groups appeared.
- ESLint on changed files: passed. Repository-wide lint still has the two existing JSX escaping errors in `components/modules/module-gate.tsx:31` and 12 warnings.
- Production-browser verification: fresh and isolated populated contexts passed. Header/Profile roles agree; saved Factory Admin scope restores on login; Administration appears only with the supplied assignments; disabled Visual Management stays absent; checked operational/entitlement/access/user records remain byte-identical through login and reload. No page/console errors were observed in these checks.
- Development/production parity and production-switching denial are covered by automated tests. The existing localhost development server did not render a usable isolated login screen during an additional development UI check; it was not stopped or reset.

## Files changed

- `lib/demo/canonical-profiles.ts`: common role/responsibility projection and canonical eligibility checks.
- `lib/current-user.ts`: scoped identity projection, canonical subscriptions, selected Plant/Zone display.
- `features/profile/profile-page.tsx`: canonical role/responsibilities and scoped directory profile lookup.
- `features/five-s/administration/access-v4-context.ts`: non-destructive, identity-preserving context initialization.
- `components/auth/auth-provider.tsx`: initialize the current identity's scope after authentication/reload.
- `components/navigation/access-context-selector.tsx`: same-person selection for multi-factory users.
- `components/navigation/user-menu.tsx`: reachable development initialization control independent of default hierarchy presence.
- `lib/demo/native-demo-data.ts`: schema-aware/idempotent initialization distinct from explicit reset.
- `lib/demo/switch-final-persona.ts`: production switching denial before mutations.
- `tests/identity-context-parity.test.ts`: fresh/populated, development/production, revoked/inactive, schema, preservation and switching checks.
- `tests/build-identity-demo-regression.test.ts`: retain explicit reset coverage separately from first-time initialization.
- This report.
