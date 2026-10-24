# OPS — IQ Client Onboarding Preflight

Date: 21 October 2026. Status: inspection complete; onboarding not approved or implemented.

IQ can be created as an independent client using the existing client-creation command after its industry and final configuration are approved. The complete requested hierarchy cannot currently be established through the implemented commands: existing ABC people cannot be attached to a new client through a reviewed public operation. Full operational isolation across all modules is also incomplete. Neither limitation should be bypassed by changing raw storage, duplicating people, or granting temporary administrative roles.

Only this report was created for this preflight. Application code, canonical records, browser storage, subscriptions and historical relationships were not changed. Existing local work was preserved.

## Evidence and runtime boundary

The findings below describe repository seeds and current implementation, including existing uncommitted implementation. They do not establish the contents of the active browser. Browser-local persisted directories/configuration may replace seed arrays, and v3 memberships may already exist there. The active browser was not inspected, storage was not reset, and no sample records or mutation tests were executed.

Principal sources:

- Client catalog: [`lib/organizations.ts`](../../lib/organizations.ts).
- Factory/Zone configuration: [`lib/organization-store.ts`](../../lib/organization-store.ts).
- Person directory and legacy memberships: [`store.ts`](../../features/five-s/administration/store.ts), [`types.ts`](../../features/five-s/administration/types.ts), [`permissions.ts`](../../features/five-s/administration/permissions.ts).
- V3 relationships, state and commands: [`access-v3-types.ts`](../../features/five-s/administration/access-v3-types.ts), [`access-v3-state.ts`](../../features/five-s/administration/access-v3-state.ts), [`access-v3-store.ts`](../../features/five-s/administration/access-v3-store.ts).
- Implemented administration forms: [`access-v3-page.tsx`](../../features/five-s/administration/access-v3-page.tsx); platform client UI: [`super-admin.tsx`](../../features/super-admin/super-admin.tsx).
- Actual-subject authorization: [`factory-authorization.ts`](../../features/five-s/administration/factory-authorization.ts), [`audit-authorization.ts`](../../lib/five-s/audit-authorization.ts), [`demo-session.ts`](../../lib/demo-session.ts).
- Entitlements: [`module-entitlements.ts`](../../lib/module-entitlements.ts), [`modules.ts`](../../lib/modules.ts).
- Identity switching: [`current-user.ts`](../../lib/current-user.ts), [`user-menu.tsx`](../../components/navigation/user-menu.tsx).

## A. Existing canonical inventory

### Clients, factories and Zones

| Entity | Repository record | Ownership and constraints |
| --- | --- | --- |
| Existing client | `abc-manufacturing` — ABC Manufacturing, Manufacturing, Active | Must remain unchanged. Catalog metadata says 3 plants/42 users; these are not an inventory of configured factories. |
| Existing client | `xyz-components` — XYZ Components, Manufacturing, Active | Separate existing client; metadata says 2 plants/18 users. No corresponding factory seeds were found. Preserve it. |
| Requested client | IQ | No IQ client seed. Runtime duplicate checks are required before any future creation. |
| Configured factory | `PLANT-EGM` — Egmore Plant; code `EGM`; location Chennai; Active | Only configured factory seed. Its omitted legacy `organizationId` resolves to `abc-manufacturing` through `plantOrganization()`. This compatibility relationship must not be transferred to IQ. |
| Factory manager metadata | `USR-RUMESH`, display name “Rumesh Ravi” | Catalog metadata is not a v3 Factory Admin assignment and is not evidence of another person identity. |
| Zone A | `ZONE-A`, code `ZA`, Production, Active | Egmore; leader `USR-LAKSHMAN`. |
| Zone B | `ZONE-B`, code `ZB`, Production, Active | Egmore; leader `USR-RUMESH`; member `USR-SIVA-KUMAR`. |
| Zone C | `ZONE-C`, code `ZC`, Production, Active | Egmore; leader `USR-MANOJ-GURU`. Preserve unrelated leadership. |
| Zone D | `ZONE-D`, code `ZD`, Production, Active | Egmore; leader `USR-ANAND`. Preserve this leadership. |

The v3 default state contains no clients, client memberships, factory memberships, Zone allocations, Factory Admin assignments, Auditor grants or administration events. Clients in the static catalog and legacy relationships remain available through compatibility paths; no automatic v3 migration or Factory Admin assignment is implied.

### Requested people

The following are seed values, not verified runtime contacts or approved IQ profile data.

| Requested identity | Canonical record / status | Current role and organizational relationship | Existing email / Employee ID |
| --- | --- | --- | --- |
| Metric Mind | No person with this name. Platform candidate is `USR-OPS-SUPER-ADMIN`, “OPS Super Admin”, Active | Fixed platform identity; legacy Admin, “All organizations”; no seeded Zone allocations or v3 factory authority | `super.admin@ops.example` / `EMP-OPS-SUPER-ADMIN` |
| IQ Client Admin | No matching person seed | Needs a separately approved person profile and explicit IQ Client Admin membership | Missing |
| Lakshman | `USR-LAKSHMAN`, Active | Legacy Admin, Auditor, Zone Leader; ABC/Egmore; Zone A Leader. No seeded v3 FA assignment | `lakshman@egmore.example` / `EMP-LAKSHMAN` |
| Rumesh | `USR-RUMESH`, Active | Legacy Zone Leader; ABC/Egmore; Zone B Leader | `rumesh@egmore.example` / `EMP-RUMESH` |
| Suresh | No canonical person seed verified | Historical display names are insufficient to establish a person or membership | Missing for any proposed new profile |
| Siva Kumar | `USR-SIVA-KUMAR`, Active | Legacy Zone Member; ABC/Egmore; Zone B Member | `siva.kumar@egmore.example` / `EMP-SIVA-KUMAR` |
| Anand | `USR-ANAND`, Active | Legacy Zone Leader; ABC/Egmore; Zone D Leader | `anand@egmore.example` / `EMP-ANAND` |

`USR-SURIYA` is an existing Zone D member, not evidence that Suresh exists. Do not substitute this identity. Seed email domains are demo values; verify canonical runtime values before relying on them. Existing people do not need replacement emails or Employee IDs merely to retain their identities.

### Historical dependencies

- Audit fixtures in `features/five-s/data/five-s-data.ts` refer to Lakshman and Rumesh and contain Suresh display names on historical Zone D Audits. These names do not authorize attaching those records to a newly created Suresh identity.
- Canonical Action fixtures in `features/five-s/data/my-actions-data.ts` include `ACT-ZB-001` with creator `USR-LAKSHMAN` and Zone Leader `USR-RUMESH`; `ACT-CI-013-01` links Siva Kumar and Rumesh; `ACT-RF-008` references Zone D leader `USR-ANAND`. Preserve responsible-person IDs, source links, evidence authors, reviewer names and history.
- Visual Management seeds/configuration reference these people as board owners and members, including Anand on Zone B/D boards, Lakshman on Zone A and Rumesh on other boards. Do not clone or reassign these records to IQ.
- Legacy person mutation/deactivation paths have leadership and outstanding Action/CI checks. New IQ membership must not rewrite the legacy roles, permissions, plant or Zone memberships that existing records depend on.
- The older role-mapping inventory is a historical Phase 1 document, not a current runtime census. Phase 2 grant functionality now exists; historical counts and earlier capability statements must not be treated as current browser evidence.

## B. Required field matrix

The authoritative validation is in `access-v3-store.ts`; forms mirror these commands. “Required” below distinguishes a required payload property from a nonempty business value.

### Client and factory

| Object / field | Exact current rule | Source / decision |
| --- | --- | --- |
| Client `name` | Trimmed, nonempty; case-insensitive duplicate client name rejected | User proposed IQ; final approval required |
| Client `industry` | Trimmed, nonempty | User must supply |
| Client `id` | Generated `ORG-<crypto.randomUUID()>`; optional input `id` edits a known client only | System; do not choose or reuse ABC ID |
| Client `status`, `plants`, `users`, `lastUpdated` | New record Active, counts 0, timestamp generated; these are not accepted creation inputs | System |
| Client Admin | Separate `assignClientAdministrator()`; exactly one `userId` or new `person` | User approves person; actor must be actual platform SA |
| Client Admin membership | `id`, person/client IDs, Active status, `clientAdmin: true`, actual assignment actor/time, update time | Generated/derived; no automatic factory authority |
| Subscription/module map | Not required by `saveClientProfile`; no explicit subscription snapshot automatically created | User must approve IQ capability map before operational activation |
| Factory `organizationId` | Canonical active parent client; caller must be its actual Client Admin | Derived from newly created IQ record |
| Factory `name`, `code` | Both trimmed nonempty; either duplicate name or code within client rejected; code uppercase | User must supply |
| Factory `location` | Required string payload, trimmed; empty string is accepted by current command | User supplies value or explicitly accepts blank; no mandatory street/address fields exist |
| Factory `description` | Optional trimmed string | Optional user input |
| Factory `id` | Generated `PLANT-<UUID>`; optional existing ID is edit, not arbitrary allocation | System |
| Factory `status`, `managerId`, `managerName`, `codeLocked` | New Active; manager fields empty; code locked | System; manager metadata is not FA authority |
| Factory Admin | Separate explicit assignment of eligible active same-client person by actual Client Admin | User approves Lakshman identity and reviewed IQ membership first |
| Factory Admin relationship | Generated `FA-<UUID>`, person/client/factory IDs, Active, actual actor/time; revocation metadata on revoke | System/derived |

Factory creation does not create a person, FA, operational membership, Zone or grant. Existing factory name is retained for historical references; locked codes are retained. No supported client transfer, factory ownership transfer, client deactivation or general factory lifecycle command should be inferred from the types. The last eligible active FA cannot be revoked without a replacement.

### Zone and person

| Object / field | Exact current rule | Source / decision |
| --- | --- | --- |
| Zone `name`, `code`, `department` | All trimmed nonempty; name/code case-insensitive unique within factory; uppercase code | User must supply each IQ Zone |
| Zone `plantId` | Active canonical factory; actual FA authority required | Derived from new IQ factory |
| Zone `id`, `status`, legacy leader fields | `ZONE-<UUID>`, Active, empty `leaderId`/`leaderName` on creation | System; leadership assigned separately through v3 allocations |
| Person `name` | Trimmed nonempty | User for new IQ administrator and any genuinely missing Suresh profile |
| Person `email` | Trimmed, contains `@`; globally case-insensitive unique | User; this is not a full email-format or ownership verification |
| Person `employeeId` | Trimmed nonempty; globally case-insensitive unique | User |
| Person `id` | `USR-<UUID>` | System; retain canonical IDs for approved existing people |
| New person defaults | `accessModel: v3`, Active, generated update time, empty legacy plant/roles/permissions/Zone memberships | System; do not populate legacy roles to simulate privileges |
| Other profile fields | Phone, address, job title and similar fields are not required by `PersonInput` | No invented requirements |
| Client membership | Generated `CM-<UUID>`, user/client IDs, Active, ordinary `clientAdmin: false` unless explicitly assigning CA, actor/time/update metadata | Command-derived; no public general cross-client attachment command exists |
| Factory membership `baseRole` | Exactly Zone Leader, Zone Member or Standard User | User approves role in IQ factory |
| Factory membership `zoneIds` | Required array; empty allowed by API; supplied IDs must identify active canonical Zones in selected factory | User approves actual allocations; requested Zone roles need meaningful approved allocations |
| Factory membership `status` | Optional Active/Inactive, defaults Active | System default; approved changes only |
| Factory membership metadata | `FM-<UUID>` or preserved existing membership ID, canonical user/client/factory IDs, actual assignment/update timestamps | System/derived |
| Zone allocation | `ZA-<UUID>` or existing allocation, user/client/factory/Zone IDs, status, actor/time; Leader for ZL base role, Member otherwise | Derived from approved role and selected Zones |
| Auditor grant | Separate explicit FA operation for eligible active ZL with valid leadership allocation and permitted target Zones; grant/revoke actor/time metadata; no expiry field | Not requested for IQ operational users; create no grants |

Zone creation alone requires no leader. Existing Zone names/codes are retained; department can be edited. `saveFactoryUser()` changes allocations in the selected factory and does not rewrite other factories or legacy person fields. An empty Zone array being technically accepted is not approval to omit Rumesh's requested leadership allocation. Auditor is not a factory base role.

## C. Identity conflict matrix

| Identity | Safe option after approval | Conflict / blocker |
| --- | --- | --- |
| Metric Mind | Use existing fixed platform identity with an approved switcher/display alias; preserve canonical ID/history | No literal Metric Mind seed; creating a second platform SA is not an implemented onboarding operation |
| IQ administrator | Create a genuinely new, approved administration profile via `assignClientAdministrator()` | Need name, email, Employee ID; must confirm it represents a distinct person/identity rather than duplicate an existing person |
| Lakshman | Retain `USR-LAKSHMAN` and all ABC history; append a separately reviewed IQ CM, then explicit IQ FA assignment | Public commands currently reject attachment from ABC to new IQ. Legacy Admin/Auditor is not IQ FA authority |
| Rumesh | Retain `USR-RUMESH`; after reviewed CM, add IQ factory ZL membership and approved Leader allocations | Must preserve ABC Zone B leadership; IQ Zone IDs unknown; no active-client session context for shared identity |
| Siva Kumar | Retain `USR-SIVA-KUMAR`; after reviewed CM, add IQ ZM membership/allocations | Preserve ABC Zone B membership and assigned work; same cross-client command gap |
| Anand | Preserve `USR-ANAND` as ABC Zone D Leader; an independent IQ ZM membership is structurally representable after reviewed CM | Do not demote legacy role, remove Zone D leadership or transfer history. Shared identity still retains ABC authority; IQ-only context is not implemented |
| Suresh | First identify an existing canonical runtime person; otherwise create a genuinely new approved profile after FA bootstrap | No verified ID/email/Employee ID. Historical “Suresh”/“Suresh Kumar” strings do not establish identity or authorize history backfill |

The relationship schema can represent one person in multiple clients/factories and separate factory roles. This is not an end-to-end implemented existing-person onboarding workflow. `eligibleClientPerson()` requires an active CM in the target client, or legacy eligibility specifically in ABC. `assignClientAdministrator()`, `assignFactoryAdministrator()` and `saveFactoryUser()` enforce that prerequisite. Private `joinClient()` is not an external assignment operation and does not bypass the guard.

A reviewed, explicit, append-only existing-person/client-membership operation is needed before the requested reuse. Its authorization, consent/identity verification, scope and tests require separate approval. Do not use raw-state edits, duplicate profiles, or temporary CA/FA promotion as a bootstrap workaround.

## D. Capability gap analysis

| Capability | Classification | Implementation and practical limit |
| --- | --- | --- |
| Independent client creation | Supported and implemented | Actual platform SA → `saveClientProfile`; platform Organizations UI; new stable ID |
| Factory under client | Supported and implemented | Actual Client Admin → `saveFactory`; administration Factory dialog; no automatic FA |
| Zones in factory | Supported and implemented | Actual FA → `saveFactoryZone`; Zone dialog; explicit allocation follows |
| New Client Admin | Supported and implemented | SA → `assignClientAdministrator({person})`; new profile + CM; no implicit FA |
| Assign eligible Factory Admin | Supported and implemented | CA → `assignFactoryAdministrator`; existing eligible client person only |
| Requested Lakshman as first IQ FA | Blocked by current architecture | Lakshman lacks IQ CM; no reviewed public attach command. New-person factory creation also needs an FA already |
| Create/assign ZL or ZM | Partially implemented for this request | `saveFactoryUser` and forms work under actual FA for new or eligible same-client people; requested foreign-existing-person reuse blocked |
| One person across factories/clients | Partially implemented | Relationship types and same-client multi-factory operations exist. General cross-client existing-person attachment is not implemented; no active tenant/factory session selector |
| Independent module entitlements | Partially implemented | Per-client map + SA `saveOrganizationAccess` exist; factory UI is read-only. Normal shell and several operational integrations still use ABC defaults |
| Requested demo switching | Partially implemented | Four fixed personas; SA can additionally select active v3-associated people by ID. No complete seven-identity grouped scope presentation or explicit IQ context switch |
| Production tenant isolation | Not implemented | Browser-local demo identity/state and frontend guards are not server authorization or multi-user isolation |

### Authority and second-client isolation

- **No implicit v3 factory authority:** the fixed SA is excluded from v3 factory operational resolution. Client Admin alone is not FA. Lakshman needs a distinct explicit FA assignment. Actual actor resolution and canonical active scope checks are enforced, not caller-supplied role labels.
- **Zone role and grant separation:** Rumesh needs active IQ CM/FM, ZL base role and valid Leader allocation. Zone Members receive no Auditor grant through base-role selection. Granted ZLs cannot execute Audits in their own Zones; checks use scoped canonical allocations/leadership, not display-name matches. No IQ Auditor grant is proposed.
- **Scoped Audit:** `factory-authorization.ts`, `audit-authorization.ts`, Audit lifecycle and evidence paths check canonical client/factory membership, explicit assignment/grant and target entitlement. Scoped foreign-client access is denied through these implemented paths. Administration uses scoped directory visibility and recovery-journal-aware commands.
- **Compatibility exception:** scope-less legacy Audits retain older Admin/All-organizations behavior in `audit-store.ts`. Therefore the repository does not support a blanket claim that platform SA has no operational authority on every legacy record.
- **Actions and other modules:** `lib/actions/action-creation-access.ts` uses ABC scope and rejects foreign organizations. `lib/relationships/use-canonical-linked-records.ts` defaults to ABC. The administration subject boundary blocks v3-only people from unsupported operational modules. Full second-client Actions, CI, Gemba, VM, VI and Reports integration/isolation cannot be certified. Do not expand Phase 2 privileges to compensate.
- **Audit completion dependency:** noncompliant scoped Audits still require valid corrective Action linkage. The deferred cross-client Action integration blocks claiming a complete IQ Audit-to-Action workflow; retain completion requirements.
- **Shared identity:** adding an IQ relationship would not erase a person's legitimate ABC access. There is no active-client session context selecting “acting only in IQ.” Legacy global roles/plant and module assumptions require a reviewed policy before claiming context-isolated access for these shared people.
- **Entitlement independence:** IQ would use its own organization key, not inherit ABC's saved custom map. However an absent saved map falls back to registry defaults, including enabled capabilities. Client creation does not provision an approved IQ subscription. `useModuleEntitlements()` retains ABC default behavior outside supported scoped Audit handling; explicit IQ flags and runtime verification are required before activation.
- **History:** retain all existing person IDs, legacy memberships, leadership, Action/Audit assignments, evidence, signatures and source references. V3 commands journal administration mutations and preserve unrelated persisted fields; this is not an immutable server audit trail.
- **Security limit:** demo selection and localStorage are browser-controlled. No backend tenant authorization, secured evidence service or cross-device persistence is established. Neither IQ/ABC mutual isolation across all modules nor real production onboarding is verified by these client-side controls.

### Demo switching specifics

`lib/current-user.ts` retains fixed personas for Lakshman, Rumesh, Siva Kumar and platform SA. `setAdministrationDemoIdentity(userId)` supports an active non-platform person by canonical ID; it does not grant access. The menu's additional scoped people are visible to SA and derive from explicit v3 associations. IQ and Suresh are absent; Anand is not a fixed persona. The requested hierarchy presentation, clearly scoped labels and unavailable-person handling need focused UI work after approval. Persisted demo identity is distinct from an active-client/factory context.

## E. Proposed onboarding sequence

All steps below are future work, gated on approval. No command has been executed for IQ.

| Step | Prerequisites and operation | Missing work / compatibility risk | Expected verification after approval |
| --- | --- | --- | --- |
| 0. Approve configuration and establish baseline | Inspect authorized active-browser directory, configuration, memberships, grants, entitlements and relevant histories without resetting state; compare to repository inventory | Browser may differ from seeds; resolve duplicate/missing/inactive records before writes. Separately approve and implement reviewed existing-person CM assignment and shared-identity scope policy | Preserve baseline ABC IDs, ownership, leadership and histories; prove denied unauthorized/foreign-client attachment and actual-actor checks |
| 1. Create IQ | Approve industry and name; actual SA uses `saveClientProfile` | Runtime duplicate check; generated independent ID; defaults are not a subscription approval | IQ new ID; ABC/XYZ client records untouched; no cloned factories/history |
| 2. Configure IQ CA | Approved distinct person name/email/Employee ID; actual SA uses `assignClientAdministrator({person})` | Existing-person option only works if already eligible; no duplicate identity workaround | New canonical person + IQ CA CM; no FA/FM/Zone/grant automatically added |
| 3. Create IQ factory | Approved name/code/location decision/optional description; actual IQ CA uses `saveFactory` | New factory only; no Egmore reuse or transfer | Explicit IQ parent; new PLANT ID; Active; no accidental authority or Zone creation |
| 4. Assign Lakshman FA | Approved reuse of `USR-LAKSHMAN`; reviewed CM attachment completed; actual IQ CA uses `assignFactoryAdministrator` | First-FA bootstrap is blocked until CM capability exists; do not temporarily promote IQ CA to work around it | Explicit IQ FA; ABC roles, Zone A and work unchanged; CA alone/SA cannot act as factory operator |
| 5. Configure IQ Zones | Approved names/codes/departments; actual Lakshman FA uses `saveFactoryZone` | No automatic cloning of ABC Zones/leaders; generated new IDs | Correct factory linkage/uniqueness; blank legacy leader metadata until explicit v3 allocations |
| 6. Configure Rumesh | Reviewed IQ CM; FA uses `saveFactoryUser` with ZL and approved Zone IDs | Preserve canonical person and ABC Zone B; no implicit Auditor grant | Correct IQ FM/Leader allocations; existing ABC references intact; no grant-based Audit execution |
| 7. Configure members | Approved Siva/Anand identity reuse and reviewed IQ CMs; resolve Suresh canonical identity or approved new profile; FA uses `saveFactoryUser` with ZM | Retain Anand's ABC Zone D leadership; never infer Suresh history links; no global role rewrites | Approved IQ Member allocations only; no Auditor authority; all ABC assignments/evidence unchanged |
| 8. Verify independent entitlements | User approves complete canonical IQ capability map; actual SA uses `saveOrganizationAccess` | Gate operational activation until this decision; unsupported module integration remains deferred, not implicitly authorized | IQ storage key independent of ABC; disabled scopes denied; changing IQ never changes ABC map; confirm scoped Audit handling |
| 9. Configure demo selection | Verified canonical people/memberships and approved labels | Focused menu work for requested hierarchy/unavailable states; no synthetic role grants or claim of tenant context switching | Each selected ID resolves actual authority; inactive/missing denied; legacy personas retained; switching never changes memberships |
| 10. Consolidated acceptance | All above approved changes complete; clearly bounded pilot scope | Full noncompliant Audit/Action and all-module isolation remain blocked until separately authorized integrations exist | Scoped authorization/unit tests, lint/typecheck and one consolidated browser acceptance; compare ABC baseline, history/evidence/signatures, own-Zone restrictions, denied cross-client reads/mutations and entitlement independence |

Existing test sources to extend/reuse after implementation approval: `tests/access-v3-phase1.test.ts`, `tests/access-v3-phase2.test.ts`, `e2e/access-v3-phase1.spec.ts`, `e2e/access-v3-phase2.spec.ts`. Existing same-client multi-factory tests do not prove cross-client existing-person onboarding. Browser fixtures that explicitly grant a CA a separate FA role do not establish that the requested Lakshman bootstrap works without that grant.

No permission or Phase 3 expansion is included in this plan by implication. A limited administration/scoped-Audit demonstration would require explicit acceptance of its limits; it is not full operational tenant readiness.

## F. Decisions required from user

1. Confirm IQ as a new independent client and supply its required **industry**.
2. Supply the new IQ **factory name and code**, location value or approval to leave it blank, and optional description. IDs will be generated; no existing factory is assumed to belong to IQ.
3. Supply each IQ **Zone name, code and department**, the Zones Rumesh will lead, and the Zone allocations for Suresh, Siva Kumar and Anand.
4. Identify the IQ Client Admin's actual person and approved **name, email and Employee ID**. Identify Suresh's existing canonical runtime ID, if present; otherwise confirm a genuinely new person and provide those three fields. Do not infer identities from historical names.
5. Confirm that requested Lakshman/Rumesh/Siva Kumar/Anand are the existing canonical people, retain all ABC memberships/history, and approve a separately scoped reviewed cross-client membership feature and policy for shared identity access. They are reuse candidates, not currently attachable through the existing public workflow.
6. Confirm **Anand remains ABC Zone D Leader** while receiving only the separately scoped proposed IQ ZM role. Any removal of ABC leadership requires a separate explicit decision and dependency review.
7. Approve IQ's explicit module entitlement map and intended demonstration scope. Decide whether to defer operational onboarding until Action integration and remaining tenant-scope gaps are resolved; no full IQ operational isolation can currently be promised.
8. Confirm whether “Metric Mind” should label the existing fixed platform SA in the demo switcher, preserving its canonical ID and historical identity. Approve the final assembled configuration and any separately specified capability work before execution.

## G. Stop conditions

- Stop after this report. No onboarding, application edits or record changes are authorized by this preflight.
- Do not create IQ/factory/Zones/people until final configuration and required fields are approved and runtime canonical inventory is checked.
- Do not attach existing ABC people to IQ through raw state edits, weaken eligibility guards, create duplicate identities, or temporarily grant unrelated administrative authority.
- Do not rename/transfer ABC or Egmore, clone historical business records, move legacy memberships, demote Anand, or rewrite ownership, grants, signatures, evidence or assignment history.
- Do not create implicit Auditor grants, inherit ABC's subscription, assume registry defaults are approved IQ entitlements, or expand Phase 2 authority into unsupported modules.
- Stop if duplicate IDs/names, inactive/missing identities, pending recovery journals or contradictory runtime memberships prevent a canonical unambiguous configuration. Use existing reviewed recovery procedures only under separate authorization; never clear/reset storage.
- Do not claim global mutual tenant isolation, full IQ Audit-to-Action completion or production security before the identified gaps are separately addressed and verified.
- Do not commit, push, merge or deploy.

### Preflight validation

Static inspection covered canonical types, seeds, validators, scoped persistence commands, administration forms, authorization helpers, entitlement defaults, identity switching, relevant business references and existing test sources. No runtime browser data or mutation-based tests were used. This documentation-only task does not change executable behavior; lint, TypeScript, build and browser mutation suites were not run. The report was checked for whitespace errors after creation.
