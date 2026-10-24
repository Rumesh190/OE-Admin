# OPS v4 — Accelerated Batch 1 implementation

Date: 22 October 2026. Status: safely implementable Batch 1 foundations integrated, with affected unsafe operations explicitly blocked. **Not fully verified**; final unit/regression/build/browser quality gate remains deferred until after Batch 3. This browser-local implementation is not production authorization or production readiness.

## 1. Implemented scope and source reconciliation

The Accelerated Batch 1 brief authorizes integration of the earlier Phase 2B/3/4 proposals, superseding their documentation-only implementation pauses for this scope. The master specification, gap analysis, decision register, implementation plan, Phase 2B storage/recovery/gates and Phase 1A/2A reports informed the implementation. Existing v3 commands, state, authorization, journal, organizational models, demo identities, subscriptions and Administration UI were inspected. Phase 1A validators and Phase 2A models/compatibility helpers are reused unchanged.

Implemented an additive versioned administration envelope, protected revision/read-set writes, recoverable journal phases, explicit identity-bound context, Department metadata/lifecycle validation, independent Champion/ZL/DL/DM assignments, reviewed platform identity attachment, new-client staging and Administration UI. There is no new business-record database, Action model, identity directory, route family or dependency.

### Files created

- `lib/administration-v4-storage.ts`: protected transaction coordinator, Web Lock and phased recovery.
- `features/five-s/administration/access-v4-state.ts`: versioned envelope, strict decoder and external-store subscription.
- `features/five-s/administration/access-v4-context.ts`: explicit platform/client/factory selection and current authority validation.
- `features/five-s/administration/access-v4-store.ts`: authorized commands, revisions, history and safe blockers.
- `features/five-s/administration/access-v4-panel.tsx`: scoped Administration controls, context and attachment dialogs.
- `components/ops/access-context-boundary.tsx`: context/identity remount and legacy operational isolation.
- `tests/access-v4-batch1.test.ts`: synthetic high-risk targeted tests.
- This report.

### Existing files modified

- `lib/administration-storage.ts`: retain v3 original-only journal reads; recognize v2 Prepared/Committed journal overlays.
- `features/five-s/administration/access-v3-store.ts`: stage newly created clients; expose navigation eligibility for explicit DL administration.
- `features/five-s/administration/access-v3-page.tsx`: mount the v4 panel within existing Administration, constrain legacy controls to selected context, and detect context/identity changes in existing mutation dialogs.
- `lib/organizations.ts`: additive optional new-client operational lifecycle field.
- `lib/module-entitlements.ts`: unknown/new clients default denied; staged clients remain denied even with configured flags; retain ABC/XYZ defaults.
- `components/navigation/sidebar-nav.tsx`: include eligible DLs in Administration navigation.
- `app/(app)/layout.tsx`: mount the access-context boundary.

## 2. Storage contract chosen for this batch

| Key | Shape/version and behavior |
| --- | --- |
| `ops-access-v4-administration-v1` (new) | Schema version 1, policy `ops-access-v4`, mandatory positive envelope revision once persisted; Departments, discriminated independent assignments and attributed lifecycle events. Every Department/assignment has a mandatory positive revision and explicit Client/Factory scope. Optional required capabilities are checked against supported capabilities. Unknown compatible fields survive updates. |
| `ops-active-access-context-v1` (new) | Version 1, actual person ID, unique selection ID and platform/client/factory discriminated context. No automatically selected client/factory. |
| `ops-access-v3-pending-transaction-v1` (existing) | Existing array journals remain readable by original-only semantics. New transactions use version 2, transaction ID, Prepared/Committed phase and allowlisted exact before/after images. V3 payload readers see coherent logical originals or committed results. |
| `ops-access-v3-administration-v1` (existing) | Version 1 unchanged. Reviewed identity attachment adds one ordinary client membership and an administration event; old membership/role rows remain unchanged. |
| Directory/configuration/subscriptions/Audits/Actions/assets | Existing keys and shapes retained; no automatic migration or fixture conversion. |

One shared administration envelope holds explicitly tenant-scoped additive collections. This deliberately uses a smaller global revision boundary instead of prematurely introducing physical per-client partitions and several independently writable collections. There are no copied Client, Factory, person, Audit or Action records in it. Assignment role discrimination keeps Champion, ZL, DL and DM independent. IDs use the existing prefix/UUID strategy; business record numbering is untouched.

Missing v4 storage means not initialized and performs no write. Unsupported schema/policy/required capability, malformed scope/revision/history or duplicate v4 identities throw while preserving stored bytes. Metadata updates spread existing records; no legacy leader or Department string is converted.

## 3. Context and authorization

- Platform, client-administration and factory contexts are distinct. Platform/client context never implies factory authority.
- Selection persists across refresh, is bound to the actual demo person, and is revalidated against canonical active identity, client, factory and memberships when used.
- Factory context requires active client membership plus explicit factory membership or FA assignment. CA alone and SA cannot select operational factory authority.
- Protected v4 commands compare captured context selection ID and scope, actual session, current role/memberships and expected envelope revision under the writer lock. Relevant raw storage values are compared immediately before the first protected write.
- Context snapshots observe session, identity, membership, configuration and journal storage dependencies. Context/identity changes remount descendants, clearing open dialogs, linked-title component state and evidence previews. V4 dialogs disappear on context changes; existing mutation dialogs reject changed identity/context on submission.
- New v4 operations have no ABC/first-factory fallback. Existing v3 ABC compatibility remains explicit: with no selected v4 context, existing workflows continue; selected foreign/platform/client contexts cannot fall through to legacy ABC operational screens.
- The operational compatibility boundary permits only the existing ABC/PLANT-EGM factory context. Full multi-client operational projections are deferred; this batch does not redirect old stores to another tenant.
- Existing functional Audit and Action policy/lifecycle code was not changed. New ZL/DL/Champion rows do not manufacture v3 roles, Zone allocations, Auditor grants or Action permissions.

These checks are demo/client-side controls. Existing browser owners, direct storage manipulation, uncooperative old bundles and cross-device access require the future backend and compatible-reader/writer rollout; they are not secured by a selected context.

## 4. Administration command coverage

| Command | Authority and result |
| --- | --- |
| `saveDepartment` create/update/activate | Actual assigned FA in exact factory context; canonical active parent chain, immutable Zone parent, required name/code, scoped active uniqueness, expected revision, attributable history. Inactive creation and later activation are supported. |
| Department deactivation | **Blocked** before writes: the repository lacks complete unfinished-obligation coverage. UI shows a disabled control and explicit explanation; status-change submission is also guarded. |
| `assignV4Role` Champion/ZL/DL | Actual assigned FA; active unambiguous Client/Factory membership for target; unchanged pure validators enforce canonical scope/cardinality. Champion is factory oversight only. |
| `assignV4Role` DM | FA or explicit eligible DL of exact active Department. DL can allocate existing same-Zone people only; cannot create users, appoint peers or alter memberships/grants. Unallocated people require FA review. |
| `revokeV4Role` | Authority, revision, active tuple and reason are checked, then **blocked** by incomplete unfinished-work coverage. No row/history is removed or silently reassigned. |
| `attachPersonToClient` | Actual canonical platform SA in platform context only; exact person confirmation, mandatory reason, active unique person/client, exact v3 raw-state expectation plus v4 revision. Ordinary membership only, journaled with events. Existing/inactive membership or any dormant target assignment requires review and blocks attachment. |
| `recoverV4Administration` | Actual active canonical platform SA; lock-protected technical recovery only, with no operational grant. |

Multiple people may hold ZL assignments for one Zone. New v4 leadership and Department roles obey one operational Zone per person/factory; multiple same-Zone Departments and separate role tuples are allowed. Existing legacy leadership/active allocations are inspected for conflicts without rewriting them. Existing multi-Zone legacy records remain untouched and cannot be silently normalized into new v4 assignments.

## 5. Administration UI coverage

The existing `/settings/administration` interface contains explicit context selection, Department creation/metadata/status forms, role-specific assignment forms, scoped eligible people, assignment status/actor/time and history. Factory Admin controls and scoped DL member controls call protected commands directly. Champion oversight exposes the factory's Department catalog and the person's own assignment without mutation controls; it creates no all-Zone membership or operational powers.

Platform context offers reviewed existing-person attachment and v4 recovery. Attachment confirms canonical person ID and captures a reason; only the platform view lists cross-client candidates. Ordinary FA/DL selectors are filtered to eligible factory/same-Zone people and commands repeat validation. No empty save/delete handlers or permissive component-state grants were added. Existing shadcn controls, dialogs, button semantics and validation feedback are reused. Runtime layout/keyboard behavior awaits the consolidated browser pass.

## 6. New-client staging and entitlements

`saveClientProfile` creates new clients with `operationalState: Staged` in the same canonical client write. No existing client is backfilled or migrated. Staged clients always return all operational capabilities false, including when a map has subsequently been configured. Missing maps for unknown/custom clients also return all false. ABC/XYZ legacy default behavior remains preserved. Existing subscription maps are not written during client creation.

No activation command is exposed in Batch 1. Later explicit configuration and approved activation are required; setting Audit does not enable general Actions or D10. This is an equivalent deny-by-default staging barrier rather than introducing an atomic all-off entitlement-map write alongside provisioning.

## 7. Recovery, revisions and concurrency limits

V4 cooperating writers require Web Locks (`ops-administration-writes-v4`); unsupported browsers cannot perform protected v4 writes. Envelope/record revisions and exact raw read-set comparisons prevent detected stale overwrites. The callback has no asynchronous gap between final authorization, validation and protected storage writes.

Prepared journal recovery restores exact originals/absence; Committed recovery finishes forward. Before recovery writes, every target must equal its recorded before or after image. Unexpected bytes quarantine the operation; nothing is repaired or discarded automatically. Failure to roll back retains the journal and blocks further writes. Failure after the commit marker reports **committed, cleanup pending**, preserving the business result. Subscribers run after successful transaction cleanup. No binary assets or external notifications are included in these Batch 1 commands.

**Limitations:** localStorage has no multi-key atomic transaction or compare-and-swap. Existing v3 synchronous commands check the shared pending journal but do not acquire the new asynchronous Web Lock. An uncooperative/mixed-version cross-tab writer can still race; raw comparisons and journals do not claim full isolation from such writers. Use compatible code and serialize legacy administration during browser-demo setup. Before real multi-client operational activation, coordinate all writers/readers, finish rollout/version-floor handling and use backend transactions for real concurrent users. No source/Action/evidence transaction is enabled here.

## 8. Verification actually executed

- `npx vitest run tests/access-v4-batch1.test.ts tests/access-v4-legacy-characterization.test.ts`: **30 tests passed** (19 new protected-administration tests and 11 unchanged v3 authority characterizations).
- New tests cover actual SA attachment, denied CA/FA attachment, duplicate/dormant membership safeguards, same-Zone constraints, scoped DL member authority, denied peer/user grants, Champion noninheritance, tenant/context mismatch, stale revision/context, inactive/missing membership, unsupported versions/unknown-field preservation, staged entitlements, rollback, failed rollback, committed cleanup recovery, foreign-byte quarantine, lock requirement and raw read-set conflict. Context persistence/identity invalidation is code-level with synthetic storage, not browser acceptance.
- `npx tsc --noEmit --incremental false`: passed at integration checkpoints. Incremental cache writes were disabled.
- Changed-file ESLint: passed. The context module was rechecked after its final dependency-snapshot refinement.
- No Playwright, browser walkthrough, production build, full regression suite or full-repository lint was run, following the accelerated testing policy. Tests stub browser storage and locks; they do not establish actual multi-tab Web Lock behavior or production safety.

## 9. Preservation and deferred work

Task-start Git status and SHA-256 file inventory were recorded in `/tmp/ops-batch1-status` and `/tmp/ops-batch1-before.json`. Existing local changes were preserved through focused additions/edits. Final comparison identifies only the seven existing files listed above plus eight new files including this report. Existing canonical validators/models/helpers, Audit/Action implementations, fixtures, evidence/signature/history code and architecture documents remain byte-identical to the task-start inventory.

No active browser was inspected or modified. No storage reset, migration script, runtime provisioning or subscription activation was executed. Synthetic tests create records only in isolated in-memory storage. This establishes absence of intentional runtime data migration; it does not certify unavailable browser-local ABC data.

### Remaining blockers / stabilization and Batch 2 dependencies

1. Complete the cross-module unfinished-obligation index before enabling Department deactivation or assignment revocation; do not replace the blocker with a partial Audit/Action scan.
2. Preserve explicit context checks in future operational reads/writes and finish scoped projections. Do not enable foreign-client operational screens through legacy ABC stores.
3. Coordinate legacy writers and enforce compatible-reader/writer rollout before relying on cross-tab isolation. Existing old journal recovery remains its separate original-only workflow; v2 journals use v4 recovery.
4. Finalize any still-unapproved Action owner/coordinator/verifier/escalation policies in their authorized later batch. No D10, Action review changes or SLA/escalation workflow was added.
5. Verify responsive layout, accessibility, navigation, hydration, multi-tab behavior and cached preview invalidation in the single consolidated browser acceptance after Batch 3; run the full quality gate then. Technical staging is intentionally not an operational activation facility.

**IQ was not created, attached or activated. No IQ factory, Zone, Department or person was created. No commit, push, merge or deploy was performed. Work stops at Batch 1.**
