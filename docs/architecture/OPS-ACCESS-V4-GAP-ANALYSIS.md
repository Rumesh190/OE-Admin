# OPS Access v4 — Gap Analysis

Status: Phase 1 reconciliation, 22 October 2026; source-grounded documentation only. Read alongside the [master specification](OPS-ACCESS-ARCHITECTURE-V4-MASTER-SPEC.md), [decisions](OPS-ACCESS-V4-DECISION-REGISTER.md) and [implementation plan](OPS-ACCESS-V4-IMPLEMENTATION-PLAN.md). Only the four existing v4 documents are updated; no implementation or runtime data mutation was performed.

## 1. Baseline and evidence index

Current working-tree code is the implementation baseline, including pre-existing uncommitted v3 work. Earlier v3 plans describe the situation before Phase 1/2; their missing-model statements are not current facts. Reports' historical test results are not this inspection's validation. The available nine-slide v3 deck was inspected as XML text; its FA/Champion conflation is superseded by v4. Browser-local runtime records were not available and no persisted directory uniqueness claim is made.

| Evidence | Source and inspected behavior |
| --- | --- |
| E01 | `lib/organizations.ts`: ABC/XYZ catalog, dynamic v3 clients; `lib/organization-store.ts`: explicit new client ownership, legacy ABC fallback, one Egmore factory seed, Zones A–D, single department string and legacy leader |
| E02 | `features/five-s/administration/types.ts`, `store.ts`, `access-v3-types.ts`, `access-v3-state.ts`: stable person, independent CM/FM/FA/Zone allocations/Auditor grants; empty v3 default collections; legacy seed roles/contact generation |
| E03 | `features/five-s/administration/access-v3-store.ts`: scoped client/CA/factory/FA/user/Zone/grant/reassignment commands, actual-actor checks, payload allowlists, cross-client eligibility guard and journal commits/recovery |
| E04 | `features/five-s/administration/factory-authorization.ts`: active canonical scope chain, explicit membership/assignment, grant dynamics, own-Zone exclusions including retained legacy leader references; no implicit SA factory operator |
| E05 | `lib/demo-session.ts`, `lib/current-user.ts`, `components/navigation/user-menu.tsx`: local demo actual actor, fixed personas plus SA scoped-person selection, no explicit active tenant/factory session context |
| E06 | `lib/five-s/audit-authorization.ts`, `audit-store.ts`, `audit-evidence-storage.ts`, `features/five-s/components/FiveSAuditCreate.tsx`, `FiveSAuditExecution.tsx`, `AuditorSignaturePad.tsx`: scoped creation/read/execution/signatures/evidence, preserved legacy branch and D10 disabled path |
| E07 | `features/five-s/types/my-actions.ts`, `lib/actions/action-store.ts`, `action-creation-access.ts`, `action-source-access.ts`, `action-config.ts`, `features/actions/create-linked-action-dialog.tsx`: one canonical service; ABC/legacy scope in creation, source registration, existing lifecycle/reassignment/submission histories and closure |
| E08 | `features/actions/action-center-data.ts`, `action-center-page.tsx`, `features/five-s/action-detail-page.tsx`: legacy role/plant/primaryZone visibility and review routing; no Department/Champion/context projection |
| E09 | `lib/module-entitlements.ts`, `lib/modules.ts`, `components/modules/module-gate.tsx`, `components/navigation/sidebar-nav.tsx`, `components/ops/administration-subject-boundary.tsx`: per-client saved maps; default ABC normal shell; scoped Audit exception; v3 profile operational route boundary |
| E10 | `features/five-s/continuous-improvement/access.ts` and `store.ts`: permission/global role + primaryZone/participant visibility, legacy proposal/review/implementation/completion policies |
| E11 | `features/five-s/red-tag/access.ts` and `store.ts`: session actor, canonical legacy factory/Zone lookup, permissions/roles, own-leader-Zone creation restriction, disposition/linked Action lifecycle |
| E12 | `features/visual-improvement/visual-improvement-access.ts`, `visual-improvement-store.ts`: legacy role/ci permissions, primaryZone/participants/owners, review permissions and canonical Action linkage |
| E13 | `features/visual-management/visual-management-access.ts`, `visual-management-store.ts`, `visual-management-configuration-store.ts`, `types.ts`: board/meeting owner/member and legacy role scope; separate board escalation structure |
| E14 | `features/gemba/gemba-access.ts`, `gemba-store.ts`: Admin/Auditor walk authority, primaryZone/participants/leads reads, separately projected horizontal shared observation; linked source Actions |
| E15 | `features/ops-dashboard/ops-dashboard-page.tsx`, `ops-dashboard-data.ts`, `features/reports/reports-page.tsx`, `features/reports/report-data.ts`, `features/analytics/analytics-dashboard-page.tsx` (`useAnalyticsDashboardModel`): aggregate consumers and per-module visibility |
| E16 | `lib/relationships/use-canonical-linked-records.ts`, `canonical-records.ts`, `route-resolver.ts`, `lib/records/record-deletion.ts`, `record-tombstones.ts`: source/reverse links, default ABC scope, retained deleted references and canonical ID reservations |
| E17 | `lib/administration-storage.ts`: pending-transaction original-payload reads; administration commit/recovery in E03. `lib/notifications/notification-store.ts`: immediate browser-local notification/deduplication, no durable background SLA engine |

Relevant historical sources: [Phase 1 report](../QA/OPS-ACCESS-V3-PHASE1-IMPLEMENTATION.md), [Phase 2 report](../QA/OPS-ACCESS-V3-PHASE2-IMPLEMENTATION.md), [IQ preflight](OPS-IQ-CLIENT-ONBOARDING-PREFLIGHT.md), [v3 plan](OPS-ACCESS-ARCHITECTURE-V3-IMPLEMENTATION-PLAN.md), [v3 gap analysis](OPS-ACCESS-ARCHITECTURE-V3-GAP-ANALYSIS.md).

## 2. Implemented reuse and model gaps

Implemented: canonical clients and independently owned factories, canonical people, explicit CMs/FMs/FA assignments, Zone allocations, active/revoked Auditor grants and administration events. Commands and real administration forms exist; this is more than type-only support. Existing-person addition to another factory within an eligible client is implemented. General existing-person attachment to another independent client is not.

Missing: independent Department identity/lifecycle; separate multi-leader ZL, Champion, DL/DM assignments; explicit independent FA-work verifier designation; hierarchical Champion escalation/request histories/SLA; active tenant/factory context. Current FM has one base role and Zone allocations may contain multiple Leader Zones. Current Zone has one `leaderId` and one `department` string. None of those fields represents the approved v4 cardinality.

## 3. Prioritized gap matrix

P0 blocks safe IQ provisioning or the complete approved Audit pilot. P1 is core v4 hierarchy/workflow. P2 is deferred module integration or production hardening; production enforcement remains a release blocker even though it is outside the frontend pilot.

| Gap | Existing implementation | Required v4 behavior | Risk | Dependency | Suggested phase |
| --- | --- | --- | --- | --- | --- |
| G01 **P0** Shared identity attachment | E03 rejects foreign existing person without target CM; private `joinClient` is not reviewed public attachment | Explicit actual-SA reviewed append-only attachment; no automatic roles; duplicate/inactive protections | Critical: unauthorized tenant access or duplicate people | Approved U01/U08; R06/R10 attachment/context contract | 1, 3, 4 |
| G02 **P0** Active context | E05 person selector; normal shell defaults ABC | Approved refresh-persisted explicit Client/Factory context, revalidated each protected operation; scoped deep links/cache invalidation; no fallback | Critical: mixed tenant reads/writes | Approved U01; R06 adapter; E04 reuse | 1, 3 |
| G03 **P0** Safe IQ staging/entitlements | New client Active; missing map uses broad defaults; ordinary shell E09 ABC | Deny-by-default staged provisioning; explicit IQ Audit-only map, tenant shell and activation gate | Critical: unintended modules/ABC subscription behavior | G02, R06/R09 staging and bootstrap; IQF confirmed | 1, 3, 5 |
| G04 **P0** First IQ FA bootstrap | CA may assign only eligible existing same-client person; FA creates factory people | Reviewed Lakshman CM then explicit CA→FA; no temporary CA privilege workaround | High: deadlocked setup or unauthorized promotion | G01/G02, approved identity | 4, 5 |
| G05 **P0** D10 Action creation/link | E07 hardcodes ABC/legacy permissions; E06 adapter/link repeats old checks | Approved narrow Audit-origin canonical creation/draft with validated owner/capacity, coordinator-selected verifier before submission, atomic one-question link/recovery | Critical: unresolved findings or orphan/foreign Actions | G01/G02/G06/G07/G11; approved U03/U04/U05/U06-A; R01/R02/R03/R06 | 6 |
| G06 **P0** Audit-only task capability | Action creation requires Actions entitlement | Approved U06-A narrow Audit-origin task capability, no general Actions entitlement or unrelated sources; exact enforcement still missing | Critical: pilot cannot handle noncompliance | Approved U06-A; G03/R06 resolver and task boundary | 1, 6 |
| G07 **P0/P1** Independent verification | E07 current owner excluded; creator/auditor/name fallback can review; non-Audit ZL delegation | Approved independent coordinator selection before submission; draft may lack verifier; person-ID exclusions and hierarchy; CA Action-specific FA-work designation | High: self-review or stranded work | Approved U04/U05; R01/R03 coordinator/qualification/replacement; Department origin | 1, 2, 6–7; D10 slice before pilot |
| G08 **P1** Department records/lifecycle | E01 single `department` string | Independent records; no transfer/hard-delete references; unfinished-work guard | High: lost origin/evidence or invented migration | Approved U09; R06 adapters/R08 dependency coverage | 2, 4 |
| G09 **P1** Role cardinality | E02 one FM base role, many Zone allocations, one legacy leader field | Separate assignments; many ZLs/Zone, one led Zone/person/factory; ZL Departments align with led Zone; approved U10 grantors | High: hidden authority expansion or legacy grant loss | Approved U02/U09/U10; R06 legacy adapter/R07 detailed allocation | 1–4 |
| G10 **P1** Champion oversight/escalation | No Champion model; E13 VM board escalation only | Factory-wide read projection and one accountable recipient, manual escalation, acknowledgment/rejection/SLA | High: broad mutation or automatic role inheritance | G02/G09; approved FA-configured calendar-hour SLA; R04/R05/R07 lifecycle/delivery/projection | 7 |
| G11 **P0** Uniform scoped Action access | Creation/start stronger than later helpers; E08 role/primaryZone visibility | Actual actor/context across owner/reviewer picks, work/evidence/review/generic updates/list/report/reverse links | Critical: forged actor, leaked records or non-executable assignment | G02/G07; approved U03 originating-Zone owners; R02 detailed eligibility | 6 |
| G12 **P0/P1** Recovery and revisions | E03/E17 journals selected payloads, Action rollback existing; no universal cross-store DB transaction | Conflict detection and atomic metadata/link/event/asset intent publication; retain originals | High: orphan Action or history loss after failed write | Approved storage/version/transaction contract | 1, 3, 6–7 |
| G13 **P2** Other module Department/Champion policies | E10–E15 remain mixed legacy helpers | Approved per-module operation policies before enabling v4 mutations; scoped aggregates | High: assuming role means universal mutation | G02/G08/G09, per-module business approval | 8 |
| G14 **P0/P2** Navigation/reports/evidence | Scoped Audit supported; E16 ABC relations; other module visibility mixed | No foreign titles/counts/files in pilot; full module contextual scope later | Critical: cross-client leak | G02/G03/G11; approved U08; R06 retained-read adapter | 3/6 pilot slice; 8 full |
| G15 **P2/release** Production enforcement | LocalStorage/demo session/client guards, editable history | Server auth, queries/commands/files/exports authorization, durable transactions/events/SLA delivery | Critical for production | Separate backend/identity/security architecture | 9 |

## 4. Module-by-module integration

No row approves new Department mutation permissions. IQ remains Audit-only; canonical Audit-origin corrective tasks need implementation of the approved U06-A D10 capability under separately approved technical contracts, not other source-module activation.

### Audit

- **Current authority/scope:** E04/E06 require explicit FA for scoped scheduling/direct execution/reassignment, effective assigned ZL grant for execution, canonical client/factory/Zone, Audit subscription and actual actor. Legacy scope-less records retain compatibility exceptions.
- **Department/Champion gaps:** Audit stores a department display string; no Department ID/assignment authority or Champion progress projection. Champion reading Audit progress needs a specific read projection, not granting execution or signatures. New Department references must be additive and checklist/scoring policy unchanged.
- **V4 changes/dependencies:** context-aware shell and scope resolution; D10 linked canonical tasks; approved role adapter while preserving v3 grant eligibility and own-Zone exclusions. No new independent Audit review. Phase 3 foundation + phase 6 integration.
- **Compatibility:** preserve IDs, checklist sections/answers/scoring snapshots, schedule/due dates, assignments, signatures/history and evidence references. Audit completion remains independent of Action closure after valid required linkage.

### Action Center

- **Current authority/scope:** E07/E08 use legacy Admin/Zone Leader/Auditor/Reviewer permissions, plant/primaryZone and responsible/reviewer IDs with name fallbacks. Creation requires ABC context/entitlements; start resolves actual actor more strictly than several subsequent helpers that accept a supplied directory actor.
- **Department/Champion gaps:** no explicit work capacity, Department origin, v4 hierarchy or independent verifier grant; broad role visibility is not factory Champion oversight.
- **V4 changes:** shared context/assignment/read policies on every canonical command and evidence path; preserve MyAction/statuses/source registry. Champion read projection and escalation link cannot mutate/reassign/close Action. Phase 6 D10 slice, phase 7 complete hierarchy, phase 8 other sources.
- **Compatibility:** creator-review legacy exceptions and name-only historical records require isolated adapter; do not retroactively fail completed history or silently rewrite pending reviewers. Preserve Type/start/undo, rework/revisions, closure evidence/cost/category rules, histories and tombstones.

### Continuous Improvement

- **Current authority/scope:** E10 uses `ci.*` permissions, broad legacy Admin/Auditor/Reviewer/Viewer visibility, primaryZone/proposer/owner/member IDs; Admin or primary-Zone permission holders review. Super Admin excluded by helpers.
- **Department/Champion gaps:** no independent Department membership or Champion role/projection; no comprehensive new creator-versus-approver policy.
- **V4 changes:** explicit origin and Department policy, assigned independent approver and scoped reads/commands after separate business review. No automatic DL approval or FA closure. Champion progress/escalation projection only. Phase 8; disabled for IQ.
- **Actions/history:** canonical linked implementation Actions stay separate from proposal lifecycle; preserve CI decisions, benefits/evidence/source links and terminal-state consistency; do not replace CI with Actions.

### Red Tag

- **Current authority/scope:** E11 resolves demo actual actor and legacy canonical plant/Zone; roles/permissions and same-plant/all-organizations rules; own-led-Zone raising restriction, source lifecycle/disposition logic and Action linking.
- **Department/Champion gaps:** display location/Zone is not Department assignment; no Champion oversight/escalation integration or multi-ZL evaluator selection contract.
- **V4 changes:** canonical tenant/Department refs, explicit multi-leader evaluation routing, approved separate duties for new workflow, factory oversight projection; no inherited Champion disposition/close authority. Phase 8; disabled for IQ.
- **Actions/history:** reuse canonical linked Action; preserve dispositions, source evidence, printed/deep links, own-Zone rule and legacy records. Do not merge Red Tag with Red Flag or rename it as part of access work.

### Visual Improvement

- **Current authority/scope:** E12 uses legacy roles, `ci.*`/`actions.review`, primaryZone and owner/creator/participant relationships, not explicit v4 assignments.
- **Department/Champion gaps:** no Department identity/authority or Champion projection; current review helper can be broad.
- **V4 changes:** scoped entity read/write/evidence/review and explicitly approved module approval rules, Champion monitoring only. Phase 8; disabled for IQ.
- **Actions/history:** keep source/implementation Action links and completion consistency, participant/owner evidence/history; do not conflate VI with VM.

### Visual Management

- **Current authority/scope:** E13 board owner/members, Admin/Auditor reads, plant/primaryZone; command helpers consult current directory for operation/configuration. Board/meeting escalation is a distinct existing structure.
- **Department/Champion gaps:** no Department assignments, factory Champion projection or new hierarchical recipient/SLA policy. Board member/owner status is not a global v4 privilege.
- **V4 changes:** explicit scoped board/meeting permissions and Department refs only after approval; Champion read/escalation adapter in later phase. Do not replace existing escalation engine/statuses. Phase 8; disabled for IQ.
- **Actions/history:** topics/escalations retain explicit canonical linked Action IDs; preserve meetings/KPI history, attendees, board owners and tombstone reads. Requesting reassignment must not perform it.

### Gemba

- **Current authority/scope:** E14 Admin/Auditor walk conduct/mutate, active-directory checks, primaryZone/lead/participant reads; horizontal deployment has limited shared-observation projection.
- **Department/Champion gaps:** no Department assignment and no Champion factory-wide policy. Existing observation-only projection demonstrates that limited reads need not reveal whole walks or linked Actions.
- **V4 changes:** contextual origin and separately approved observation contribution vs walk-management authority; Champion progress projection with minimum fields. Phase 8; disabled for IQ.
- **Actions/history:** keep observation source IDs/evidence/horizontal shares and canonical linked Actions; do not grant walk admin merely to permit observations or monitoring.

### Dashboard

- **Current authority/scope:** E15 aggregates canonical module stores with current persona/module/visibility helpers and existing filters. Filters are presentation, not tenant authorization; normal entitlement hook defaults to ABC.
- **Department/Champion gaps:** no consistent active-client/factory gate or Department dimension. Current totals do not demonstrate approved Champion-wide visibility.
- **V4 changes:** one primary dashboard consuming authorized projections, role/context-consistent counts and drilldowns; Champion factory metrics without broad record/evidence mutation. No duplicate dashboard. Phase 8; no new IQ Dashboard entitlement in Audit-only pilot.
- **Actions/history:** Action progress must derive from canonical authorized Actions, including source records independently; no fixture inflation, copied task database or historical owner rewrites.

### Reports

- **Current authority/scope:** E15 report library consumes scoped Audit hook and per-module visibility (Actions/CI/Gemba/VM etc.), entitlements and visible-row exports. E16 relationships still default ABC. These mixed policies are not full multi-tenant isolation.
- **Department/Champion gaps:** no unified Department/Champion read/export projection; report access must not imply file/underlying record access.
- **V4 changes:** shared authorized dataset for lists/counts/details/export/linked evidence, canonical context and explicit Champion aggregate-vs-detail permissions. Phase 6 only already supported Audit report path; phase 8 broader Reports remains disabled in IQ.
- **Actions/history:** canonical Action ownership/completion attribution and Audit/Action independent lifecycle metrics retained; historical snapshots not retroactively reassigned.

## 5. IQ-specific findings

Approved planning values now resolve the prior unknown client industry/factory name/location: IQ / Manufacturing, IQ Factory 1 / Chennai. Factory code `IQF` is confirmed by U11. Final Zone codes, Department lists and personnel allocations remain unapproved. Current `saveFactoryZone` requires a nonempty department string; safe Zone creation must await the reviewed v4 compatibility contract rather than invent “Production.”

The new IQ CA is explicitly a distinct Manoj Guru (`manoj@IQ.com`, `Manoj_001`). Repository seed generation gives ABC `USR-MANOJ-GURU` a different email (`manoj.guru@egmore.example`) and Employee ID (`EMP-MANOJ-GURU`). No proposed contact/Employee ID collision was found in inspected repository records. Current runtime uniqueness checks remain mandatory; active persisted data is not verified.

Lakshman remains proposed, not assigned. No existing ABC identity can be attached until reviewed CM command and active-context policy exist. Keep ABC client/`PLANT-EGM`, its Zones A–D (including Anand leadership), memberships, source records, subscriptions and histories intact. New IDs are generated, not supplied by name/legacy lookup.

## 6. Tests inspected and required extensions

| Existing source | What is reusable | Missing v4 acceptance |
| --- | --- | --- |
| `tests/access-v3-phase1.test.ts`, `e2e/access-v3-phase1.spec.ts` | Actual actor/forbidden payloads, scoped admin, rollback, independent memberships and retained legacy directory | Reviewed cross-client attach, context switching, Department cardinality/lifecycle, separate role assignments |
| `tests/access-v3-phase2.test.ts`, `e2e/access-v3-phase2.spec.ts` | Grants/revocation, canonical scope/own-Zone exclusions, FA direct execute/reassign, evidence/signature retention, journal failure | Multi-leader adapter, v4 context with same-named Zones, IQ-only entitlements, D10 source tasks; no new Audit review |
| `tests/action-plan-creation.test.ts`, `action-store.characterization.test.ts`, `action-integration-hardening.test.ts`, `p0-authorization-gaps.test.ts` | Canonical creation/source linking and existing lifecycle/permission checks | Actual actor every transition, explicit new scope/work capacity, no forged review, cross-client owner/reviewer denial |
| `tests/audit-independent-action-closure.test.ts`, `audit-scoring-policy.test.ts`, `audit-configurable-scoring.test.ts` | Audit/Action lifecycle independence, scoring/completion | Noncompliant IQ finding with real linked Action, no relaxation, correct signature despite reassignment |
| `tests/action-plan-execution-types.test.ts`, `action-start-undo.test.ts`, `action-evidence-quota.test.ts`, `audit-evidence-quota.test.ts`; corresponding Action/Audit browser suites | Start-time Type rules, undo/cancel, quota/recovery and evidence retention | Cross-store D10 retry/failure atomicity and context changes during pending upload/submit |
| `tests/red-tag-cross-zone-authorization.test.ts`, `gemba-horizontal-deployment.characterization.test.ts`, CI/VI/VM characterization and report/dashboard tests | Existing specialized workflows and limited projections | Scoped Department/Champion operations only after individual module approval; preserve legacy reads/closures |

No unit or browser tests were executed for this documentation task. No browser storage was seeded/reset and no test result is claimed for unimplemented v4 behavior. Future changes use targeted suites first, followed by one consolidated automated browser acceptance after all approved changes; production server isolation requires separate tests.


## 7. Phase 1 contract reconciliation and readiness

Source implementation remains unchanged: current commands do not implement refresh-persisted active tenant context, additive Departments, independent coordinators/verifier designations, staged IQ provisioning or D10 scoped tasks. Planning approval is not implementation evidence. The [master specification section 12](OPS-ACCESS-ARCHITECTURE-V4-MASTER-SPEC.md#12-phase-1-reconciled-authorization-contracts--proposed-interfaces) now defines proposed exact inputs/results/errors and boundaries; [section 14](OPS-ACCESS-ARCHITECTURE-V4-MASTER-SPEC.md#14-legacy-compatibility-matrix) supplies the legacy matrix.

| Boundary | Approved update / remaining implementation gap | Test obligation before IQ onboarding |
| --- | --- | --- |
| Context | U01 persists explicit selection through refresh, revalidating every protected operation; E05/E09 still lack full context | Person-bound restore, revoked/foreign selection denied, no ABC fallback, counts/exports/files/stale dialogs revalidated; listing tabs still All |
| Role alignment and owner scope | U02 ZL Department alignment, U03 originating-Zone Department task owners, U10 FA appointments and eligible-DL allocations | Same-Zone multi-Department allowed; cross-Zone/led-Zone mismatch/unauthorized appointment denied; legacy allocations untouched |
| Capacity/coordinator | U04 capture capacity at assignment, independent authorized coordinator selects before submission | No-verifier creation/draft succeeds when otherwise eligible; submission fails without valid selection; multi-role creator/completer/coordinator cannot bypass exclusions; R01/R02 unresolved qualification |
| CA designation | U05 one FA Action-specific designation, no automatic CA verifier/factory authority | Foreign factory/client and wildcard grant denied; designation not selection; qualification/replacement/revocation R01/R03 gates |
| D10 narrow capability | U06-A approves Audit-origin canonical service while general Actions remains off | Owner/source scope, minimum task/evidence access, one canonical Audit/question Action, idempotent retry/rollback, no manual/unrelated source reads/writes |
| History and Departments | U08 current-authorized new-v4 retained reads; U09 additive IDs with no migration | Preserve explicit legacy read/reviewer/grant adapters, Zone strings, Audit snapshots/signatures, revisions and original-payload journal; R06 gate |
| SLA | U07 assigned FA configures calendar-hour response deadlines; expiry notifies Champion, no auto-progression | Config actor/scope, immutable policy snapshot, one accountable recipient, no auto-routing; R04/R05 remaining state/clock/delivery gate phase 7 |
| IQ configuration | U11 IQF settled; remaining final allocations/bootstrap/activation unapproved | Runtime contact uniqueness, reviewed Lakshman CM before CA FA assignment; staged all-off then verified explicit Audit-only; ABC unchanged |

**Resolved decisions:** U01/U02/U03/U04/U05/U06-A/U08/U09/U10; U07 calendar-hour/configurator/expiry boundary; U11 IQF. These are no longer open business questions. Exact interfaces/storage/adapters remain proposed.

**Unresolved blocking decisions:** R01 coordinator/selection replacement; R02 detailed owner/work capacity; R03 eligible FA-work verifier; R06 compatibility and recovery; R08 unfinished dependencies; R09 first-FA/final setup; R10 reviewed attachment. R04/R05 block escalation and R07 blocks expanded allocation/oversight. The register provides precise recommendation, affected phase, behavior held unchanged and required approval for every item.

**Nonblocking deferred decisions:** escalation delivery/lifecycle and expanded module/production policies do not block a pure-validator/legacy-characterization batch. They remain blocked for their own operations; no safe-policy recommendation is silently adopted.

**Minimum safe first batch:** separately approved pure hierarchy/context validators and read-only legacy compatibility characterization/tests, without live policy replacement, new persistent collections/writes, identity attachment, records, role/grant changes, entitlements or D10. Full model/authorization/onboarding needs the dependent R-series approvals, implementation and targeted tests followed by one consolidated isolated browser acceptance. Current documentation checks are not that acceptance.
