# OPS Access v4 — Implementation Plan

Status: Phase 1 final reconciliation, 22 October 2026; proposed future work only. No phase is authorized for implementation by this documentation task. Read the [master specification](OPS-ACCESS-ARCHITECTURE-V4-MASTER-SPEC.md), [gap analysis](OPS-ACCESS-V4-GAP-ANALYSIS.md) and [decision register](OPS-ACCESS-V4-DECISION-REGISTER.md) together.

## 1. Dependency order and delivery gates

Recommended order follows the requested sequence, with an explicit change: complete the **D10 owner/verifier policy contract in phase 1** and the minimum independent-verifier implementation in phase 6 before calling the Audit pilot complete. Full Champion escalation and remaining verification UI can follow in phase 7. Approved U04 permits otherwise valid task creation/draft without a verifier; however independent-review submission must remain blocked until coordinator selection and, for FA work, valid Action-specific CA designation are available.

Phases 2/3 can be developed separately only after their common contracts are approved; phase 4 depends on both. Phase 5 provisions a staged, non-operational IQ scope; it does **not activate Audit**. Phase 6 completes Audit+D10 checks, then permits a separately approved Audit-only activation. Current Active-client/broad-default behavior must first be fixed for new staged clients. Production enforcement remains phase 9 and is mandatory before real production use, not an optional consequence of frontend acceptance.

Future implementation must preserve the existing working tree, operate through canonical commands and run targeted isolated unit/regression tests. No destructive tests on the active user's browser/storage. After all changes in the approved batch, run **one consolidated automated browser acceptance** in an isolated browser profile; no claim of production security from that run.

## 2. Phase 1 — Architecture contracts and compatibility policies

**Scope:** approve entity schemas and version/read adapters, explicit parent/role invariants, active-context contract, actual-actor permission API, new-v4 policy discriminator, retained historical reads, staged entitlements and D10 capability. Define cross-store journal/revision/idempotency boundaries. U01/U02/U03/U04/U05/U06-A/U08/U09/U10 and U11 IQF are resolved business boundaries. Resolve only residual detailed coordinator/owner/verifier/adapter policies (R01/R02/R03/R06), not those approved decisions, before dependent code.

**Dependencies:** A01–A31 and the resolved U-series ledger. R01/R02/R03/R06/R08/R10 gate dependent live policies; R04/R05 escalation details may remain deferred when excluded. U07 calendar-hour response SLA, assigned-FA configuration and no automatic progression are approved. Define precisely which legacy records remain on unchanged compatibility policies.

**Exact source areas to inform later changes:** `features/five-s/administration/access-v3-types.ts`, `access-v3-state.ts`, `access-v3-store.ts`, `factory-authorization.ts`; `lib/demo-session.ts`, `lib/current-user.ts`, `lib/module-entitlements.ts`, `lib/administration-storage.ts`; `features/five-s/types/my-actions.ts`, `lib/actions/action-store.ts`, `action-creation-access.ts`; `lib/five-s/audit-store.ts` and the four architecture documents.

**Stop conditions:** unresolved coordinator/eligible-verifier grantor/qualification, attachment R10, adapter/recovery contract or self-verification loophole; narrow Audit-origin business capability itself is approved; no approved policy/version boundary; proposed migration would rewrite history. Do not implement isolated role labels while contracts remain contradictory.

**Required tests/design cases:** document expected allow/deny tables for SA/CA/FA/Champion/ZL/DL/DM, combined roles, same names/different IDs, legacy multi-Zone leaders, absent/inactive verifier and atomic failure points. Trace each approved decision to a future test; no app test execution required merely to approve documents.

**Acceptance:** reviewed contracts resolve blockers for the explicitly selected implementation batch, state which policies remain unchanged, and define fail-closed behavior for missing scope/verifier. Explicit approval to start any implementation is required; phase 2A below is the smallest bounded candidate, not authorization to begin phase 2/3 wholesale.

**Preservation:** no canonical ID/role/status/history/storage rewrite; approved future reader compatibility must retain unknown metadata and existing references.

## 3. Phase 2 — Canonical Department and assignment model

**Scope:** additive Department records; separate ZL/Champion/DL/DM/verifier assignments; immutable parent chain, attributed assignment/event lifecycles and unique-active constraints. Retain existing CM/FM/FA/Auditor grants and directory. Define dependency-index interfaces for unfinished Department work and role obligations. No automatic migration of Zone strings or leader fields.

**Dependencies:** phase 1 T01/T02/T05/T10; approved U02/U09/U10; residual R06/R08 and R07 only for expanded allocations. Design interfaces for phase 3 policies without enabling privileges.

**Exact source areas:** `features/five-s/administration/access-v3-types.ts`, `access-v3-state.ts`, `access-v3-store.ts`, `types.ts`; `lib/organization-store.ts`; legacy consumers in `lib/five-s/configuration.ts`; `features/five-s/types/five-s.ts` and `my-actions.ts` only for approved additive origin/assignment references. Reuse this feature area for new typed collections; do not create parallel people/Actions stores.

**Stop conditions:** invalid/ambiguous parent IDs; v3 multi-Zone conflict cannot be represented safely; old required department string would force invented data; allocation validation would silently move people or resurrect grants; incomplete deactivation dependency index.

**Required tests:** isolated round-trip old/new payloads and missing optional arrays; unknown field retention; same-named Departments in different Zones; duplicate active assignment rejection; many people leading same Zone/Department; one led Zone/person/factory; multiple same-Zone Departments allowed, different-Zone assignments denied; combined-role cases; inactive parent/role and referenced Department deletion denied; no unwanted side effects on failure.

**Acceptance:** explicit Department identity and independent assignments represent all cardinalities; old source snapshots and v3 grants remain intact; no role inference/implicit permission. New commands stay unavailable until authorization integration.

**Preservation:** no ABC migration, no seeded Departments from “Production,” no leaderId rewriting, no new canonical IDs for existing people or business records.

## 4. Phase 3 — Authorization and session-context foundations

**Scope:** actual-person context resolver for platform/client/factory modes; explicit person-bound Client/Factory context persisted on refresh and revalidated on every protected operation; explicit context switching; reviewed SA-only existing-person CM attachment; scoped reads/commands/entitlements; cache/dialog/evidence invalidation; pending-recovery and revision checks. Implement deny-by-default staging for new client provisioning, preserving existing clients' compatibility.

**Dependencies:** approved U01/U08 and phase 1 entity contracts; R06 reader/schema compatibility and separately approved R10 attachment procedure. Cross-client attachment requires separately approved policy, not just schema availability.

**Exact source areas:** `lib/demo-session.ts`, `lib/current-user.ts`; `features/five-s/administration/factory-authorization.ts`, `access-v3-store.ts`; `lib/module-entitlements.ts`, `lib/modules.ts`; `components/modules/module-gate.tsx`, `components/navigation/sidebar-nav.tsx`, `user-menu.tsx`, `components/ops/administration-subject-boundary.tsx`; `lib/administration-storage.ts`, `lib/relationships/use-canonical-linked-records.ts`, `lib/five-s/audit-authorization.ts` for context-aware approved reads.

**Stop conditions:** context chooses ABC/first factory implicitly; ordinary CA/FA can enumerate/attach foreign people; SA gains operational authority through context; entitlement changes affect another client; inactive CM reactivated without review; stale context can publish an upload/write; pending transaction recovery would discard later valid work.

**Required tests:** actual actor vs supplied ID, persisted context restore/revocation/no-fallback, no-FA SA/CA denial, two clients with identical names/Zone codes, context/deep-link/refresh/Back/Forward behavior, former-context cache/count/export/title/evidence denial, duplicate/inactive attachment, retained old memberships, missing/ambiguous context, stale revision, storage/journal failure and rollback. Verify membership attachment alone adds no CA/FM/FA/Zone/Department/Auditor/verifier authority.

**Acceptance:** no selected-context authority beyond canonical assignment; explicit tenant map and safe staging prevent broad-default access to new IQ; old ABC module behavior remains unchanged unless separately approved.

**Preservation:** append memberships; retain ABC arrays, legacy roles/plant/primaryZone and histories. No direct localStorage workaround or temporary elevated role. Production security remains unimplemented.

## 5. Phase 4 — Administration UI and command integration

**Scope:** authorized Department/role lifecycle and allocation dialogs, safe account/scope selection, reviewed attachment UI, explicit Factory Admin assignment, active-context labels, dependent-work feedback and retained assignment history. DL allocation controls limited to eligible existing same-Zone people; no account creation/elevated-role selectors. Champion assignment separate from FA.

**Dependencies:** phases 2/3; approved additive Department/U10 grantors and complete R08 dependency providers. R06/R07 govern adapters and detailed allocations. U05 CA Action-specific designation is approved; R03 qualification and R01 selection/replacement must be resolved before verifier UI.

**Exact source areas:** `features/five-s/administration/access-v3-page.tsx`, `access-v3-store.ts`, `users-page.tsx`, `store.ts`; `app/(app)/settings/administration/`; `features/super-admin/super-admin.tsx`; `features/settings/settings-access.tsx`; existing shared dialog/select/button/table controls.

**Stop conditions:** UI exposes command not supported/authorized; roles conflate hierarchy levels; mutation can bypass command via legacy editor; unfinished work cannot be safely resolved; no eligible person shown but save silently succeeds; deactivation drops evidence/history.

**Required tests:** command-first role matrix; payload injection/forged parent IDs; DL cannot manage other Departments/Zones or grant access; multiple leaders supported; deactivation blocked until domain-authorized reassignment; unchanged foreign factory data; recovery failure retains original graph. UI component checks for accessible labels/focus/error states; browser exercise deferred to consolidated acceptance.

**Acceptance:** available controls exactly match actual permitted commands, unavailable operations explain the cause, no fake handlers or inherited permissions. Listing All defaults/navigation/deep links preserved.

**Preservation:** retain existing legacy editor/grant boundaries, locked names/codes and history; new v4 commands cannot silently mutate legacy role arrays.

## 6. Phase 5 — Staged IQ onboarding

**Scope:** only after final configuration approval and runtime read-only preflight, provision independent IQ scope under staged activation. Use actual SA to create IQ/Manufacturing and distinct CA Manoj Guru (`manoj@IQ.com`, `Manoj_001`); actual CA creates IQ Factory 1/Chennai with confirmed IQF code. Reviewed existing-person attachment precedes explicit Lakshman FA appointment. Create approved new Zones and Departments only once lists/compatibility are approved. Configure only approved allocations. Persist explicit all-disabled operational map while staging; later Audit activation is a separate confirmed gate.

**Dependencies:** phases 1–4, U11 final configuration, actual browser directory uniqueness and no pending recovery. Existing ABC-person attachment remains separately approved and context-gated. New IQ CA has a similar name to ABC Manoj but is explicitly a distinct identity; never reuse `USR-MANOJ-GURU`.

**Exact commands/areas:** `saveClientProfile`, `assignClientAdministrator`, `saveFactory`, reviewed `attachExistingPersonToClient`, `assignFactoryAdministrator`, approved Department/role/Zone commands and staged entitlement/activation command; current areas `access-v3-store.ts`, `access-v3-page.tsx`, `lib/module-entitlements.ts`, `features/super-admin/super-admin.tsx`.

**Stop conditions:** collision with live person email/Employee ID/client/factory; unconfirmed final Zone codes/Departments/allocations (IQF is confirmed); code still writes Active/broad defaults before safe stage; Lakshman target eligibility/context not reviewed; missing FA bootstrap; any proposed ABC rename/transfer, Anand demotion, duplicate person workaround or IQ-CA temporary promotion.

**Required tests:** isolated approved provisioning command sequence, explicit ownership and generated IDs, duplicate/runtime guard, no automatic role/grant, inactive/foreign person denial, per-client map independence, failure halfway through staged provisioning/recovery; compare byte-level/semantic baseline of ABC records and histories as applicable. Do not test by resetting the user's live browser.

**Acceptance:** new IQ identities/structure exactly match approved configuration; ABC/Egmore/Zone leaders/subscriptions untouched; IQ still non-operational until phase 6 verification/activation. Empty Department/person allocations are shown as incomplete, not fabricated.

**Preservation:** capture authorized baseline and retain all original client/person/Zone/Action/Audit/evidence/signature IDs, ownership and memberships. No historical record cloning.

## 7. Phase 6 — Audit + D10 canonical Action integration

**Scope:** preserve Phase 2 Audit scheduling/grants/own-Zone/FA direct execution/signatures/history/scoring; implement only approved Audit-origin task capability in canonical Action service. Add explicit scope/work-role/owner/verifier resolution, actual actor/context enforcement across task lifecycle/evidence, authorized task/detail/read projections, idempotent atomic Action/question linkage and recoverable asset/history publication. Include minimum Action-specific CA designation, independent coordinator qualification/selection, assignment-time work capacity and replacement safeguards before pilot acceptance.

**Dependencies:** phases 1–5; approved U03 originating-Zone owners, U04 draft/pre-submit gate, U05 Action-specific CA designation and U06-A narrow task capability; residual R01/R02/R03/R06/R08/R10 contracts and valid operator/grant allocations. IQ Audit-only does not permit global Actions/manual creation or unrelated source registration.

**Exact source areas:** `lib/actions/action-creation-access.ts`, `action-source-access.ts`, `action-store.ts`, `action-config.ts`, `action-evidence.ts`; `features/five-s/types/my-actions.ts`; `features/actions/create-linked-action-dialog.tsx`, `action-center-data.ts`, `action-center-page.tsx`; `features/five-s/action-detail-page.tsx`; `lib/five-s/audit-store.ts` source registration/`linkAuditQuestionAction`, `audit-authorization.ts`, `audit-evidence-storage.ts`; `features/five-s/components/FiveSAuditExecution.tsx`, `FiveSAuditCreate.tsx`; `lib/relationships/*`, entitlement/context boundaries, `lib/administration-storage.ts` and approved binary storage adapters.

**Stop conditions:** no eligible owner blocks assignment/create; missing eligible verifier blocks submission/review/closure, never otherwise authorized creation/draft. Also stop for wrong target context, implicit Actions entitlement, unapproved factory-wide assignment, required Action link relaxed, duplicate source task, partial source/Action commit, any change adding independent Audit review or requiring all Actions closed before Audit completion.

**Required tests:** extend existing v3 Phase 2, Action creation/store/integration, Audit-independent-closure, scoring, Type/start/undo and quota suites. Test same-name foreign factory/Department/person IDs; actual executor creation; current/noncurrent actor denial; link source/question mismatch; duplicate retry, multi-tab stale revision, failed link/write/asset rollback, recovery; scope/owner/verifier revocation during open dialogs; creator/completer cannot select as coordinator or verify through role combination/reassignment; no-verifier creation/draft allowed but submission fails without side effects; CA designation does not grant CA verification; evidence/assignment/signature/rework histories retained. Verify disabled unrelated sources/modules and authorized corrective-task access under Audit-only capability.

**Acceptance:** fully compliant and noncompliant IQ Audits follow existing lifecycle; noncompliant finding has real canonical linked task; own-Zone ZL execution denied and direct FA preserved; legitimate task owners can work/submit and independent selected reviewers can rework/close. Full pending/Completed Action statuses unchanged; Audit completion remains independent of linked task closure. Explicit business approval and successful scoped acceptance precede Audit-only activation; other module flags remain off.

**Preservation:** legacy record policy path unchanged, no migration of old creator-review exceptions; stable source/reverse links, evidence bytes/keys/authors, scoring snapshots, schedule, signature and assignment histories; no generic updater bypass.

## 8. Phase 7 — Champion escalation and complete Action verification

**Scope:** factory progress projection; independent Champion assignment; escalation request/history/one-recipient acknowledgment/response/rejection/manual-level routing; configured per-level SLA and deduplicated expiry notifications; complete Department hierarchical verifier UI/reassignment. Phase 6's verified D10 rules remain authoritative, not a second Action workflow.

**Dependencies:** phase 2/3 assignments/context, phase 6 canonical task policy, approved U07 FA-configured calendar-hour SLA and U10 appointing authority, residual R04/R05/R07 and R01/R03 qualification/replacement. Approve scheduler/transport reliability expectations before claiming SLA notifications while app is closed.

**Exact source areas:** administration assignment/policy area; `features/actions/action-center-data.ts`, existing Action detail/store; `features/ops-dashboard/ops-dashboard-data.ts` for reusable authorized projection functions without enabling IQ Dashboard; `lib/notifications/notification-store.ts` for reviewed minimal transport adaptation only. `features/visual-management/types.ts` and `visual-management-store.ts` are compatibility/reference areas, not authorization to replace their escalation logic. New request/history collections belong to the approved canonical feature/storage design from phase 1.

**Stop conditions:** Champion mutates/reassigns/closes underlying work; no Department yet recipient fabricated; extra leaders can acknowledge as selected person; timer auto-escalates; FA overdue confers CA/SA authority; resolution/cancellation or clock/delivery details undecided (FA/calendar-hour response configuration itself is approved); local browser timer claimed as reliable background delivery.

**Required tests:** multiple candidates/one accountability; unauthorized and stale recipient response denied; acknowledgment required, rejection reason; same-level replacement/history; manual upward routing, missing recipient stays pending, FA overdue stays overdue; deterministic SLA snapshots/clock/reload/dedup; context-scoped notification title/href/evidence; no underlying Action mutation; creator/completer independent verifier across combined roles/retained assignments; VM regression unchanged.

**Acceptance:** approved escalation business events work with explicit chosen recipient and retained history; no automatic reassignment/escalation. UI clearly distinguishes oversight/request authority from execution/verification. Delivery guarantees are accurately bounded; production scheduling remains separate if not implemented.

**Preservation:** VM escalation IDs/statuses/events intact; notification extension cannot replay old events as new privileged actions; all Action revisions and previous verifier/recipient events retained.

## 9. Phase 8 — Deferred module integrations

**Scope:** separately approved Department/Champion operations for CI, Red Tag, VI, VM, Gemba, primary Dashboard and broad Reports. Standardize contextual reads/counts/exports/relations/files before permitting mutations. Do not infer every DL can approve or every Champion can close; review each module's workflow and segregation exceptions independently. IQ entitlements remain Audit-only unless separately amended.

**Dependencies:** core context/model/command policies, canonical Actions/verifiers, per-module approved capability matrix and complete Department dependency-index registration.

**Exact source areas:** CI `features/five-s/continuous-improvement/{access,store,types}.ts`; Red Tag `features/five-s/red-tag/{access,store,types}.ts`; VI `features/visual-improvement/visual-improvement-access.ts`, `visual-improvement-store.ts`; VM `features/visual-management/visual-management-access.ts`, `visual-management-store.ts`, configuration/types; Gemba `features/gemba/gemba-access.ts`, `gemba-store.ts`, deployment; Dashboard `features/ops-dashboard/*`, analytics shared projection; `features/reports/reports-page.tsx`, `report-data.ts`; `lib/relationships/*`, shared source adapters and deletion/tombstone policy where affected.

**Stop conditions:** unresolved module approval/deletion rights; broad role shortcut grants mutation; fixture counts mixed with live totals; cross-Zone Department membership used to widen work scope; source/Action terminal states conflict; report export bypasses row/file authorization.

**Required tests:** existing module characterization/cross-module regressions plus contextual role/operation negative cases, creator/approver independence for approved new workflow, source/reverse links, source deletion retained Actions, report/dashboard authorized counts, report/evidence deep links, inactive Departments with unfinished work. Test Standard User/legacy roles under approved compatibility; no silent deprecation.

**Acceptance:** one canonical store per entity, one primary dashboard, explicit authorized module operations/projections, source lifecycle and Action closure coherent, disabled IQ modules unavailable at UI/direct command/read/export layers.

**Preservation:** no module renames/merges, no historical migrations, existing fixed/status listing separation and All defaults preserved; VI != VM, Red Tag != Red Flag, CI != Action.

## 10. Phase 9 — Production tenant isolation and backend enforcement

**Scope:** separate approved program for real authentication, server session/context, canonical directory/membership persistence, server read/write/report/export/file authorization, row/query tenant constraints, transaction concurrency, immutable audit/event retention, reliable SLA notification outbox/scheduler and recovery. Frontend guards remain UX checks only.

**Dependencies:** approved identity provider/backend/data residency/retention/threat model; validated role/capability contracts and explicit migration strategy. No API/database is assumed to exist from browser-local models.

**Source areas:** future server API/server-action/auth/storage boundaries selected after inventory; existing `lib/demo-session.ts`, canonical stores/authorization helpers/evidence adapters as policy specifications, not secure backend implementations. Do not invent endpoint paths or partially migrate one module without a program design.

**Stop conditions:** missing server tenant/file enforcement, editable roles treated as auth, client-provided actor trusted, unsigned/tamperable history called immutable, incomplete migration/rollback, unsupported delivery/security guarantees.

**Required tests:** authenticated API/DB row isolation, forged tenant/actor and same-ID collision cases, signed/authorized file URLs, export background jobs, concurrency/idempotency, rollback/disaster recovery, account/membership revocation, notification transport/retry, penetration/threat review and tenant data migration reconciliation.

**Acceptance:** server-authoritative identities, authorization and transaction/file isolation validated independently of frontend tests; explicit security/business sign-off before production onboarding/deployment. No production readiness claimed by v4 docs or frontend pilot.

**Preservation:** approved migration maps stable IDs, original evidence bytes/signatures/events and source references; verified backup/rollback and no cross-tenant data movement without authorization.

## 11. Consolidated future acceptance and present handoff

After the selected approved phases, run targeted unit suites plus `npm run lint`, `npx tsc --noEmit`, and appropriate build validation. Then one consolidated automated browser run in an isolated profile covers approved hierarchy/contexts, IQ Audit-only navigation, direct links/refresh/Back/Forward, same-named foreign scopes, Department/cardinality/deactivation guards, actual actors/signatures/evidence, D10 lifecycle/rework/closure, multiple verifier candidates, Champion SLA/routing if included, retained ABC history, mobile/desktop/keyboard states and relevant console/hydration warnings. Keep module-specific suites targeted during development rather than repeatedly reseeding active runtime data.

Compare canonical pre/post identities/ownership/memberships/role arrays, Action/Audit/source IDs, evidence storage references/bytes, signature/assignment/submission histories, tombstones and subscription maps. Denied operations must leave no entity, asset, link, notification or success-event side effect. Existing test expectations change only for explicitly approved policies; never delete scope checks to make tests pass.

Present task validation: static repository/document/test-source inspection only; four existing permitted documentation files reconciled, source/link/decision consistency, task-start file-hash boundary and whitespace checked. No application tests/browser UAT/build run and no production readiness claimed. No application source, runtime data, migration, role, grant or entitlement changed. Existing local work retained; no commit/push/merge/deploy.

**Stop after documentation reconciliation. Recommended next action is review of the proposed contracts and explicit approval of the bounded phase 2A validator/characterization batch below, not IQ creation or D10.**


## 12. Phase 1 readiness and minimum safe first batch

### Resolved decisions and proposed contracts

The Phase 1 brief resolves explicit refresh-persisted/revalidated context (U01), led-Zone Department alignment (U02), originating-Zone Department task owners (U03), independently authorized coordinator/pre-submit selection and assignment-time capacity with no-verifier draft allowed (U04), Action-specific CA designation (U05), canonical Audit-origin task capability without general Actions (U06-A), current-authorized new-v4 history with legacy hold (U08), additive Departments/no migration (U09), FA/DL appointing/allocation boundaries (U10), assigned-FA calendar-hour response SLA/no automatic progression (U07) and confirmed IQF (U11).

Master section 12 specifies proposed exact input/output/error/authority interfaces. Request envelopes, context preference/revision layout, assignment/Department storage, coordinator/candidate resolvers, CA designation lifecycle, staged activation and D10 transaction/idempotency are still proposed engineering contracts. These documents are neither TypeScript implementations nor migration authorization.

### Residual blockers by phase

| Gate | Required approval before dependent implementation | Preserve unchanged |
| --- | --- | --- |
| R01/R02/R03 → phase 4/6/7 Action policy | Coordinator qualification/grantor/replacement; detailed owner/capacity choice; eligible FA-work verifier/designation lifecycle | U04 draft allowed/submission gated, U05 CA no inherited powers, canonical statuses/legacy reviewers/revisions |
| R06 → phase 2 persistent model, 3 live context, 4 UI, 5 staging, 6 D10 | Exact schema/context/read/journal/asset/concurrency adapters including legacy multi-Zone and required department-string handling | All v3 allocations/grants/own-Zone exclusions, explicit retained reads, source evidence/signatures, unknown metadata/original recovery |
| R08 → phase 2/4 lifecycle, 5 relevant activation | Complete unfinished-work/dependency coverage, state table, authorized reassignment authority and failure handling | Existing outstanding Action/CI and last-FA guards, no automatic transfer/history erasure |
| R09/R10 → phase 3 attach, 4 bootstrap UI, 5 provisioning, 6 activation | Separate reviewed attachment authority/identity process; approved Lakshman reuse and first-FA sequence, final Zone/Department/person allocation and later activation | ABC clients/factory/leadership/history/subscriptions; no IQ-CA temporary FA or duplicate-person workaround; IQF already confirmed |
| R04/R05/R07 → phase 7 escalation/oversight, expanded phase 4 allocations | Escalation resolve/cancel/remaining transitions; SLA clock/reset/notification guarantee; detailed same-Zone DL and Champion projection | One recipient, required acknowledgment/rejection reason, calendar-hour FA-configured response deadline, no auto-escalation/reassignment, existing VM flow |

Each R-series item in the register states precise decision, recommended policy (not adopted), existing behavior, phase and required approval. Deferred modules, backend production isolation and escalation delivery are nonblocking for the pure-validator batch only; they remain blockers for those operations and production readiness.

### Proposed phase 2A — pure validators and compatibility characterization

**Scope after separate explicit approval:** implement pure functions that validate approved canonical hierarchy/context input shapes and cardinality/led-Zone invariants, plus isolated characterization tests for unchanged legacy resolver/read behavior. Reuse administration/policy areas and existing test helpers. Model-shaped input types for pure validation must not alter persisted schemas, collections, seed data, live authority projections or storage versions.

**Exact candidate areas:** `features/five-s/administration/` beside current types/policies for pure validation, existing `factory-authorization.ts` consumed unchanged by characterization tests, `tests/access-v3-phase1.test.ts`, `tests/access-v3-phase2.test.ts` and focused v4 validator tests. Exact new filenames can follow repository conventions after search; no second store or dependency required.

**Exclusions:** no storage-backed commands, current-person context persistence wiring, live guard replacement, new client/factory/person/Department records, cross-client membership attachment, role/grant assignment, entitlement/staging/activation, D10 or escalation implementation. No adoption of unresolved R-series recommendations.

**Entry/stop:** explicit approval of this bounded implementation scope and pure proposed input/error contract. Stop if a validator requires unresolved role/coordinator/qualification/storage migration policy or if tests require active-browser data. Do not expand automatically to full phase 2/3.

**Tests/acceptance:** pure valid/invalid canonical ID-chain shapes; one led Zone/person/factory and multiple leaders/Zone; ZL Department alignment and same-Zone multi-Department membership; context shape cannot claim a privilege; old resolver grant/own-Zone/retained-read outputs identical under isolated fixtures. Run relevant TypeScript/lint and targeted unit checks after future code edits. Pure validation success is not permission to write data or evidence of tenant isolation. This batch requires no schema/membership decisions to be silently adopted.

### Tests and approvals before IQ onboarding

1. Approve and test live R06 context/read/storage/recovery adapters: refresh restores explicit person-bound context; every protected command/read/export/file validates current membership; revocation/stale context denies without fallback.
2. Approve and test R10 ordinary CM attachment and R09 first-FA bootstrap: separate reviewed Lakshman reuse, actual IQ CA explicit FA assignment; never temporary elevation. Verify actual browser uniqueness for new IQ Manoj without changing/resetting the directory.
3. Approve final Zone codes/Department lists/person allocations; IQF is confirmed. Prove independent IDs and unchanged ABC/Egmore/Anand and other memberships/history/maps.
4. Prove U02/U03/U10 assignment scope/cardinality and authorized actors; R08 prevents lifecycle changes with unfinished owned work, review obligations or unresolved dependencies and retains explicit reassignment history.
5. Resolve R01/R02/R03; test captured capacity, independent coordinator selection, Action-specific CA designation and no inherited CA verifier authority. Missing verifier permits authorized creation/draft but denies review submission; combined-role/historical creator/completer exclusions remain.
6. Implement only separately approved D10 batch: Audit-origin capability with general Actions false; one task per canonical source question; idempotent duplicate/conflict/tombstone handling, atomically durable source link/recovery; scoped evidence authorization before binary/write/read and after asynchronous context changes.
7. Preserve v3 Audit grants/own-Zone exceptions/direct FA signatures/scoring/completion; required finding linkage stays mandatory and Audit completion stays independent of task closure. Existing Action Type/status/rework/evidence/revisions stay unchanged.
8. Test staged explicit operational all-off state, independent IQ map and later explicit Audit-only activation with minimum authorized task/Audit report projections only. Missing tests/configuration/first FA/eligible verifier keeps relevant activation gate blocked, without rolling back approved draft semantics.
9. Complete targeted isolated unit/regression validation and one consolidated automated browser acceptance after all approved changes in the selected batch. Include retained-history/new-policy/legacy-read boundaries, source/evidence/quota/recovery and ABC baseline comparisons; no active user storage seeding/reset. No production readiness from frontend tests.

This reconciliation is documentation only. Do not begin even the bounded phase 2A batch until separately approved.
