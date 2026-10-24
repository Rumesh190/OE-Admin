# OPS Admin-only record deletion — frontend phase 1

## Scope and inventory

The canonical entity stores remain authoritative. Most modules had no operational deletion command. Audit previously supported hard deletion of unlinked Draft/Scheduled records by an Admin or the assigned auditor. Its deletion policy and UI have been replaced by the requested authenticated Admin-only policy; existing Audit lifecycle/scoring/execution behavior remains unchanged.

| Record | Delete UI | Canonical active projection |
| --- | --- | --- |
| Audit | Existing desktop row-actions area and mobile card, using a compact More menu | `useFiveSAuditStore`, `getFiveSAudits`, `getFiveSAuditById` |
| Red Tag | Listing row/mobile card and detail header More menu | `useRedTags`, `getRedTags`, `getRedTag` |
| Gemba Walk | Listing row/mobile card and detail header More menu | `useGembaStore`, `getGembaState`, `getGembaWalk` |
| Gemba Observation | Observation listing row/mobile card and detail card More menu | Gemba observation projection and walk observation reader |
| Continuous Improvement | Listing row/mobile card, review queue, pipeline and detail header More menu | `useImprovements`, `getImprovements`, `getImprovementById` |
| Visual Improvement | Listing row/mobile card and detail header More menu | `useVisualImprovements`, `getVisualImprovements`, `getVisualImprovementById` |
| Visual Management Board | Board listing row/mobile card and detail More menu | VM runtime board projection and getters |
| Visual Management Meeting | Meeting listing and detail More menu | VM meeting projection and getters |
| Action | Listing row/mobile card and detail header More menu | Canonical `useActionStore`, `getActions`, `getActionById` |

No organization, user, role, plant, zone, module configuration or system-setting deletion was introduced. VM board deletion retires the operational board projection; it does not delete its configuration.

## Authorization

`lib/records/record-deletion.ts` resolves the actor with `getAuthenticatedDemoActor()` at the canonical command boundary. Caller-supplied roles are not accepted. Existing active directory membership, the Admin role, plant scope, any explicit source organization ID, and the module entitlement are required. Platform Super Admin identities are excluded; generic platform access does not grant customer operational deletion.

`record-tombstones.ts` persistence invokes that same registered policy, so a direct low-level commit also rejects unauthorized or unconfirmed deletion. The legacy `deleteFiveSAudit` API delegates to the canonical command and also rejects a caller ID that does not match the authenticated session. No non-Admin Audit hard-delete path remains.

These are browser-local frontend controls, not production authorization. Existing records generally infer the demo organization from their plant; explicit foreign organization metadata is rejected. Tombstones are isolated under the demo organization namespace. No backend, server endpoint, database or migration was added.

## Shared UI

`RecordDeletionMenu` renders a quiet More menu only when authorized. Delete opens a dialog containing record type, canonical ID, title and the count of existing linked Actions. The dialog explicitly explains retention of linked Actions. Cancel performs no mutation; Delete Record is destructive, disabled while committing, and failures remain visible. Keyboard and click events are contained so record-row navigation cannot intercept the menu.

## Source deletion and Action preservation

Deletion writes a lightweight tombstone at `ops-record-tombstones-v1:abc-manufacturing`. The original source object remains in its existing canonical collection as a historical archive and permanent ID reference. No source collection is cleared or reset. No Action is copied, replaced, modified or deleted when a source is retired.

Registration adapters read actual source IDs, titles, plant/organization metadata and explicit Action references from existing stores. The command unions these with canonical Action source references and persisted relationships, then counts only existing, non-deleted Actions. Tombstones retain identity/aliases, deletion actor/time and linked Action IDs. VM board metadata additionally retains the minimal membership/access information needed to keep existing meetings readable.

All source-owned Action fields—including IDs, owner, Action Type, status, due dates, evidence, submissions, review history and activity—remain unchanged. Gemba and Red Tag before-evidence resolvers can read their retained archives so source deletion does not lose the Action's original evidence. No photo or attachment cleanup runs.

Retained Actions display `Source deleted` with their existing source reference in Action Center and detail/report metadata. The central source route helper returns no destination. Action detail return links to deleted sources are suppressed. Deleted source titles are not newly exposed to users through relationship catalogs; tombstoned relationship placeholders expose only the already-referenced ID and an availability label.

## Direct Action deletion and dependencies

Only the selected Action is tombstoned. Its source object and existing source Action IDs remain unchanged. Those IDs now resolve to a deleted-reference placeholder rather than an active Action or a clickable missing target. Canonical Linked Records derives retained deletion edges when necessary and renders `Action deleted` without a link.

Missing required Actions remain unresolved: existing CI and VI completion checks see a missing Action rather than Completed, and Red Tag reconciliation/closure continues requiring every referenced Action. No workflow function is invoked by deletion; no source is automatically completed, closed, assigned or reopened. Existing independent Audit and VM meeting completion semantics remain unchanged.

Phase 1 introduces no restore or replacement-link workflow. A source whose required Action was explicitly deleted can remain blocked until its references are repaired through an applicable authorized workflow or a future repair feature. It is never silently treated as satisfied.

## Relationships, metrics and navigation

Existing source stores, identifiers and relationship records remain intact. Active store hooks/getters apply the tombstone projection, so existing dashboard/report/list metrics consume active records and retained Actions. Record IDs remain in raw canonical collections; the existing sequence high-water reservations are untouched, preventing reuse after deletion.

Deleting a Gemba Walk hides its owned observations from active aggregate views while retaining their underlying records and assets. Deleting an observation leaves its walk and unrelated observations intact. Deleting a VM board does not delete its meetings; existing board access metadata continues to govern their visibility. Deleting a VM meeting hides its owned topic/decision presentation while retaining the stored records, board and Actions.

The shared operational record boundary handles deleted record/deep-link/QR routes explicitly instead of resolving them to another record. Central relationship routing and record links do not navigate to tombstoned records. Active report libraries exclude deleted operational records and retain reports for surviving Actions.

## Historical reports and limitations

This frontend phase has no immutable report snapshots. A direct source-report route whose operational source was deleted shows an explicit deleted-record notice and explains that a historical snapshot is unavailable; no replacement totals or evidence are invented. Original source/report inputs remain in browser storage. Surviving Action reports retain their Action data and original source evidence, with deleted-source availability called out.

Browser-local persistence survives reload in the same origin/storage context and propagates storage-event changes. It is not a multi-user backend or cross-device synchronization. Browser storage remains editable by its owner and storage failures reject deletion without partially hiding the record. There is no purge, undelete or concurrent multi-user transaction system in this phase.

## Validation

Testing uses an isolated copy at `/private/tmp/ops-deletion-qa` without environment files, with the existing dependency installation and Chrome for Testing. The isolated dev command uses webpack to support the external dependency symlink. Repository configuration and existing development servers are preserved.

Added unit coverage exercises each source type, unconfirmed/unauthorized and low-level calls, inactive/session/organization/plant/entitlement boundaries, exact Action storage preservation, original before evidence, persistence failures, reload, actual numeric ID allocation, unresolved CI completion, VM meeting retention across subsequent creation, and legacy Red Flag references that resolve to actual Red Tags.

Added Chromium coverage exercises Admin/non-Admin UI, keyboard menu operation, confirmation content, Cancel, each source-module deletion, unchanged Action storage, Source deleted references, direct Action deletion, retained sources and reload behavior.

### Automated results — 21 October 2026

| Check | Result |
| --- | --- |
| `npm run lint` | Passed: 0 errors, 10 existing warnings (image elements and two unused test variables) |
| `npx tsc --noEmit` | Passed |
| `npx vitest run` | Passed: 131 files, 1,285 tests |
| `npm run build -- --webpack` | Passed in isolated production-build copy |
| `git diff --check` | Passed |
| Chromium deletion suite | 8 passed, including Audit keyboard menu activation |
| Chromium complete cross-module suite | 15 passed after final compatibility change |
| Chromium targeted cross-module rerun | 6 passed: four linked-record scope/missing-record cases and two Audit review cases |
| Chromium Action Type/execution regressions | 20 passed |
| Chromium P0 critical/authorization | 15 passed |
| Chromium Red Tag cross-zone regressions | 2 passed |

The broader first browser regression run passed 46 of 52 cases. Four failures identified an unnecessary change to the existing generic unavailable-record message; that original wording was restored. Two identified a brittle Audit test reading storage row zero after the canonical fixture loader prepended records. The test now selects its synthetic Audit by canonical ID and preserves both original status/link assertions. All six passed on rerun. The complete cross-module suite then passed all 15 cases after the final legacy-source compatibility check. Across deletion, cross-module, Action Type, P0 and Red Tag suites, all 60 distinct Chromium scenarios passed.

The 8 deletion and 6 targeted cross-module cases also passed together in a single final 14-case Chromium run. The build copy is `/private/tmp/ops-deletion-build-qa`; no environment files were copied. These checks do not constitute manual UAT approval.

### Listing-menu follow-up

All operational listings expose the shared Admin-only More → Delete menu. On mobile cards, deletion controls are siblings of the existing navigation controls, avoiding nested buttons/links. Listing deletions remain on the current route and preserve the current filters. The same canonical command, confirmation dialog and retained-Action behavior apply.

`e2e/admin-listing-deletion.spec.ts` covers all nine record types and the CI review queue at 375px and 1440px, keyboard activation, Cancel, in-place removal, unchanged Action storage for source deletion, and hidden non-Admin menus.

Listing follow-up results: 19 Chromium cases passed initially; the final Red Tag mobile layout and both CI review queue widths passed a three-case rerun (21 distinct listing scenarios overall). TypeScript passed; lint passed with 0 errors and the same 10 existing warnings; full Vitest passed all 1,285 tests across 131 files. `git diff --check` passed.

## Manual UAT

- [ ] As Admin, verify the quiet More/Delete menu on each listed record type.
- [ ] As Zone Leader, Member, Reviewer and platform Super Admin, verify no Delete access.
- [ ] Cancel a deletion and confirm records, Actions and evidence remain unchanged.
- [ ] Delete a source with multiple Actions; verify every Action, owner, status, due date, evidence and review package remains intact.
- [ ] Check deleted-source labels in Action Center, detail, reports and Linked Records; verify no source navigation remains.
- [ ] Delete one Action; verify its source remains unresolved and other Actions remain intact.
- [ ] Check Gemba evidence and VM historical meetings after parent deletion.
- [ ] Refresh lists, revisit legacy/QR/deep links and create a new record to verify persistence and ID reservation.
- [ ] Verify active metrics and report exports; acknowledge the historical source-report snapshot limitation.

No commit, push, merge or deployment is authorized or performed. Manual UAT approval remains pending.
