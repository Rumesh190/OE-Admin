# OPS Access Architecture v3 — Phase 1 implementation

Date: 21 October 2026. Frontend implementation for manual UAT. No commit, push, merge or deployment.

## 1. Executive summary

Phase 1 adds explicit platform/client/factory administration while preserving existing operational roles and workflows. The canonical person remains `AdminUser.id`. Factories reuse `OrganizationPlant`; Zones retain their existing IDs. A person can have independent factory roles and multiple Zone allocations without duplicate profiles or overwriting another factory membership.

Super Admin can create/edit client profiles, retain the existing entitlement management, and explicitly appoint a Client Admin. Client Admin can create/edit factories in their client, assign Factory Admins and revoke assignments with a last-admin safeguard. Factory Admin can add/assign operational people, record exactly one of the three permitted base roles per factory, manage membership status and multiple Zone allocations, and create/edit supported Zone details. New administration profiles receive no legacy operational permissions.

Existing Admin/Auditor/Reviewer/Viewer users are not migrated. Factory Admin assignment, operational base role and client administration are separate data. Auditor grant/revoke, CI approval delegation, operational deletion mapping and the other unresolved module policies are deferred.

## 2. Source documents and pre-implementation baseline

The nine-slide `MetricMind_Operational_Excellence_Access_Architecture_v3.pptx` was reviewed during the preceding audit and remained available in Downloads. Its SHA-256 is `9f0998ae7019c5cf7bc6086d16c1861f21052e1bf6260a34a94c170d9aecadcf`. Both architecture reports were read before implementation:

- [Gap analysis](../architecture/OPS-ACCESS-ARCHITECTURE-V3-GAP-ANALYSIS.md)
- [Implementation plan](../architecture/OPS-ACCESS-ARCHITECTURE-V3-IMPLEMENTATION-PLAN.md)

The working tree already contained listing standardization, All-tab navigation, Action Type and Admin-only deletion work. It was inventoried and preserved. No reset, checkout, collection clearing or seed reset was used. Before implementation, the existing full Vitest suite passed **131 files / 1,285 tests**. Relevant organization/directory/session/entitlement models, initialization keys, primary-Zone/single-plant consumers and source ownership/reviewer fields were inspected.

## 3. Approved decisions applied

| Decision | Applied behavior |
| --- | --- |
| D01-A | Existing Plant model and IDs reused. Optional `organizationId` added. Existing missing-organization plants retain the known demo-organization compatibility association without rewriting stored records. |
| D01-B | Stable person ID, explicit client/factory memberships, independent factory base roles and multiple ID-based Zone allocations. No name-based authorization for new administration commands. |
| D02 | No automatic mapping of legacy Admin/Auditor/Reviewer/Viewer roles. No auditor grant from a role label. Sanitized legacy inventory supplied separately. |
| D09 | New client commands require actual platform identity. New factory management and FA assignment require Client Admin. New factory user/Zone commands require explicit FA assignment. No platform/Client Admin operational override added. Existing exceptional legacy platform support is retained and enumerated in the legacy inventory, including existing operational allow/deny branches. |
| D11 | Entitlement storage remains tenant/platform-owned. FA/Client Admin cannot change subscription entitlements. Factory UI reads tenant availability rather than copying it into factory settings. |

## 4. Identity and client/factory model

New typed records are in `features/five-s/administration/access-v3-types.ts`:

| Record | Stored information |
| --- | --- |
| Client membership | Stable user ID, organization ID, active state, explicit Client Admin authority, assignment actor/time and update time |
| Factory membership | Stable user ID, organization ID, existing Plant ID, one base role, status, original assigning actor/time and update time |
| Zone allocation | User/client/Plant/Zone IDs, Leader/Member responsibility, status and attribution/timestamps |
| Factory Admin assignment | User/client/Plant IDs, state, assigning actor/time and revoking actor/time |
| Administration event | Event ID, actual authenticated actor, target, client/factory scope, operation, timestamp and relevant before/after summary |

`FACTORY_BASE_ROLES` contains exactly **Zone Leader, Zone Member, Standard User**. Factory Admin and Client Admin are administrative assignments, never factory base roles.

Person profiles still live in `five-s-administration-users-v1`. New profiles carry `accessModel: "v3"`, empty legacy `roles`/`permissions`, and no fabricated legacy primary plant/Zone. Membership data is stored in `ops-access-v3-administration-v1`. There is no second person or Action-assignee directory.

`OrganizationPlant.organizationId` is additive. New factory/Zone records are written into the existing `ops-organization-configuration-v1` collection. Existing records, extra record fields and extra configuration fields are preserved. New administration reads use canonical IDs; ordinary operational configuration readers retain the known demo scope so new foreign-client factories do not become operational choices for legacy personas.

## 5. Super Admin implementation

Existing routes remain canonical:

- `/super-admin/organizations`: client listing plus functional **Create client** dialog.
- `/super-admin/organizations/[id]`: client detail, **Edit client**, **Assign Client Admin**, and existing module configuration.
- `/super-admin/organizations/[id]/modules`: existing entitlement management now recognizes new client IDs.

Client editing supports name and industry. Existing IDs and lifecycle status are retained. New clients start Active, consistent with the existing catalog model. No suspension/deletion behavior is invented. Client creation does not create users, factories, operational records or administrative assignments. Client Admin appointment is a separate confirmed operation.

The listing/detail client counts now project configured factories and known client identities rather than carrying fixture counts into newly created clients. Existing static catalog fields remain preserved in data. Default module availability follows the existing defaults until the platform changes that client's entitlements. Entitlement changes for one client do not replace other clients' configuration.

Platform may create a new administration person specifically while appointing a Client Admin, or select an eligible existing person already in the authorized client scope. Person creation is not factory user creation: the profile receives no operational permissions.

## 6. Client Admin implementation

`/settings/administration` supplies client-scoped factory management and administration history. It is linked from the existing Settings discovery page and sidebar for explicitly authorized administrators. `/settings/users` uses the new administration interface for those assignments; legacy profile maintenance remains available to existing authorized legacy personas.

Client Admin can:

- List only factories owned by their assigned client.
- Create factories with stable Plant IDs and explicit organization association.
- Edit supported location/description metadata. Existing names and locked codes are retained to avoid breaking legacy name-based source references.
- Assign an active eligible person in that client as Factory Admin through a separate confirmation.
- See assignment state/history and revoke an assignment through a confirmation.
- Read scoped member information for administration without receiving factory-user mutation authority automatically.

Client Admin cannot create/edit another client's factory, appoint FA in another client, enable tenant modules or gain operational privileges merely from the assignment. A Client Admin may be explicitly appointed FA, including themselves during an intentional bootstrap; this is a separate attributed operation, never an automatic grant.

Revocation refuses removal of the last active eligible FA for the factory. It retains the person, client membership, operational role, historical records and ownership. No transfer or deactivation is fabricated. An alternate active FA must be assigned first. A repeated assignment after revocation gets a new assignment record, retaining the earlier history.

## 7. Factory Admin implementation and Add User restrictions

Factory Admin can manage only explicitly assigned factories with an active client membership. Factory management controls do not derive from Plant Manager metadata or a legacy Admin role.

Add User is rendered only in the scoped FA interface. Its Base role selector contains exactly the three allowed values. New canonical commands reject forbidden base roles and unexpected fields including injected `roles` or `permissions` arrays. Client Admin and platform identity alone cannot call the factory user/Zone mutations.

An existing eligible client person can be assigned to another authorized factory without profile duplication. The same ID is used. Duplicate global email/employee identifiers refuse creation with a scope-safe review message; they do not expose another client's profile.

The old `createAdminUser` person-creation API is retired and rejects new legacy-role/permission payloads. Its permissive Add User trigger is removed. Existing legacy profile editing, role history and active/inactive safeguards remain supported. Legacy mutation APIs reject edits to scoped v3 profiles; scoped identities cannot be promoted by passing them through the old editor.

This closes a second creation path rather than leaving a legacy Admin bypass around the new allow-list. There is no newly granted Client Admin, Factory Admin, platform role or auditor authorization on person creation.

## 8. Factory settings, Zones and allocations

The administration screen reuses OPS headers, tabs, dialogs, fields, selectors, badges, buttons, search and responsive layouts. All is selected on initial navigation and refresh; no administration tab preference is persisted.

The selected factory exposes user/membership management and Zone configuration. Multiple allocations are stored by Zone ID. Updating one factory deactivates/reuses only that person's allocations within that factory; other factories' memberships/allocations remain unchanged. Allocation history is preserved through records and administration events.

Factory Admin can create Zones and edit their supported department metadata. Existing Zone names/codes are protected because historical sources still contain name references. New allocation metadata does not overwrite the legacy canonical leader field or grant operational Zone Leader permissions. That policy projection belongs to the later module permission phase.

The factory configuration section reads tenant module availability. It has no subscription toggles. Existing operational-module settings pages keep their approved legacy policies; this task does not grant blanket module settings authority or migrate every settings command. Pending broader settings enforcement is explicitly visible in scope, rather than presented as a working new permission.

## 9. Frontend command authorization and privacy

All new mutations in `access-v3-store.ts`:

1. Resolve the current authenticated demo actor, with optional caller ID only as an expected-identity match.
2. Require active person and canonical active client/factory scope.
3. Verify explicit active Client Admin membership or FA assignment as applicable.
4. Validate canonical target IDs, client ownership, active Zone scope and payload allow-lists.
5. Recheck authority before committing.
6. Reject wrong client/factory, unknown/name-only scope, inactive actor, forged identity and privileged payloads without successful writes/events.

Legacy users receive no implicit v3 administrative authority. New administration profiles receive no legacy operational grants. The shared administration-subject boundary keeps newly created administration-only profiles out of operational routes. Existing source/lifecycle permission helpers are not broadly rewritten. Existing unguarded legacy operational command surfaces documented by the audit remain Phase 3 work; this boundary and empty permissions are not claimed to fix those stores or provide backend enforcement.

Legacy directory UI hooks exclude scoped profiles unless an authorized administration consumer explicitly requests them. Client/factory administration selectors project only eligible client people. Another client's person cannot be selected by passing their ID. Cross-client identity linking that cannot be authorized within the current explicit client-membership model is refused for platform review, not solved by duplicating a profile or guessing a legacy mapping.

The demo account menu lets the platform select explicitly assigned scoped administration people for UAT. This is visibly demo identity selection, using the same existing login/session format. It is not a new authentication system. Selecting a demo subject changes the current session subject; supplying a different actor ID to a command does not.

## 10. Persistence, failure handling and recovery

Existing keys remain in use. New metadata does not convert existing role arrays or reset collections. UUIDs identify new clients/persons/memberships/assignments/events/factories/Zones. Existing IDs and deleted-record reservations are untouched.

A synchronous transaction journals original raw directory/configuration/metadata payloads under `ops-access-v3-pending-transaction-v1` before writing. Subscribers are notified only after all writes succeed. The event is in the same metadata commit as the authority change.

On storage failure, original payloads are restored, the new change is rejected and no successful administration event becomes visible. If rollback itself cannot finish, the original journal remains. Canonical directory/configuration/administration reads use original journal payloads until recovery, so partially written authority/event data is quarantined. New administration mutations and legacy user maintenance are blocked while recovery is pending. Platform has an explicit **Recover interrupted administration change** action. A malformed payload/journal is preserved and requires a verified backup rather than silent clearing or seed reset.

This is a browser-local recovery mechanism, not a multi-user transaction protocol or tamper-resistant log. No database, API, authentication provider or backend integration was added.

## 11. Legacy compatibility and reference inventory

[Legacy role mapping inventory](../architecture/OPS-ACCESS-V3-LEGACY-ROLE-MAPPING-INVENTORY.md) includes stable seeded identities, exact role and permission profiles, plant/Zone IDs, source-reference counts and representative field paths, proposed mappings and unresolved approval. It contains no names, emails, signatures or evidence.

The inventory is repository-seeded evidence, not an export of the user's real browser data. Custom persisted legacy identities must be inventoried in their authorized browser context before later mapping. No mapping is applied here.

Existing Action owner/reviewer IDs, histories, evidence, dates, Action Type and source references are not rewritten. Audit signatures/checklist/scoring snapshots, CI approvals/implementation history, Red Tag dispositions/receiving-leader evaluation, Gemba source relationships, VI/VM history and deletion tombstones are preserved. Scoped membership changes do not project new privileges into these workflows in Phase 1.

## 12. Administration audit events

Events record actual actor, target identity/entity, organization/factory scope, operation, timestamp and before/after summary. New profiles also produce `person.created` within the same transaction. Successful operations include client create/update, Client Admin assignment, factory create/update, FA assignment/revocation, factory membership/user changes and Zone create/update.

Permission denials, validation failures, cancellation and failed writes do not record successful events. Existing legacy profile/settings support paths retain their existing history behavior; this phase does not claim a complete log migration for those older commands. Operational CI/Action histories remain canonical and unchanged.

## 13. Changed files

| Area | Phase 1 files |
| --- | --- |
| Models and metadata | `features/five-s/administration/access-v3-types.ts`, `access-v3-state.ts`, existing `types.ts` |
| Commands and recovery | `features/five-s/administration/access-v3-store.ts`, existing `store.ts` and the scoped-profile rejection in `ownership.ts`, `lib/administration-storage.ts` |
| Administration UI | `features/five-s/administration/access-v3-page.tsx`, existing `users-page.tsx`, `app/(app)/settings/administration/page.tsx` |
| Existing organization architecture | `lib/organizations.ts`, `lib/organization-store.ts`, `lib/module-entitlements.ts`, `features/super-admin/super-admin.tsx` |
| Existing settings clients | `features/settings/module-access-page.tsx`, `audit-question-organization.tsx`, `audit-configuration-permissions.ts` |
| Identity/navigation | `lib/current-user.ts`, `lib/demo-session.ts`, `components/navigation/user-menu.tsx`, `sidebar-nav.tsx`, `app/(app)/settings/page.tsx` |
| New-profile UI boundary | `components/ops/administration-subject-boundary.tsx`, additive wrapper in `app/(app)/layout.tsx` |
| New tests | `tests/access-v3-phase1.test.ts`, `e2e/access-v3-phase1.spec.ts`, `tests/helpers/legacy-directory.ts` |
| Existing test fixture setup | `tests/administration.characterization.test.ts`, `batch-b21-module-permissions.test.ts`, `batch-b2-final-hardening.test.ts`, `batch-b2-governance.test.ts` |
| Documentation | This QA report and the legacy-role inventory |

No dependency, lockfile, API route, operational workflow/store, Action Type implementation, source lifecycle or deletion policy was changed by Phase 1. Existing local changes in those areas are preserved rather than attributed to this task.

## 14. Automated and browser validation

### Test fixture compatibility changes

The retired legacy creation command was previously used to prepare synthetic pre-existing Auditor/Admin/Member identities in four test files. A test-only helper now seeds those persisted legacy fixtures directly and refreshes the canonical directory. Existing inactive-user, Action priority, deletion rejection, customized permissions, reload and ownership assertions remain. The old creation expectation was replaced with explicit denial of new legacy creation while retaining the profile-maintenance assertions. New v3 tests verify successful scoped creation and every elevated-role rejection. No failed scope/lifecycle assertion was removed.

### Executed checks

Final results on 21 October 2026:

| Check | Result |
| --- | --- |
| Pre-change `npx vitest run` | 131 files / 1,285 tests passed |
| Final `npx tsc --noEmit` | Passed |
| Final `npm run lint` | 0 errors, 10 existing warnings (eight image-element warnings and two unused legacy test variables) |
| Final `npx vitest run` | **132 files / 1,311 tests passed**, including 26 focused Phase 1 cases |
| Final `npm run build -- --webpack` | Passed in isolated production-build copy |
| `git diff --check` | Passed |
| Full selected Chromium run | **93 passed**, no failed scenarios remaining |
| Final administration-only rerun | **3 passed** after the last scope/audit safeguards, with explicit console/hydration checks |

The 93 distinct Chromium scenarios consist of Phase 1 administration (3), Action Type/execution (20), listing deletion (21), source/Action deletion (8), cross-module integration (15), All-tab navigation (9), P0 critical/authorization/responsiveness (15), and Red Tag cross-Zone authorization (2). The final three-case rerun repeats the administration journeys and does not inflate the distinct scenario count.

The selected command was `npx playwright test` with `e2e/access-v3-phase1.spec.ts`, `e2e/p0-critical.spec.ts`, `e2e/cross-module-integration.spec.ts`, `e2e/red-tag-cross-zone.spec.ts`, `e2e/action-plan-execution-types.spec.ts`, `e2e/admin-record-deletion.spec.ts`, `e2e/admin-listing-deletion.spec.ts` and `e2e/ops-listing-defaults.spec.ts`, using the installed Chrome for Testing executable. The final rerun targeted `e2e/access-v3-phase1.spec.ts`.

Initial failures were investigated and corrected: demo role switching unnecessarily removed an absent key in minimal test storage; a select indicator contributed a checkmark to text assertions, so the new test now checks exactly three options and their accessible names; the new-profile privacy filter required an explicit current-person lookup in the operational route boundary; and screenshot review found selectors displaying IDs, which now display names and have a viewport-width assertion. Legacy fixture setup changes are explained above. No failing authorization/lifecycle assertion was discarded.

Mobile and desktop screenshots were inspected from the isolated Playwright artifacts. The final administration journeys recorded no page errors, console errors, hydration/Base UI/invalid-nesting diagnostics, or document-width overflow. Existing Node `NO_COLOR`/`FORCE_COLOR` development-tool warnings are environmental and do not represent application console failures.

Browser and build verification use isolated copies without environment files: `/private/tmp/ops-deletion-qa` and `/private/tmp/ops-phase1-build-qa`. They reuse the installed dependencies and Chrome for Testing. Webpack is used for isolated Next dev/build because the dependency installation is an external symlink. Repository package/configuration and existing development servers are preserved.

New unit coverage includes platform/client/factory authorities, exact role allow-list, injected permission fields, active membership, unknown/ambiguous/wrong scope, impersonation, independent factory/Zone memberships, same-name Zones, stable identities, unchanged owners/reviewers, deactivation guards, assignment history, last-admin revocation, entitlement ownership, reload, original storage preservation, transaction recovery and hidden uncommitted events.

New Chromium journeys cover mobile/desktop client creation and Client Admin appointment, explicit factory/FA bootstrap, exact role selector, Cancel, multiple factories with one person, different factory base roles, Zone allocation, failed and successful revocation, a pure FA creating a person, hidden Client Admin powers for that FA, refreshed All tab, operational route separation, directory compatibility and responsive screenshots.

Regression suites include P0 authorization/route geometry, cross-module creation/Linked Records, Red Tag cross-Zone authorization, Action Type/execution, source/Action deletion, listing deletion and All-tab navigation/deep links.

## 15. Remaining limitations and affected-path stops

- Browser-local identity/persistence remains editable by the browser owner. No production tenant security or multi-device synchronization is claimed.
- Legacy role mappings remain unapproved. No bulk conversion or auditor grant was created. Custom browser-local identities need an authorized local inventory before any future mapping.
- Cross-client person linking/merging without an existing authorized client membership is refused for review. No duplicate identity or guessed mapping is created to bypass this stop.
- Last active FA revocation is blocked until a replacement is explicitly assigned. Membership deactivation is blocked for outstanding Action/CI ownership or active FA authority; no transfer is fabricated.
- Newly recorded factory roles/Zone allocations do not yet confer new operational module permissions. New profiles are administration-only during Phase 1. Existing operational personas remain functional under their legacy permissions.
- Factory names/locked codes and Zone names/codes are protected to preserve legacy references. Location/description and Zone department are supported edits.
- Tenant status effects, suspension and deletion are not invented. Client profile status remains unchanged.
- Existing exceptional platform support operations and legacy existing-profile role maintenance are retained; no blanket new factory operational override is introduced.
- Full module-specific settings migration, server enforcement and immutable logs remain separate work. Existing historical report snapshot limitations remain unchanged.

## 16. Exact manual UAT steps

Use a separate browser/demo storage context for UAT. No real production account or backend has been provisioned.

1. Sign into the existing demo. Open **Account menu → OPS Super Admin**, then **Organizations → Create client**. Enter a synthetic client name and industry. Save, reload and confirm the same client ID/detail link. Edit name/industry and verify IDs/status/other clients' entitlements stay intact.
2. Open that client's detail and choose **Assign Client Admin → New administration profile**. Enter a synthetic full name/email/employee ID and confirm. This is a distinct person/authority operation, not part of client creation.
3. As platform, use Account menu to select the newly assigned scoped administration person. Open **Settings → Client & Factory Administration** or sidebar **Administration**. Verify All is selected, the correct client appears, and Add User is absent before a separate FA assignment.
4. Create **Factory First** and **Factory Second**, each with a distinct code. Verify canonical Plant IDs and client ownership. Try another client's canonical ID in a controlled command test and verify no data/event change.
5. As Client Admin, choose **Assign Factory Admin** for Factory First and explicitly assign the Client Admin person for bootstrap. Confirm the assignment. This deliberate dual assignment must be necessary for Add User to appear; Plant Manager metadata alone must not grant it.
6. Create two Zones in Factory First. Use **Add User** and verify Base role has exactly Zone Leader, Zone Member and Standard User. Enter a synthetic person, choose Zone Member and both Zone allocations, then Cancel. Verify no new profile/membership/event. Repeat and Save.
7. Assign the same bootstrap person FA in Factory Second. Create a Zone with the same display name as one in Factory First. Use **Add User → Existing client person**, select the person from step 6 and choose Standard User. Save. Verify one stable user ID, two independent factory roles and distinct Zone IDs. Edit one membership and confirm the other remains unchanged.
8. Inspect **History**. Verify actual actor, target, scope and times, including person creation and assignments. Select Users/History, refresh, and verify All is active again.
9. Attempt to revoke the only FA in a factory. Confirm the dialog and verify a clear replacement-required error with no change/event. Assign the step-6 person as another FA, then revoke the bootstrap FA assignment. Verify original/revoked history is retained and the person is still active with unchanged memberships/ownership.
10. Switch through Account menu back to OPS Super Admin, then select the newly assigned pure Factory Admin person. Verify only assigned factories are administrable, Create factory/Assign Factory Admin are absent, and Add User works within their factory. Verify no module subscription toggle is available.
11. In a controlled negative test, attempt elevated base roles, extra `permissions`/`roles`, a forged actor ID, unknown/name-only scope, foreign factory/Zone and inactive subject. Verify no profile, membership, assignment or successful event is written.
12. Navigate a newly created scoped profile to `/actions` or `/audits`. Verify the administration-profile notice. Switch back to the existing legacy operational personas and verify their current Actions/Audit/CI/Gemba/Red Tag/VM workflows, evidence and source history remain readable and unchanged.
13. Open `/settings/users` as an unassigned legacy Admin. Verify existing-profile maintenance remains but Add User is absent, and `/settings/administration` requires an explicit assignment.
14. Check existing source/Action deletion under its unchanged Admin-only policy. Source deletion must retain Actions; missing/deleted required Actions must not complete a source. Verify existing All-tab sidebar/refresh/Back/Forward behavior.
15. In a disposable test context, simulate storage failure. Verify original records and no success event. If a journal remains, preserve it and use the platform **Recover interrupted administration change** action. Do not clear collections to recover.

- [ ] Desktop UAT approved.
- [ ] Mobile UAT approved.
- [ ] Existing legacy operational workflows approved.
- [ ] Existing client/factory data and histories preserved.
- [ ] Remaining Phase 2 decisions reviewed separately.

## 17. Phase 2 dependencies and stop condition

D03 (operational Delete), D04 (auditor grants/revocation), D05 (CI approval delegation), D06 (additional Red Tag Zone policy), D07 (Audit own-Zone/scheduling), D08 (Gemba contribution) and D10 (Action owner/reviewer cross-factory eligibility) remain unresolved. Phase 1 does not answer them.

Before any later policy projection/migration, approve individual legacy mappings using the inventory and actual authorized browser data, resolve the relevant decisions, preserve ownership/reviewer history, and test direct commands as well as UI. Production backend authentication/authorization/isolation requires a separately approved program.

Implementation stops here for manual UAT approval. No commit, push, merge or deployment was performed.
