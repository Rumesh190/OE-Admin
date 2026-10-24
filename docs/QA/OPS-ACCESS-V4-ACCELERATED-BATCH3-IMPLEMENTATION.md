# OPS Access v4 — Accelerated Batch 3 implementation

Date: 22 October 2026. Status: implemented within the supported contracts; IQ remains unactivated and consolidated acceptance is deferred.

## Scope and data safety

This batch adds tenant-scoped Audit execution and canonical Audit-origin corrective Actions. No application/browser data was provisioned, migrated, reset or activated. No client/person IDs, memberships, ownership, grants, subscriptions or historical business records were changed by this work. Tests use synthetic isolated storage and Blob fixtures. Existing local work was preserved; the file inventory below is relative to the pre-Batch-3 content-hash baseline, rather than the repository's already dirty Git baseline. No commit, push, merge or deployment was performed.

## Tenant-scoped Audit

Explicitly versioned Audit records carry organization/factory/Zone scope and a revision. Create, schedule, start, draft, evidence and completion paths require the actual session identity, selected context and expected revision where applicable. The selected factory must be active and Audit-entitled, with active Client membership and Factory membership or an explicit Factory Admin assignment. Staged clients remain operationally denied.

Existing v3 Audit execution/grant and own-Zone exclusions remain authoritative. For an independent client, a canonical active v4 Zone Leader allocation may qualify the person for an explicit Auditor grant; a role label alone never grants Audit execution. Client Admin and Super Admin identities do not inherit operational authority. Foreign module records are filtered by actual selected context, including source reads and task reverse links.

New question origins may select an existing active canonical Department belonging to the exact factory/Zone. An absent Department is preserved as absent. No Department is manufactured or inferred from a display label. New scoped storage loading does not initialize ABC fixture records into an independent client's operational write.

## D10 canonical Action creation

`createAuditQuestionCorrectiveAction` creates an actual canonical `MyAction` in `standalone-5s-actions`, with exact Audit ID/question ID, organization/factory/Zone/Department, source metadata, canonical owner, issue evidence and explicit recorded work capacity. It updates the exact question's Action link and Audit revision in the same journaled operation. The Action begins Assigned without an implicitly selected verifier; the owner explicitly chooses the existing Action type when starting.

Only a persisted noncompliant finding is eligible. Required finding evidence must already have durable scoped receipts. Owner options are exact active assignment records with valid canonical parents and membership; user-supplied names or role labels cannot authorize creation. The dialog uses this service, and an existing linked Action navigates to its canonical detail route. Audit completion validates the canonical source/question/scope link independently of whether corrective work has closed.

## Work capacity, verifier and coordinator

The capacity snapshot records the actual selected assignment and person at creation and is not upgraded when the person later gains another role. Current eligibility is rechecked on protected transitions.

| Recorded work capacity | Independent verifier | Independent coordinator | Implemented scope |
| --- | --- | --- | --- |
| Department Member | Active Department Leader of the originating Department | Explicit Factory Admin | Department-origin task |
| Department Leader | Active Zone Leader of the originating Zone | Explicit Factory Admin | Department-origin task |
| Zone Leader | Explicit Factory Admin of the factory | A different explicit Factory Admin | Department-origin task |
| Factory Admin | Qualified, Action-specific verifier | Client Admin | Blocked: approved qualification facts/contract unavailable |

Verifier and coordinator must differ from creator, owner and actual completers, and from each other. Selection stores exact authorization references and origin scope. Draft work can exist without selection. Submission and verification require an explicitly selected, currently eligible verifier and coordinator. A coordinator can replace a verifier with a mandatory reason; previous selection and replacement history remain recorded. A one-FA factory cannot satisfy the independent ZL-work arrangement. Generic updates cannot change scope, assignment snapshot or verifier facts, rewrite historical events, or bypass protected evidence publication.

## Canonical lifecycle and evidence

The new detail view delegates Start, Undo Start, draft updates, Submit, Rework and Close to the existing Action lifecycle functions through the protected v4 command wrapper. Existing statuses, resolution package validation, Action type, review history and submission revisions are retained. Resolution/progress uploads use the shared Blob store and canonical evidence fields. New versioned records do not fall back to historical Zone-Leader reviewer inference.

A unique scoped upload intent is durably recorded in the compatible v4 administration envelope before a Blob is stored. Publication requires a Stored receipt matching record, tenant, key and uploading identity. A Blob failure leaves a Prepared intent; a later metadata failure leaves a tracked orphan. Context/authority is checked again after asynchronous upload. Historical Blobs and evidence are never deleted by failure handling. No orphan cleanup/deletion command was added.

## Source transaction, concurrency and recovery

The protected D10 command takes the existing business-creation lock and shared administration Web Lock, reads current canonical stores, checks actor/context plus Audit/administration revisions, reserves a permanent ID using the existing global compatibility reservation namespace, and journals both Action and Audit before/after images. Failed reservation/commit can leave an intentional ID gap, never intentional ID reuse.

The shared v2 journal now permits these two canonical business keys. Prepared recovery restores before-images; Committed recovery forwards after-images. Unknown/conflicting recovery bytes remain blocked for review. Readers use the existing journal projection. A retry of a consistent exact source link returns the same Action; an inconsistent, duplicate or deleted link is blocked rather than overwritten. Concurrent protected source requests cannot create duplicate links. Action lifecycle writes use the shared lock and expected Action revision. Direct Audit mutations retain the existing synchronous API, add optimistic raw-payload checks and journal publication, and deny pending recovery. These are browser-local safeguards, not backend transactions or a guarantee against noncooperating old bundles writing concurrently.

Legacy Action persistence now rejects a pending journal/stale payload. Legacy evidence compaction operates on legacy rows and rebases against current storage so versioned rows are preserved. General automatic legacy compaction is bypassed for new scoped uploads.

## Narrow Audit-origin capability

A readable versioned Audit-linked task can open `/actions/[id]` or its existing `/5s/actions/[id]` alias when general Actions is disabled. Its authority derives from actual Audit task participation and scope, with the source relationship checked again. This exception grants neither the Action Center listing nor manual Action creation nor access to unrelated tasks. Owner work, verifier review and coordinator selection remain separate permissions. Source reverse navigation still passes Audit's own read policy.

## Activation readiness and blocked operations

The onboarding UI exposes a read-only projection of independent ownership, Client Admin/Factory Admin, Zones, auditor grants, implementation capabilities, actual task/verifier arrangements, recovery and explicit Audit-only entitlement mapping. Unsupported storage fails closed. Approved Department/roster evidence, consolidated acceptance and explicit business approval remain incomplete. Merely possessing records or supplying a boolean does not certify readiness. `executableActivation` is always false: this batch adds no activation operation and enables no IQ entitlement.

The following remain blocked or outside this batch:

- FA-work verifier designation/review until explicit approved qualification facts exist.
- Zone/factory-only origins without a canonical Department until the owner/verifier origin policy is approved.
- New v4 reassignment, due-date/priority editing and generic ownership/scope mutations; no legacy bypass is exposed.
- Department deactivation and role revocation through application commands until the full cross-module dependency index exists.
- Automatic orphan evidence deletion, automatic inconsistent-link repair and noncooperating legacy-bundle concurrency guarantees.
- Actual IQ roster/Department approval, provisioning and activation.

## Compatibility preservation

The v3 compatibility branch and historical reviewer behavior remain for unversioned records. Historical foreign v3 Audits are not silently relabeled v4. Existing ABC/XYZ data files, fixtures, prior tests and original canonical IDs remain unchanged. New scoped views retain existing route families and canonical store keys. These frontend controls are local/demo authorization behavior; they do not provide server-side tenant isolation, multi-user or cross-device synchronization.

## Targeted validation

- `npx vitest run tests/access-v4-batch3.test.ts tests/access-v4-legacy-characterization.test.ts tests/audit-independent-action-closure.test.ts tests/action-start-undo.test.ts --reporter=dot`: **61 tests passed across 4 files** (15 new Batch 3 tests).
- New tests exercise tenant/actor/context/revision rejection, explicit Auditor grant and own-Zone exclusions, exact canonical source/capacity, retry/idempotency, missing Department denial, independent Audit completion, narrow task access with Actions disabled, explicit verifier requirement, hierarchy/independence, current revoked eligibility and reasoned replacement history, two-FA separation, simultaneous requests, stale context, rollback/retry, tracked Blob/metadata failures, staged denial and generic mutation bypass rejection.
- Existing tests retain v3 characterization, independent Audit closure and Action Start/Undo behavior. The intentional quota-failure test emits its expected persistence warning.
- `npx tsc --noEmit --incremental false`: passed after integration.
- Changed-file ESLint: passed with no warnings/errors.

No full regression suite, production build, browser/Playwright run or consolidated acceptance was executed, as requested. UI runtime, hydration, focus behavior and real IndexedDB/storage failure behavior therefore remain unverified in a browser.

## Deferred final stabilization and acceptance

After explicit authorization, run consolidated regression and browser acceptance covering independent tenant navigation; refresh/deep links; source-to-task and task-to-source links; module/role/membership revocation during mounted forms and evidence uploads; own-Zone exclusions; explicit verifier replacement; two-FA arrangements; rework/resubmission history; Audit completion while linked work remains open; cross-tab stale/recovery scenarios; quota and IndexedDB failures; and unchanged ABC/XYZ/v3 workflows. Review deployment compatibility and require cooperating code versions before considering live client activation. Resolve approved origin/qualification contracts and onboarding decisions separately. Do not treat this report as activation or business acceptance.

## Exact Batch 3 file inventory

### Created

- `features/actions/audit-action-detail.tsx`
- `features/actions/audit-corrective-action-dialog.tsx`
- `features/five-s/administration/iq-audit-readiness.ts`
- `lib/actions/action-v4-assets.ts`
- `lib/actions/action-v4-policy.ts`
- `lib/actions/audit-corrective-actions.ts`
- `tests/access-v4-batch3.test.ts`
- `docs/QA/OPS-ACCESS-V4-ACCELERATED-BATCH3-IMPLEMENTATION.md` (this report)

### Modified

- `components/modules/module-gate.tsx`
- `components/ops/access-context-boundary.tsx`
- `components/ops/administration-subject-boundary.tsx`
- `features/five-s/action-detail-page.tsx`
- `features/five-s/administration/factory-authorization.ts`
- `features/five-s/administration/iq-onboarding-panel.tsx`
- `features/five-s/administration/iq-onboarding.ts`
- `features/five-s/audit-list-page.tsx`
- `features/five-s/components/FiveSAuditCreate.tsx`
- `features/five-s/components/FiveSAuditExecution.tsx`
- `features/five-s/types/five-s.ts`
- `features/five-s/types/my-actions.ts`
- `lib/actions/action-creation-access.ts`
- `lib/actions/action-store.ts`
- `lib/administration-v4-storage.ts`
- `lib/five-s/audit-authorization.ts`
- `lib/five-s/audit-evidence-storage.ts`
- `lib/five-s/audit-store.ts`
- `lib/module-entitlements.ts`
- `lib/records/module-records.ts`
