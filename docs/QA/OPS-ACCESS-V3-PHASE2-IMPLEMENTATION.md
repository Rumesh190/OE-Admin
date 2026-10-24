# OPS Access Architecture v3 — Phase 2 implementation

Date: 21 October 2026. Status: implementation and automated verification; final verification evidence recorded below. Manual UAT remains required. No commit, push, merge, deployment, legacy role migration or local data reset.

## 1. Executive summary

Phase 2 adds factory-aware authorization and scoped Auditor grants to the existing administration metadata and canonical 5S Audit store. Factory Admins can grant/edit/revoke authorization, schedule an eligible auditor, execute directly, and explicitly reassign unfinished scoped Audits. Zone Leaders execute only their assigned, authorized, non-own-Zone Audits. Grants do not confer permissions for other modules.

Existing person, Plant, Zone and Audit IDs remain intact. Legacy records keep their name-based compatibility paths. New scoped Audits carry canonical IDs, assignment history and retained signature history; reassignment preserves checklist responses, evidence authorship, signatures, links, scoring snapshots and lifecycle state.

**Affected path stopped under the brief's D10 condition:** linked Action creation/assignment for new v3 identities is not authorized by Phase 2. The existing Action service and permissions remain unchanged. Scoped execution explains the dependency and disables its Add Action control. A non-compliant/partially compliant finding still needs a linked Action before completion. No completion or evidence requirement was relaxed. Full-compliance Audit execution and completion work through the approved Audit policies.

These are frontend demo controls over browser-local stores, not production authentication, tenant isolation or secure file authorization.

## 2. Sources and approved decisions

All five required sources were available and inspected/reused:

- `/Users/rumesh-9634/Downloads/MetricMind_Operational_Excellence_Access_Architecture_v3.pptx`: nine slides; SHA-256 `9f0998ae7019c5cf7bc6086d16c1861f21052e1bf6260a34a94c170d9aecadcf`.
- `docs/architecture/OPS-ACCESS-ARCHITECTURE-V3-GAP-ANALYSIS.md`.
- `docs/architecture/OPS-ACCESS-ARCHITECTURE-V3-IMPLEMENTATION-PLAN.md`.
- `docs/QA/OPS-ACCESS-V3-PHASE1-IMPLEMENTATION.md`.
- `docs/architecture/OPS-ACCESS-V3-LEGACY-ROLE-MAPPING-INVENTORY.md`.

The Phase 2 request approves D04 and D07, including own-Zone Option A. It supersedes Phase 1's administration-only route boundary for the approved Audit paths. D03/D05/D06/D08/D10 remain deferred; administrative assignment alone adds no unrelated operational capability.

## 3. Factory/Zone authorization architecture

`factory-authorization.ts` resolves canonical relationships for a target `{ organizationId, plantId, zoneId? }`. `resolveCurrentFactoryActor` resolves the authenticated browser demo actor itself; expected IDs are equality checks, never impersonation inputs.

Validation includes a unique active person, unique active client, canonical active factory belonging to that client, canonical active Zone belonging to the factory when supplied, and exactly one active client membership. Separate results identify Client Admin, Factory Admin, factory base role, current allocations, grant and effective authorization. Super Admin is not treated as a factory operator.

An Auditor requires exactly one active factory membership with base role Zone Leader and an active valid leadership allocation in that factory. Leadership is evaluated by Zone ID and factory ID, not names or `primaryZone`. All current led Zones are excluded, even if explicitly listed in a grant. Existing canonical Zone `leaderId` references also remain exclusion constraints; they never create a membership or grant. A leadership Zone in Factory 1 does not exclude a same-named Zone in Factory 2.

Factory Admin requires an explicit active assignment and active client membership/person/client/factory. It does not require a factory operational base role, Zone leadership or Auditor grant.

`audit-authorization.ts` applies the resolver only to approved Audit paths. It also checks the target client's Audit subscription without changing any entitlement. Legacy records and identities keep their existing compatibility rules; a v3 identity cannot fall back to those rules when inactive or unauthorized.

## 4. Grant model and lifecycle

The existing `ops-access-v3-administration-v1` payload remains version 1. It gains `auditorGrants`; an absent collection on valid Phase 1 metadata reads as an empty array. Unknown root fields are preserved by compatible spread/clone writes. Invalid known collections fail visibly without reset.

A grant stores stable `id`, `userId`, `organizationId`, `plantId`, explicit `zoneIds`, Active/Revoked status, original `grantedBy`/`grantedAt`, latest `updatedBy`/`updatedAt`, and `revokedBy`/`revokedAt`. There is no expiry or Auditor base role.

There is one active grant lifecycle per person/factory. An identical duplicate request is rejected. Editing Zones explicitly updates that grant and records `auditor.scopeChanged` with before/after snapshots and actual actor/time. Multiple active grants or duplicate grant IDs fail closed. Revocation retains the old record; a later explicit grant creates a new ID and preserves the revoked lifecycle.

Effectiveness is recalculated for every protected operation. Person/client/factory inactivity, inactive client/factory membership, loss of the Zone Leader base role or valid leadership allocation, invalid/inactive grant Zones, ambiguous grants, or revocation invalidate execution immediately. History is retained. The grantor subsequently losing FA assignment does not erase a legitimately issued grant.

## 5. Administration UI

The existing Client & Factory Administration page gains **Auditor Authorization**. The existing client/factory selector and search provide scope. Only a current authorized Factory Admin gets the management section and commands; a Client Admin without FA gets an explicit access message.

The section shows person, authorized Zones, Active/Revoked status, ineffective eligibility where relevant, grantor/date, and read-only authorization history. Granting selects an eligible Zone Leader, one or more canonical factory Zones, reviews scope and confirms. Own Zones are annotated as excluded from execution.

Editing records an authorization change. Revocation shows identity, factory, Zones and identifiable unfinished assignments, and explains that future execution through the grant is blocked while saved work and lifecycle remain. Independent FA execution authority remains separate.

Unfinished scoped Audit rows expose explicit reassignment. The dialog shows the current auditor and target scope, permits only an eligible replacement, and requires a reason. Empty eligibility never creates a fake assignment.

Super Admin's existing demo identity menu now includes explicitly assigned factory members so new v3 Audit personas can be exercised. It remains a demo identity switch, not production login or authority delegation.

## 6. Scheduling and direct Factory Admin execution

The existing Audit creation screen uses the scoped factory workflow for v3 identities and people with an explicit FA assignment. Ordinary legacy personas retain the original workflow.

A Factory Admin chooses an assigned factory and canonical Zone. Scheduling offers only active Zone Leaders with effective target-Zone grants who do not lead that Zone. No eligible auditor produces an explicit empty state and disabled scheduling. The store independently validates scope, actual FA, subscription, eligibility and schedule/due date before allocating an Audit ID.

The alternative **Execute directly as Factory Admin** creates an In Progress Audit assigned to that actual actor. No fabricated leadership membership or grant is created. An FA can also directly execute an existing unfinished scoped Audit in their assigned factory; the original assignment remains historical, while signatures identify the actual signer. Scheduling and direct execution do not extend to another factory in the same client without its own FA assignment.

Creation resolves canonical factory/Zone/person names and stores explicit `organizationId`, `plantId`, `zoneId`, `assignedAuditorId`, and an initial assignment-history entry. Caller labels are not authority. Existing schedule fields, Scheduled/In Progress states, checklist configuration, custom questions, organization-specific scoring snapshots and ID allocation are reused.

## 7. Execution and read boundaries

| Boundary | Scoped behavior |
| --- | --- |
| `createFiveSAudit` | Actual FA in canonical factory; valid subscription, scope, schedule and assigned auditor, or actual FA direct execution |
| `updateScheduledFiveSAuditSetup` | Actual FA; canonical target; existing Scheduled lifecycle/timing checks; recovery journal blocks writes |
| `startScheduledFiveSAudit` | Actual FA, or assigned eligible Auditor excluding own Zones; existing Scheduled lifecycle |
| `updateFiveSAudit` | Current effective execution authority; editable lifecycle; protects IDs, scope, assignment/history, captured policy and structural fields; completion delegates to the existing completion command |
| `saveFiveSAuditDraft` | Current execution authority and editable lifecycle; preserves checklist identity and linked Action references |
| `persistFiveSAuditEvidence` | Resolves the stored Audit and checks current authority before file persistence and again after asynchronous file preparation, before binary write |
| `persistAuditEvidence` | V3 callers must provide an Audit ID resolved from the canonical store; authority is checked internally, never through a caller-supplied callback |
| Signature update/clear | Same execution policy; changed signature must identify the actual actor; previous captured signature is retained in `signatureHistory` |
| `canCompleteFiveSAudit` / `completeFiveSAudit` | Current scope/grant/assignment/lifecycle; current actor's signature for scoped completion; unchanged answer, evidence, scoring and Action-link requirements |
| `linkAuditQuestionAction` | Adds execution check for scoped Audits; existing canonical Action/source authorization remains; no D10 permission expansion |
| `reassignFiveSAudit` / `reassignAuditAdministrator` | Actual scoped FA, unfinished canonical Audit, eligible replacement, explicit reason, transactional assignment/history event |
| `setFiveSAudits`, reset and clear demo helpers | Cannot replace/delete scoped collections or be used by v3 profiles to bypass commands |
| Evidence compaction | V3 execution does not migrate unrelated histories; legacy compaction excludes scoped Audits |

Generic updates cannot assign another auditor, replace scope IDs/history, fabricate lifecycle transitions, replace checklist IDs or inject Action links. The UI catches rejected autosaves/signature/draft updates and displays the error instead of claiming success. Failed Audit persistence restores the last committed in-memory collection as well as retaining stored data.

The actual canonical hook/getters filter scope. An FA reads their assigned factory's scoped Audits; an active factory member can read an Audit still explicitly assigned to them, including retained read-only work after grant loss/role change. An unassigned/foreign-client actor receives no scoped Audit content. Inactive identities/memberships do not inherit a legacy fallback.

Listings, details, report/export screens and linked-record consumers read these filtered canonical projections. Supported report routes remain functional; foreign reports show unavailable. Audit pages wait for browser identity hydration before displaying records, preventing the server's default legacy persona from painting seed content first. Other operational routes retain the administration subject boundary.

The Audit-only module gate recognizes explicitly scoped factory memberships/FA assignments and the actual client's existing Audit entitlement. The sidebar uses that same Audit-only policy, including when the demo client has a different subscription. Subscription data and other module gates remain unchanged.

## 8. Final authorization matrix

This matrix applies to **new scoped Audits**, not an automatic migration of legacy records.

| Actual actor/context | Manage Auditor grants | Schedule/edit timing | Start/answer/evidence/sign/complete | Reassign unfinished Audit | Read scoped Audit |
| --- | --- | --- | --- | --- | --- |
| FA, active explicit assignment in target factory | Yes | Yes | Yes, direct authority; same lifecycle and completion requirements | Yes, eligible replacement + reason | Assigned factory |
| Client Admin without target FA | No | No | No | No | No new blanket access |
| Super Admin | No | No new v3 override | No new v3 override | No | No new scoped Audit override |
| Active ZL, effective target grant, explicitly assigned, not own Zone | No | No | Yes within editable lifecycle | No | Their assigned Audit |
| Active ZL, own leadership Zone | No | No | No, even if grant lists it | No | Retained assigned read-only scope |
| Active assigned member after grant revocation/role change | No | No | No through revoked/ineligible authorization | No | Retained assigned read-only scope |
| ZM/Standard User without historical assignment | No | No | No | No | No new access |
| Unassigned ZL/foreign factory/client | No | No | No | No | No |
| Inactive person/client/factory or invalid scope | No | No | No | No | No |
| Legacy persona on legacy Audit | Existing rules only; no implicit grants | Existing compatibility | Existing compatibility | No automatic v3 remapping | Existing compatibility |

An independent active FA assignment can still authorize direct execution after the same person's Auditor grant is revoked. Grant authority is not a substitute for unrelated CI, Red Tag, Gemba, VM, VI, Action, deletion or settings decisions.

## 9. Revocation, membership changes and reassignment

Revocation changes only administration authorization metadata/history. It records actual actor/time/scope, affected unfinished Audit IDs/Zones/states and the explicit reassignment consequence. It does not modify Audit responses, evidence, signatures, assignment, status, reviewer history or linked Actions.

Factory membership updates retain their Phase 1 behavior and now include identifiable unfinished Audit consequences in the administration event. No automatic reassignment occurs. Eligibility checks use current allocations and membership each time, so role/allocation changes take effect without deleting grant history.

Explicit reassignment reads the canonical persisted collection itself, validates actual FA and replacement, and changes only current auditor name/ID plus append-only assignment history. Each entry retains previous auditor name/ID, new auditor name/ID, actual actor, time and reason. It retains all other Audit fields and original authorship.

Replacing/clearing a signature retains its previous capture in `signatureHistory`; UI signed-by text uses the stored signer, preventing attribution of a former auditor's signature to the replacement. A new executor must provide their own signature before scoped completion.

## 10. Transaction and recovery behavior

Grant/edit/revoke and membership events use the existing Phase 1 journal and command commit. Reassignment adds the canonical Audit storage key to that same transaction and recovery allow-list; there is no second journal or Audit database. Audit and administration-event payloads commit together before notifications.

If a write fails, original payloads are restored and no success event is exposed. If rollback also fails, the journal remains and readers use original pre-transaction payloads. The scoped execution policy blocks further mutations while recovery is pending, preventing recovery from discarding subsequent edits. The existing explicit platform Recovery action restores original Audit and metadata payloads. It never clears browser storage.

Unit tests cover both successful rollback after a one-time failure and interrupted rollback requiring platform recovery. Unknown metadata fields remain intact.

Browser-local synchronous journaling is not a database transaction or a multi-user lock. Production requires server transactions and authoritative session/membership enforcement.

## 11. Legacy compatibility and remaining command gaps

No legacy Auditor labels became grants. No person IDs, Audit IDs, permission arrays, primary Zones, historical references, signature captures or reviewer identities were migrated. Existing legacy Admin/Auditor completion rules remain for legacy Audits. Existing platform support exceptions in configuration, entitlements and legacy maintenance remain; v3 grants add no platform override.

Previously identified legacy creation/start/draft/generic-update command authorization gaps remain compatibility paths for legacy records and personas, pending reviewed legacy mapping. V3 actors cannot use them, and all scoped Audits require the new checks even when the current actor is a legacy identity. Legacy role labels are never promoted into factory authority.

Canonical Action creation/assignment and lifecycle remain unchanged, as do Action Type selection, review/rework/closure, independent Audit/Action closure, Red Tag cross-Zone handling, CI/Gemba integrations, deletion/tombstones, All-tab navigation, VM/VI and subscription mutations.

## 12. Exact Phase 2 files

Existing local modifications were preserved. The following files were created or further edited for Phase 2; other dirty files predate this phase.

| File | Change |
| --- | --- |
| `features/five-s/administration/access-v3-types.ts` | Typed grant collection/model |
| `features/five-s/administration/access-v3-state.ts` | Compatible default for absent grant collection |
| `features/five-s/administration/factory-authorization.ts` | New typed canonical factory/person/current-actor resolver |
| `features/five-s/administration/access-v3-store.ts` | Grant/edit/revoke, consequences, canonical reassignment and shared journal extension |
| `features/five-s/administration/access-v3-page.tsx` | Auditor management, grant/scope/revoke/reassignment dialogs and history |
| `lib/five-s/audit-authorization.ts` | New Audit read/execution/assignment policies |
| `lib/five-s/audit-store.ts` | Scoped command/read boundaries, assignment adapter, hydration subscriptions, recovery-aware storage, failed-write rollback |
| `lib/five-s/audit-evidence-storage.ts` | Canonical Audit authorization around asynchronous evidence persistence |
| `features/five-s/types/five-s.ts` | Optional canonical scope, assignment history and retained signature history |
| `features/five-s/audit-list-page.tsx` | Canonical creation context, fresh selected record by ID, scoped editable-load/direct-link gating |
| `features/five-s/components/FiveSAuditCreate.tsx` | Factory-aware schedule/assignee/direct-FA workflow |
| `features/five-s/components/FiveSAuditExecution.tsx` | Authorized evidence, rejected-save feedback, actual signer, D10 boundary |
| `features/five-s/components/FiveSAuditList.tsx` | Scoped scheduling visibility, demo-reset protection/feedback and settings visibility |
| `features/five-s/components/AuditorSignaturePad.tsx` | Retained signer attribution after reassignment |
| `components/ops/administration-subject-boundary.tsx` | Approved Audit routes and identity-hydration placeholder |
| `components/modules/module-gate.tsx` | Audit-only scoped client entitlement check |
| `components/navigation/sidebar-nav.tsx` | Audit-only navigation visibility follows the assigned client subscription, using the same policy as the route gate |
| `components/navigation/user-menu.tsx` | Explicit factory-member demo identities |
| `tests/access-v3-phase2.test.ts` | New direct-command authorization, history, scope, persistence and compatibility tests |
| `e2e/access-v3-phase2.spec.ts` | New mobile/desktop end-to-end grant → schedule → evidence → revoke → reassign → direct FA journeys |
| `docs/QA/OPS-ACCESS-V3-PHASE2-IMPLEMENTATION.md` | This report |

## 13. Automated validation

Fresh pre-change baseline: **132 Vitest files / 1,311 tests passed**. Phase 1 counts were not treated as Phase 2 acceptance.

Current Phase 2 results:

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with **0 errors / 10 existing warnings**, no new warnings. Eight pre-existing image warnings and two pre-existing unused-variable warnings.
- `npx vitest run`: **133 files / 1,345 tests passed**; **34 new Phase 2 cases**. Existing assertions were retained; no existing tests were weakened.
- `npm run build -- --webpack`: passed in an isolated copy; final source verified in the separate build directory.
- Targeted Chromium: **2 new journeys passed**, at 375px and 1440px, with zero captured application console errors, hydration/Base UI/invalid nesting errors and no administration-page horizontal overflow.
- Full relevant Chromium regression: **95 distinct scenarios passed** (9.5 minutes). **25 affected administration/Audit/Action scenarios passed again** (3.6 minutes). After the final Audit navigation consistency adjustment, **11 Audit/listing-default scenarios passed again** (1.9 minutes), including both responsive Phase 2 journeys. These reruns are not additional distinct scenarios.

Logs are under `/tmp/ops-phase2-{tsc,lint,unit,build,browser-final}.log`; targeted results are `/tmp/ops-phase2-browser-focused.log`. Final affected rerun logs are `/tmp/ops-phase2-browser-acceptance-final.log` and `/tmp/ops-phase2-browser-source-final.log`. Build and browser runs use separate `/private/tmp` copies and isolated storage/port 4179. The user's localhost:3000 development server and existing browser data were not reset.

New direct-command cases cover actual-client vs demo-client Audit subscription scope, non-ZL, inactive identity/membership, allocation/role/client/factory changes, foreign-client/factory, forged actor IDs, CA/SA without FA, duplicate/ambiguous grants, duplicate-name Zones, multiple own Zones, independent two-factory membership, scheduling eligibility, unauthorized Start/save/signature/evidence/completion, immutable scope/assignment/links, no reset bypass, current FA execution, retained signatures/evidence/history, invalid and failed reassignment, both transaction failure modes, unknown metadata, legacy IDs/permissions and filtered reads.

## 14. Browser acceptance evidence

Each new responsive journey:

1. Opens a Factory Admin context with independent factory assignments.
2. Grants Zone A/B to a Zone A Leader, and Zone B to a Zone C replacement.
3. Verifies scoped grant history and a second factory with no inherited grants.
4. Schedules Zone B to an eligible auditor through the canonical picker.
5. Switches to that auditor; scheduling is disabled and the assigned own-Zone Audit is execution-denied despite its listed Zone A grant.
6. Starts the assigned Zone B Audit, uploads an actual PNG through the UI, and waits for saved evidence.
7. Revokes authorization with that Audit still In Progress; the dialog identifies the impacted assignment.
8. Verifies the original auditor is blocked and retains saved work.
9. Explicitly reassigns to an eligible replacement with a reason, verifies unchanged sections/status and actual assignment-history identities, then previews the original binary as the replacement.
10. Executes directly as FA without a base role/grant.
11. Confirms an unauthorized factory member cannot obtain the report.

Responsive screenshots were inspected. Early targeted runs exposed incorrect test selectors (combobox role, non-heading CardTitle, and an evidence preview trigger); those were corrected against the actual accessible UI, without weakening authorization or retention checks.

The final regression set includes Phase 1 administration, P0 routes/authorization, Audit-origin Action creation, Action Type/start/review/rework behaviors, admin listing/detail deletion, Gemba/CI/source relationships, All-tab defaults and Red Tag cross-Zone restrictions. Results below distinguish executed tests from future manual UAT.

## 15. Remaining blockers and Phase 3 dependencies

- **D10:** new v3 linked Action creation/assignment remains stopped. A non-compliant Audit cannot bypass its required Action link. Decide canonical eligible owners/reviewers/factory scopes, then integrate the existing Action service; do not invent a parallel system.
- **D03/D05/D06/D08:** no new FA deletion mapping, CI delegation, Red Tag policy or Gemba contribution powers were added. Their current workflows remain.
- Legacy role mapping is still manual and individual. Existing roles, permissions, primary Zones and owned records must be reviewed before migration.
- Full operational module settings policy, CI/Red Tag/Gemba/VM/VI/Action v3 integration and backend authorization remain separate approved phases.
- Client/Factory lifecycle management is not introduced here. The resolver dynamically respects invalid/inactive canonical scopes without silently migrating their data.
- Low-level browser storage/file utilities are not security boundaries. Approved UI projections prevent foreign content from being rendered, but a browser owner can alter storage or inspect assets. Server-side authenticated reads/writes/exports/files, tenant queries, transactions and tamper-resistant audit logs are required for production.

No historical evidence/signatures had to be rewritten, no legacy Auditor had to be migrated, and no existing Audit/person ID had to be replaced. Assignment history is represented compatibly, so those stop conditions did not block the approved reassignment/direct-FA paths.

## 16. Exact manual UAT checklist

Use existing development data as-is. Do not clear browser data to pass these checks. Use the existing explicitly provisioned Phase 1 client/Factory Admin; create test records through authorized UI if required.

- [ ] As a Client Admin without FA, open Administration → Auditor Authorization. Management must be unavailable. Confirm no Audit scheduling/execution override.
- [ ] As Super Admin, verify platform controls remain, but no automatic target-factory Auditor grant/scheduling authority exists.
- [ ] As the target FA, create/reuse a Zone Leader with active membership leading Zone A; another leads Zone C. Add a Zone Member and Standard User for denial checks.
- [ ] Grant the first leader Zone A and Zone B. Check original grantor/date, explicit scope review, own-Zone annotation and history.
- [ ] Confirm the Zone Member, Standard User, inactive person and another client's person are absent from eligible grant choices. Cancel a grant; confirm no record/event is created.
- [ ] Edit the authorized scope; verify an explicit scope-change history event. Repeating an identical grant must show a duplicate error. No role/permission array should change.
- [ ] Grant the replacement leader Zone B. Open Audit → Start Audit as FA. Select the factory and Zone B, then the eligible first leader. Schedule with a valid future date/time and due date.
- [ ] Choose a Zone with no eligible auditor. Verify a clear empty state and disabled schedule confirmation. A Zone Leader should not be able to schedule through the Audit listing.
- [ ] As the assigned leader, open the Scheduled Audit by direct link and start it. Confirm existing checklist/scoring/navigation and evidence behavior.
- [ ] Save an answer/comment and upload a photo. Save Draft, reload, and preview the photo. Record its author, Audit ID, current status and linked Action references if present.
- [ ] As FA, revoke that grant while the Audit remains In Progress. Check the dialog lists the impacted assignment and explains saved work/lifecycle retention. Confirm no automatic reassignment or status change.
- [ ] As the old auditor, revisit the direct link. Execution must be unavailable; no answer/signature/evidence/completion write may succeed. Saved responses/evidence must remain.
- [ ] As FA, explicitly reassign to the eligible replacement with a meaningful reason. Confirm previous/new names and IDs, actual actor/time/reason and unchanged checklist, evidence author, signatures, status and linked Actions.
- [ ] As the replacement, continue in the same Audit and preview the original evidence. Historical signatures must keep their original signed-by identity. Provide a new current-actor signature before completion; old signature captures must remain retained.
- [ ] Give the first leader multiple leadership Zones; each must be execution-denied even when present in the grant. Another authorized non-led Zone should remain available when explicitly assigned.
- [ ] Reuse the same person in a second factory with a different base role. No grant or authority may inherit from Factory 1. Verify same-named Zones remain distinct by their factory/Zone IDs.
- [ ] As FA without any operational base role/grant, select **Execute directly as Factory Admin** and conduct an Audit in the assigned factory. A different factory without FA assignment must not be available/permitted.
- [ ] Change an active auditor's membership to inactive, base role to Zone Member, or remove its leadership allocations. Effective authority must stop; grants/history/unfinished assignments must remain for explicit reassignment.
- [ ] Open another client's Audit detail and report links as an unrelated actor. Expect unavailable, without checklist/evidence/source metadata. Refresh normal Audit routes and confirm no legacy-record flash/hydration error.
- [ ] Complete a valid fully compliant Audit using required answers and the actual executor's signature. Do not relax requirements for non-compliant findings; observe the explicit D10 Action dependency.
- [ ] Switch back to existing legacy Auditor/Leader personas. Verify their historical Audits, original signature attribution, canonical Actions and approved workflows still work, without new v3 grants appearing automatically.
- [ ] Verify Red Tag cross-Zone behavior, Action Type/review/rework, admin deletion with Action retention, Gemba/CI linkage, All-tab refresh/sidebar defaults and module entitlements.
- [ ] Repeat Auditor management and key dialogs at mobile and desktop widths; check readable labels, keyboard focus, no clipped controls/horizontal page overflow and no console/hydration/Base UI warnings.
- [ ] If a real interrupted administration transaction is encountered, preserve storage and use the explicit platform Recovery action. Confirm original Audit assignment/metadata return and no false success event remains. Do not simulate failure against valuable development data or clear storage.

Stop for manual UAT after this report; do not proceed to Phase 3 automatically.

## 17. Final verification and handoff

Final results: TypeScript passed; lint 0 errors / the same 10 pre-existing warnings; **133 Vitest files / 1,345 tests passed**; production webpack build passed; **95 distinct Chromium scenarios passed**, followed by the 25- and 11-scenario affected reruns described above. Final `git diff --check` passed. No existing test assertions were weakened.

The full Chromium command selected these suites: `access-v3-phase1.spec.ts`, `access-v3-phase2.spec.ts`, `action-plan-execution-types.spec.ts`, `admin-listing-deletion.spec.ts`, `admin-record-deletion.spec.ts`, `cross-module-integration.spec.ts`, `ops-listing-defaults.spec.ts`, `p0-critical.spec.ts`, and `red-tag-cross-zone.spec.ts`.

The final responsive screenshot check waits for page/transition settlement and disables screenshot animations; desktop heading and workspace positions are also asserted to clear the sidebar. The final mobile and desktop screenshots were visually inspected. Expected quota-failure diagnostics from existing failure-injection regression scenarios are not concealed; the new Phase 2 journeys explicitly assert no application console/hydration/Base UI/nesting errors.

D10-dependent linked Action creation remains the explicit stopped path. No other approved Phase 2 path requires a historical identity, Audit ID, evidence or signature rewrite. Leave the working tree intact and stop for the manual UAT checklist above. No Phase 3 work, commit, push, merge or deployment is authorized by this handoff.
