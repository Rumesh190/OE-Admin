# OPS Access v4 Phase 2B — Implementation and Approval Gates

Date: 22 October 2026. **Documentation only; no implementation phase authorized.** The Phase 2B task produces this document, the [storage contract](OPS-ACCESS-V4-PHASE2B-STORAGE-CONTRACT.md) and the [recovery matrix](OPS-ACCESS-V4-PHASE2B-RECOVERY-MATRIX.md). All implementation batches below are future proposals.

## 1. Reconciled baseline and evidence

**Existing and verified:** v3 uses browser-local directory/configuration/administration payloads with a selected-key original-image recovery journal. Audit scoped authorization/grants/signatures and explicit FA assignment are implemented. Canonical Actions and source adapters exist, but creation assumes legacy ABC ownership/permissions. Assets are in separate shared IndexedDB. Entitlements, relationship metadata, tombstones, notification arrays and business-ID counters have separate writes. Existing cooperating record creation uses a Web Lock; general admin/Action lifecycle writes lack a shared revision/transaction boundary. See S01–S14 in the storage contract for exact keys/files/functions.

Phase 1A pure validators and Phase 2A readonly models/compatibility helpers are isolated, unconnected to production policy or persistence. Their reports' prior pass counts are **historical documentation claims**, not newly run test evidence. Current source/test definitions were inspected, not executed against browser data. Models are proposed in-memory schemas, not JSON decoders or storage formats.

**Proposed technical contract:** a separately versioned client-contained v4 sidecar managed by canonical administration coordination, explicit new-policy boundaries, entity+collection+graph revisions, coherent current-context authorization, exact raw read-set tokens for legacy keys, Prepared/Committed recovery and scoped receipts/intents. No new physical keys, lock names, schemas, backend endpoints or migrations were created.

**Unresolved:** C01–C09 below and remaining R-series policy details. **Deferred:** runtime context/commands/UI, actual IQ setup, D10, escalation/notification implementation and production server enforcement.

## 2. Conflicts and refinements recorded without changing approved master documents

| Finding | Evidence / required interpretation |
| --- | --- |
| Cross-client attachment grantor now settled | The Phase 2B brief explicitly requires platform SA alone. Existing R10 register still lists grantor as unresolved. Apply SA-only in this design; identity review/consent, inactive/dormant role handling, lifecycle and runtime enforcement remain unresolved. No attachment is authorized now |
| Operational SLA delivery gate is stricter than earlier optional app-open demo wording | Phase 2B requires reliable server-side delivery before operational SLA notifications activate. An in-browser expiry simulation may support tests but cannot meet this gate; do not silently adopt the earlier conditional app-open demonstration as operational acceptance |
| Existing record Web Lock is real | `lib/records/module-records.ts::withBusinessRecordCreation` already serializes cooperating browser creation. Do not say no locking exists; it does not cover admin updates/assets/entitlements or noncooperating writers |
| New-journal visibility cannot be assumed for old code | Current S05 reader/recovery handles only original-image array and a fixed four-key allowlist; Action/entitlement/relationship/tombstone readers bypass it. Separate v4 Prepared/Committed journal requires reader/writer compatibility floor and reviewed recovery routing before live use |
| Optional Phase 2A revisions do not define persisted concurrency | Mandatory persisted revisions, schema/policy IDs, extension round-trip, activation and receipts/intents need approved wrapper/decoder contract; no model edited during this task |
| Global canonical business IDs need a decision | Existing per-org high-water sequences coexist with ID-only APIs/routes/relationship refs. Explicit IQ organization input alone does not prevent Action/Audit ID collision; preserve all existing IDs and choose a reviewed global uniqueness or fully scoped-reference strategy before D10 |

These are source-grounded clarifications and latest-request precedence, not an unrecorded policy migration. The four existing master architecture documents and Phase 1A/2A files remain unchanged.

## 3. Technical approval register

Every row identifies a **proposal**, the exact outstanding approval, blocked batch and behavior preserved. Recommendations are not implementation authorization.

| Gate | Proposed safe contract | Approval required / owner | Blocks | Preserve / stop condition |
| --- | --- | --- | --- | --- |
| C01 Collection/envelope binding | Separate per-client versioned envelope under canonical admin coordinator; logical journal/receipts/events/intents; no duplicate directory/Action/Audit records | Engineering/data architecture approve physical key/partition/layout, ownership, retention, size budget and initializer scope | Pure schema utility shape must be reviewed; all storage integration | Keep current keys and unknown metadata; stop if fallback/reset/migration required |
| C02 Schema/policy/legacy reader floor | Explicit schema major/minor/required capabilities and new-v4 discriminator; mandatory row revisions; lossless extension behavior; missing/unsupported fail closed | Engineering/access approve pure decoder/version table, wrapper revision ownership, optional missing collections, old/new policy dispatch and round-trip tests | 2B-1 final utility contract; 2B-2 readers/writers; Phase 3/4 | No new fields required on v3 history; no auto Department/leader/reviewer migration; unknown versions never silently treated empty |
| C03 Concurrency and mixed writers | Cooperating Web Locks, global read-set/graph checks, strict lock order and no write fallback; all relevant readers/writers/recovery must honor barrier | Engineering approve capability floor, old-tab/restart handling, universal writer participation and conflict semantics | 2B-2 live wiring, 3, IQ/D10 activation | Stop if any supported writer can bypass new journal/lock or overwrite unknown newer bytes; browser-owner/uncooperative code not secured |
| C04 Journal/publication/recovery | Separate versioned Prepared/Committed journal; before/after byte images; marker commit point; rollback before, forward after; scoped idempotent receipts and recovery attribution; monotonic ID gaps | Engineering/recovery review approve target allowlist, checksums/serialization, progress/journal GC, quota budgeting, operator recovery routes and invariants | 2B-1 simulator spec; 2B-2 coordinated writes; D10 | Do not extend old recovery to arbitrary keys or repurpose its original-only array; no successful event without protected mutation |
| C05 Global IDs/source uniqueness | Prefer globally unique new business IDs with existing IDs/formats preserved via reviewed global reservation; alternative composite scoping requires all routes/ref consumers reviewed | Data/product architecture approve ID namespace/reservation and tombstone semantics, source-question reservation/repair and old deep-link compatibility | Multi-client business creation/Phase 6; relevant 2B-1 tests | Never reuse consumed/deleted IDs, infer by title or rename old records; reject collisions and broken required links |
| C06 Assets/references | Durable staging intent, scoped Blob availability before metadata, post-await auth check, reference-complete cleanup/quarantine; canonical evidence authors/history retained | Evidence/storage engineering approve manifest lifecycle, shared-asset ownership, reference index, cleanup/idempotency and IDB failure tests | Asset integration and D10 acceptance | No IDB/localStorage atomicity claim; incomplete reference coverage means retain, not delete |
| C07 Actual authority/context/dependencies | Revalidate current person/context/membership/FA/grants; explicit coordinator/qualification/Department rules; complete R08 graph; SA-only ordinary-CM attachment with dormant-role guard | Product/access owner resolves R01–R03/R07/R08 and remaining R10 identity/reactivation process; engineering approves context/auth read-set/recovery identity and target projection | Phase 3/4/5/6 runtime; not generic pure schema simulations | Role data/facts are not grants; preserve legacy paths/own-Zone rules; no creator/completer self-selection; no implicit reactivation of dormant roles on CM attach |
| C08 Committed intent/delivery | Durable scoped outbox intent + deduplicated app-inbox/explicit transport retry semantics; reliable server scheduler for operational calendar-hour SLA notifications | Product/engineering approve R04/R05 state/deadline/reset/delivery policy, minimal transport and backend program | Phase 7 operational activation; production messaging | No automatic escalation/reassignment or Client Admin/SA operational override; no implicit Notification Center build |
| C09 IQ configuration/activation | Independent IQ/Manufacturing, IQ Factory 1/Chennai/IQF, approved distinct CA; verified Lakshman CM→explicit IQ CA FA appointment; all-off stage then audited Audit-only+D10 activation | User approves final Zone codes, Departments/person allocations, identity reuse/runtime uniqueness, staged provisioning and explicit later activation; acceptance owner approves evidence | Phase 5 actual setup and Phase 6 activation | ABC/Egmore/Anand/subscriptions/history unchanged; no temporary CA FA or duplicate-person workaround; no records created here |

Pure storage contracts may be simulated without resolving all business qualifications, provided unresolved authority is represented as denial/explicit externally supplied fact, never an adopted default. Live domain operations remain blocked by the relevant C07 decisions.

## 4. Future implementation sequence

### Phase 2B-1 — isolated contract utilities

**Scope:** after separate approval of C01/C02/C04's pure portions, add standalone unknown-JSON envelope validation, lossless version/extension previews, pure expected-revision/idempotency comparison and in-memory transaction/recovery simulations. Model aborted/committed attempts, permanent sequence gaps and source uniqueness symbolically. No runtime keys, global browser APIs, session hooks, database migrations, actual timers or production imports.

**Dependencies:** concrete schema/policy/version compatibility table and journal state machine approved; actual authorization inputs remain explicit external facts. C03/C05/C06 unresolved cases can be simulated as conflicts/quarantine without claiming a live guarantee. R01–R03 not resolved by test input flags.

**Source areas:** isolated files adjacent to `features/five-s/administration/access-v4-models.ts`, `access-v4-compatibility.ts` and existing validators; new isolated test files and one later QA report. Exact filenames require collision search and a new authorized scope. Existing production policies/models/tests stay unchanged unless separately approved.

**Tests:** old/known/future/invalid schemas; no write on read; absent vs required-missing collection; unknown nested extension round-trip; canonical scope/policy mismatch; revision overflow/monotonic updates; stale graph vs per-entity revision; identical/different idempotency digest; every failure F01–F36 as pure applicable simulation; repeated crash/rollback/forward recovery; global ID/tombstone reservation; shared asset cleanup unknown → retain.

**Acceptance:** deterministic pure results, immutable frozen inputs, no invented IDs/membership/grants, complete simulated before/after consistency and explicit unsupported cases. Run TypeScript/changed-file lint/targeted tests later; no browser UAT. Schema simulation is not persistence/tenant security acceptance.

**Stop:** any need for real storage, mutable store import, source-data change, production wiring or unresolved authorization implementation. This task does not begin 2B-1.

### Phase 2B-2 — controlled storage and journal integration

**Scope:** only after C01–C04 approval, implement versioned readers/writers/journal adapters using injected isolated storage first, with the same canonical administration infrastructure. Test adapters and dormant domain planners may be developed before Phase 3, but no live public write entry point is enabled until actual actor/context/authority foundations and reader/writer compatibility floor pass. Do not let a generic storage API accept raw arbitrary patches from UI.

**Dependencies:** 2B-1 accepted, byte/size/version/lossless round-trip contract, universal lock order and two-journal ownership/recovery routing. Production bypasses stay blocked; old readers must not see staged after state as normal records. Controlled live integration needs a separately approved scope including legacy adapter changes; isolated Phase 2A authorization does not cover these edits.

**Source areas after authorization:** `lib/administration-storage.ts`, `features/five-s/administration/access-v3-state.ts`, `access-v3-store.ts`, directory store; `lib/organization-store.ts`; approved new envelope/journal adapters. S07/S12/S09/S10/S14 and S11 mutation paths only when they become approved transaction participants; do not scatter unrelated fixes.

**Tests:** injected failing storage at every journal/target/marker/recovery step; unknown raw values and null absence preserved; old S05 recovery unaffected; after-commit response-loss retry; no intent-state/other metadata writes until journal finalization; before/after consistency; stale raw global arrays; no notifications before commit; unregistered/older writer denies new-v4 activation. No active browser storage seeding/reset.

**Acceptance:** sidecar dispatch cannot change v3 defaults/history; new formats are strictly validated; all protected targets agree with terminal receipt or remain quarantined; no write integration exposed without Phase 3. Existing Phase 1/2, Action/Audit/relationship/ID/quota/deletion regression suites unchanged.

**Stop:** inability to establish cooperating writer/read floor, unsupported browser locks, field loss, unknown concurrent bytes, arbitrary-key recovery, quota budget failure or implicit runtime defaults. Real multi-user guarantees remain backend gates.

### Phase 3 — explicit active context, authority and attachment

**Scope:** actual actor and explicit person-bound Client/Factory context persisted on refresh with per-operation revalidation; scoped reads/counts/files/reports; SA-only reviewed ordinary CM attachment; entitlement staging enforcement; no implicit grant/ABC fallback. Technical recovery authority separate from factory business authority.

**Dependencies:** C02–C04 adapters, C07 finalized actor/qualification/dependency matrices and privacy/review procedures. C05 must be resolved before generating multi-client business IDs; C09 before actual IQ setup.

**Source areas after approval:** `lib/demo-session.ts`, `lib/current-user.ts`, `factory-authorization.ts`, `access-v3-store.ts`; `lib/module-entitlements.ts`, module gate/sidebar/subject boundary; canonical read/projection/relationship/evidence paths affected by scope. New v4 data must never fall into old broad legacy policies.

**Tests:** forged IDs, SA/CA without FA, active context stale on save/upload/Back/Forward/refresh; global metadata/role revocation under lock; explicit history reads only for currently authorized new-v4 actors, legacy read compatibility unchanged; foreign directory privacy, duplicate/inactive/dormant attachment; no roles/reactivation caused by CM-only operation; separate entitlement maps/stage denial.

**Acceptance/stop:** resolved actual authority and supported policy boundaries agree across UI/commands/reads; no private title/file leak. Stop if R01–R03/R07/R08/R10 still unresolved for a requested operation, old tab can bypass stage, or browser demo behavior is described as backend security.

### Phase 4 — canonical administration commands and UI

**Scope:** reviewed Department lifecycle, Champion/ZL/DL/DM assignment controls, CA Action-specific designation and independently authorized coordinator selection/replacement. Reuse canonical commands/UI, not duplicate stores. FA appoints ZL/Champion/DL; FA/eligible DL manages approved same-Zone members. Do not add account/grant powers to DL or Champion.

**Dependencies:** 2B-2 + Phase 3, C07 qualification and complete R08 index for enabled operations. No inferred new permission from role presence. All generic/legacy mutation bypasses relevant to new records must have an explicitly reviewed policy boundary.

**Source areas:** `features/five-s/administration/access-v3-page.tsx`, `access-v3-store.ts`, users/settings integration and approved new v4 collection/transaction modules. Existing `assignZoneLeader` name has legacy semantics; proposed namespaced contract is not permission to replace it blindly.

**Tests:** multi-leader/single-led-Zone, aligned multi-Department assignments, independent roles, all missing/foreign/inactive scopes, duplicate graph conflicts, pre/post revocation, R08 pending work/review/dependency guards, last-FA protection, actual assignment/event/revision consistency and denied zero-effects.

**Acceptance/stop:** UI matches canonical command outcome and error feedback; history/IDs preserved; stop missing eligible people/independent verifiers for protected transition, unfinished work, unreadable recovery or unapproved role powers. Draft task creation is not blocked merely for no verifier; review submission is.

### Phase 5 — staged IQ onboarding

**Scope:** only after C09 approval and authorized read-only runtime inventory, provision independent new client/stage/all-off map, distinct IQ CA, IQ factory/IQF and approved Zones/Departments/allocations. Use separately reviewed SA attachment for existing Lakshman then actual IQ CA explicit FA appointment. No temporary privilege/bootstrap workaround.

**Dependencies:** all stage-aware readers/writers/context/authority/command gates passed. Existing-person review, inactive/dormant role cases and runtime email/Employee ID uniqueness confirmed; no pending recovery. Administrative staged setup may occur under its approved partial-configuration scope; operational activation cannot.

**Source areas:** canonical client/CA/factory/FA commands, approved v4 Department/assignment/staging transaction modules, `lib/module-entitlements.ts` and platform administration UI. No creation in this documentation task.

**Tests/acceptance:** new canonical independent IDs without collisions, no ABC transfer/clone, explicit all-disabled map and no missing-map fallback; every provisioning failure returns coherent originals/absence; prior clients/leadership/maps/Audits/Actions/evidence unchanged. Remain staged if any approved configuration step is incomplete. Audit activation is Phase 6, never implicit after client creation.

**Stop:** unapproved Zone/Department/person allocation, duplicate runtime contact, unverified identity reuse, missing first FA, dormant role activation risk, live mixed bundle, broad map window or damaged recovery data.

### Phase 6 — Audit/D10 canonical transaction integration and activation

**Scope:** current scoped Audit behavior plus narrowly authorized Audit-origin canonical task creation/link/evidence/read/work/verification. Complete one-task-per-canonical-source and global ID constraints; current creator/owner/capacity/selected-verifier and original evidence histories retained. No new independent Audit review or Action status; Audit completion independent of task closure.

**Dependencies:** C01–C07/C09, R01–R03 owner/coordinator/verifier semantics and exact Action canonical schema adapter. C05 ID uniqueness and C06 asset reference coverage must pass before activation. Stage remains all-off pending full acceptance.

**Source areas:** `lib/actions/action-creation-access.ts`, `action-store.ts`, `action-source-access.ts`, `action-evidence-storage.ts`; `features/five-s/types/my-actions.ts`; shared linked creation and Action detail; `lib/five-s/audit-store.ts::linkAuditQuestionAction`, Audit evidence/auth; relationships, tombstone and ID reservation integration. Canonical service must support prepared mutations, not sequential existing create/notify/link calls disguised as a transaction.

**Tests:** source/owner/actor mismatch; duplicate question across keys/actors/tabs; tombstones/ID collisions; Action-written/link/event failed; Blob-written/metadata-failed; response lost after commit; selection replaced before submit; current executor revoked while dialog/upload open; no-verifier draft allowed/submission blocked; same-tenant narrow task projections with general Actions false; all legacy scoring/signature/own-Zone/review/Type/rework/closure cases unchanged.

**Acceptance:** required link real and durable before finding completion, no orphan/foreign visible task/assets, all source/Action/event/receipt outcomes agree, retained histories unchanged; one consolidated automated isolated browser acceptance after all approved implementation in the batch. Explicit later actual-SA Audit-only activation after accepted evidence, all unrelated module flags off.

**Stop:** any unmet tuple/global-ID/race/recovery/asset/qualification guarantee; no source-check relaxation, fabricated owner/verifier or implicit Actions entitlement. Frontend acceptance is not production tenant approval.

### Phase 7 — escalation/notification implementation, deferred operational activation

**Scope:** only approved manual DL→ZL→FA request lifecycle, one accountable recipient, acknowledgment/rejection/response/history, assigned-FA calendar-hour SLA config and committed delivery intents. No underlying Action reassignment or automatic progression; VM escalation remains separate.

**Dependencies:** C08/R04/R05 plus current authority/scope/assignment contracts. **Operational SLA activation requires reliable server-side scheduler/outbox/delivery first.** Therefore move the necessary separately approved production-delivery foundation ahead of Phase 7 activation, or defer operational Phase 7 until that portion of the production program exists. Pure simulations can precede it but do not fulfill business notification delivery. Do not quietly add a partial backend or expand Notification Center.

**Source areas after approval:** approved separate escalation request/history contract, canonical projections and notification transport; current `lib/notifications/notification-store.ts` is reference/demo implementation only. Existing VM source remains a compatibility constraint.

**Tests/acceptance:** exact selected recipient, retained reroutes/outcomes, explicit manual level changes, response SLA snapshot/deadline and dedup/resend, crash after commit/delivery, disabled users/foreign notification detail, missed scheduler/retry handling. Backend transport must prove delivery guarantees before activation; app-closed/browser restart scenario cannot be passed by an in-browser timer.

**Stop:** unresolved cancellation/resolution/clock/recipient permissions, no reliable server delivery, auto-escalation/reassignment or implied CA/SA operational intervention.

### Deferred other modules and full production enforcement

Department/Champion mutations in CI/Red Tag/VI/VM/Gemba and broad Dashboard/Reports require individual policy approval; IQ remains Audit-only. Production identity/context/database/files/events/transactions/backend migrations remain a separate approved program. Real constraints and transactional idempotency are essential for concurrent real users/devices. Do not assume a Supabase deployment, invent API routes or describe local demo selection as authentication.

## 5. Required future tests and acceptance evidence

Reuse unchanged source tests where applicable:

- Phase 1A/2A pure and compatibility suites: `tests/access-v4-validators.test.ts`, `access-v4-legacy-characterization.test.ts`, `access-v4-models.test.ts`, `access-v4-compatibility.test.ts`.
- Scoped v3 and history/recovery: `tests/access-v3-phase1.test.ts`, `access-v3-phase2.test.ts`; corresponding e2e suites later in consolidated acceptance.
- Actions/Audit: `tests/action-plan-creation.test.ts`, `action-store.characterization.test.ts`, `action-plan-execution-types.test.ts`, `action-start-undo.test.ts`, `audit-independent-action-closure.test.ts`, scoring/signature/quota suites.
- Relationships/IDs/deletion: `tests/relationships-phase4.characterization.test.ts`, `ux-relationship-write-failure.test.ts`, `module-record-ids-and-order.test.ts`, `admin-record-deletion.test.ts` and relevant browser suites later.

Add targeted simulations for every F01–F36 failure; do not claim current suites prove the proposed journal. Inject schema/capability errors, all per-write failures, repeated recovery crash, simultaneous stale writers, raw unknown fields, global ID/tuple collisions, scope revocation, mixed-reader floor, shared evidence/tombstones, outbox lost acknowledgment and staged activation. Check denied mutations have no unauthorized record/asset/link/event/notification side effects, with explicit permanent sequence-reservation exception only after a valid Prepared intent.

After separately approved code changes run targeted unit/regression suites, TypeScript, changed-file lint and appropriate build; preserve unrelated local work. Reserve one consolidated automated browser acceptance at the end of the approved integration batch using isolated browser storage, never reset active user's records. Compare original IDs, memberships/leadership/grants, author/signature bytes, scoring, source links, reviewer/submission/reassignment history, tombstone reservations and entitlement maps. Production requires independent server row/file/auth/concurrency tests and sign-off.

## 6. Current documentation validation and handoff

Only the three new Phase 2B Markdown documents were created. Task-start file hashes/status were compared against the final working tree; pre-existing tracked/untracked nonignored files remain byte-identical. No existing architecture, Phase 1A/2A model/helper/test, production module, storage key/payload, workflow, fixture, migration, role or entitlement was altered.

`git diff --check`, explicit new-file whitespace, relative/anchor links and cross-document contract checks passed. API signatures are documentation code blocks only; no new TypeScript source/imports were created. No unit, browser UAT, build or destructive tests ran; no active browser data was accessed. No IQ/client/factory/person/Department records, D10, session context, escalation/notification code or backend was created. No commit/push/merge/deploy.

**Smallest safe next batch:** after explicit separate approval, Phase 2B-1 pure envelope/version/revision/idempotency validation and recovery simulations with injected synthetic state only. C01/C02/C04 pure contracts require review; no real storage or live actor policy. Stop here; do not start that batch during this task.
