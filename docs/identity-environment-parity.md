# Approved OE Admin demo bootstrap and environment parity

## Exact root cause

The mismatch on commit `5ac903e` was caused by initialization and environment gates, not different Git commits:

1. Login selected the legacy Lakshman identity and attempted to restore context. It never called the approved native hierarchy initializer or Egmore preparation routine.
2. The native hierarchy and Egmore assignment/record preparation were separate manual development-only operations. A prepared localhost origin had saved clients, Factory Admin assignments, factory entitlements and records that a fresh Vercel origin did not.
3. Without canonical assignments, Lakshman's directory seed says Zone Leader/Admin/Auditor. The compatibility resolver therefore correctly displayed Zone Leader; those legacy labels do not establish a canonical Factory Admin assignment.
4. `NATIVE_DEMO_ENABLED = NODE_ENV === "development"` hid the switcher in every production build. A separate unconditional production check also rejected persona switching.
5. The previous fix deliberately left public production switching disabled. It unified role display and restored unambiguous context but did not provide a protected production demo mode or automatic full demo bootstrap.
6. Sidebar Administration authorization, factory module filtering and Dashboard/Reports followed the records available to that browser. Fabricating a role label or menu permission would not fix the missing canonical records.

## Corrected startup sequence

The approved demonstration uses the existing source-controlled native fixture and Egmore preparation definitions. No alternative persona directory, administration store, factory model or metrics source was introduced.

1. In protected mode, the Next.js server Proxy authenticates every application/API request using server-configured HTTP Basic credentials. Missing/weak configuration fails closed.
2. `GET /api/demo/access` verifies the same server credentials and returns only an enabled boolean. It is dynamic and non-cacheable. No credentials are sent to client JavaScript, embedded in the build or stored in localStorage.
3. AuthProvider waits for this access check. The ordinary browser demo sign-in remains in place; operational children do not mount before bootstrap completes.
4. On a fresh authorized browser, `bootstrapApprovedDemo` runs the existing native initializer, creating Metric Mind and the approved ABC Manufacturing, IQ, Mitsubishi and Hyundai hierarchy, factories, Client Admins and operational users.
5. It then runs the existing Egmore preparation routine, supplying the actual canonical Egmore Factory Admin assignment for Lakshman, Zone allocations, Departments, independent role assignments, module entitlements and operational records.
6. It validates the canonical identity and Factory Admin assignment, then selects the approved default: `USR-LAKSHMAN`, `abc-manufacturing`, `PLANT-EGM`. The displayed Factory Administrator role comes from those actual records, not from the default descriptor or a directory array position.
7. A small versioned bootstrap marker (`ops-approved-demo-bootstrap-v1`, version 1) records successful initialization. It is initialization metadata, not authorization or a second data store.
8. Only then does the workspace render. Header/Profile, the nested switcher, Administration, Dashboard and Reports read the existing canonical identity/context/stores.

Development permits the same bootstrap through the existing local development policy. Production requires explicit protected mode and the server credential gate. Public production mode never gains privileged switching from a `NEXT_PUBLIC_` variable, browser storage flag or caller-supplied header.

## Existing data and lifecycle integrity

- Repeated initialization validates supported schemas and returns without reseeding records, reassigning roles, changing selection or resetting entitlements.
- Existing prepared native + Egmore datasets can be adopted without rebuilding them.
- A populated workspace without the completed approved dataset is preserved. It receives a visible notice directing the operator to use a separate fresh browser profile for first-time demonstration setup. It is not merged or overwritten merely to force parity.
- Unsupported bootstrap/administration/manifest versions and pending administration recovery stop initialization and preserve original payloads.
- Native/Egmore seeding and default selection are rolled back together if initialization fails. Concurrent attempts share one pending initialization.
- Canonical ID strategy, existing persistence keys/schemas, factory seat limits, independent verification and workflow rules remain unchanged. The added marker does not migrate existing entity schemas.
- Explicit reset controls remain separate from initialization and still require the existing confirmation. They are visible only in an authorized demo environment and retain their prior canonical authority requirements.

## Identity, switching and Administration

The existing common `resolveCanonicalProfile` projection and selected factory determine the role. The bootstrap validates a real active Egmore Factory Admin assignment before selecting Lakshman.

The existing dynamic menu lists clients, factories and users from `getCanonicalProfileHierarchy`; search and identity-plus-context selection are preserved. AuthProvider's server-verified demo access state controls visibility, and switching/initialization helpers also check demo access. The helpers are presentation/demo controls behind the server gate, not a replacement for server authorization of future multi-user data.

Administration still uses `canOpenV4Administration` and the existing canonical membership/role policies. Metric Mind, Client Admin and Factory Admin flows, factory entitlements/capacity and independent Zone/Department roles are not bypassed to display a menu. Switching from Lakshman to a non-administrator removes Administration where the existing policy denies it.

Dashboard and Reports continue reading canonical module/Action records in the selected context. The bootstrap uses approved source fixtures; it does not copy screenshot values or invent metric counts.

## Required Vercel configuration

For a deployment intended to expose the approved privileged demonstration, set **server-side** environment variables for that deployment environment:

| Variable | Required value |
| --- | --- |
| `OE_DEMO_MODE` | `protected` |
| `OE_DEMO_ACCESS_USERNAME` | A non-empty demo-access username without a colon |
| `OE_DEMO_ACCESS_PASSWORD` | A unique secret of at least 16 characters |

Do not put the credentials in `NEXT_PUBLIC_` variables, source control, URLs, frontend forms or localStorage. Use HTTPS on the hosted deployment and share access credentials only with authorized reviewers. Keep `NODE_ENV=production` on Vercel.

Protected mode applies to the entire deployment, including API routes. Static Next assets and favicon requests are excluded from the Proxy matcher so asset loading is not interrupted. Basic credentials are checked with a constant-time digest comparison. Unauthorized application/API requests receive HTTP 401; protected mode with incomplete/weak configuration receives HTTP 503. Protected responses and the access endpoint use private/no-store caching.

After the code is reviewed and deployed with those variables, open a fresh private browser profile, authenticate at the browser's demo-access prompt, then use the existing application demo sign-in. The first authorized sign-in prepares the approved dataset and selects Lakshman/Egmore. Subsequent sign-ins preserve saved state.

For normal public production, leave `OE_DEMO_MODE` unset/empty. Privileged bootstrap, reset and profile switching stay disabled. It is expected that this mode uses ordinary source defaults rather than the privileged prepared demonstration.

No Vercel settings, credentials or live deployment were changed by this task. No commit, push or deployment was performed.

## Data architecture and cross-device expectations

| Records | Source / persistence |
| --- | --- |
| Native multi-client hierarchy, factory definitions, approved identities/roles and Egmore operational examples | Source-controlled native fixture, extension definitions and Egmore seed routine |
| Instantiated clients, factories, user directory, memberships, role assignments, factory limits and entitlements | Existing browser-local canonical stores/localStorage |
| Actions, Gemba, Red Tag, CI, VI, VM, Audits, profile edits and evidence | Existing browser-local module stores; binary evidence uses existing browser storage where implemented |
| Current person and factory/client selection | Existing origin-local identity/context keys |
| Protected-demo access credentials | Server environment only; not browser-local record data |
| Shared multi-user operational database | None was added; none exists for these records in the current application |

A fresh authorized browser using the same source build receives the same approved initial inputs in development and protected production. Saved edits remain specific to the browser/origin. Localhost, Vercel aliases, preview domains and different devices do not synchronize localStorage or binary evidence. This task adds a server access gate, not shared identity/operational persistence.

## Main files changed

- `proxy.ts`, `lib/demo/demo-access-server.ts`, `app/api/demo/access/route.ts`: server-enforced protected-demo access and capability discovery.
- `lib/demo/demo-access.ts`: server-verified client capability, shared by existing demo helpers.
- `lib/demo/approved-demo-bootstrap.ts`: initialization orchestration, schema/idempotence checks, default canonical selection and rollback.
- `components/auth/auth-provider.tsx`, `components/auth/auth-gate.tsx`: await initialization, expose demo access state, display initialization errors/notices.
- `components/navigation/user-menu.tsx`: preserve the existing nested dynamic switcher in authorized production.
- `lib/demo/native-demo-data.ts`, `lib/demo/egmore-demo-data.ts`, `lib/demo/switch-final-persona.ts`: replace unconditional development/production checks with the common authorized-demo capability.
- `features/settings/scoped-settings.tsx`, `features/settings/egmore-demo-controls.tsx`: retain authorized demo maintenance controls and existing scope checks.
- Protected access/bootstrap tests and the updated public-production denial test.

## Validation

- TypeScript: `npx tsc --noEmit` passed.
- Production build: `npm run build -- --webpack` passed compilation, TypeScript validation, page generation and Proxy compilation. The unchanged standard `npm run build` remains blocked in this sandbox by Turbopack's worker port-binding restriction (`Operation not permitted`); no checking was disabled.
- Focused tests: 231 passed across 15 suites, covering server access, initialization, schema preservation, rollback, concurrent initialization, canonical identity/context, Administration authorization, factory entitlements, independent Action workflows and existing integrations.
- Full suite: 1,460 passed, 125 failed. Every remaining failure group was present in the pre-task baseline; no new failure groups appeared.
- Changed-file ESLint and `git diff --check`: passed. Repository-wide ESLint still reports the same two existing JSX escaping errors in `components/modules/module-gate.tsx:31` and 12 warnings.
- Real-browser fresh-profile checks passed against both an isolated development server and a production build. Canonical client/factory/role/limit/entitlement/Action/Audit/Gemba projections were equal.
- Both authorized environments started at Lakshman / Factory Administrator / ABC Manufacturing / Egmore Plant. Profile agreed with the header. Administration was visible for the actual assignment, and disappeared after switching to a non-administrator.
- The original client hierarchy, search, Metric Mind switching, Client Admin scope and factory persona selection worked in both environments.
- Reload preserved checked canonical payloads byte-for-byte. A saved disabled Visual Management entitlement remained disabled after bootstrap/reload.
- Anonymous protected-production page and API requests were denied. Public production retained its ordinary baseline and had no privileged switcher or approved-demo bootstrap marker.
- An unsupported populated entitlement schema retained its original bytes and produced an actionable initialization error. No page/console errors occurred in the completed browser checks.

The browser checks used isolated storage profiles and generated temporary test credentials. No existing user browser storage, live Vercel configuration or deployment was changed.
