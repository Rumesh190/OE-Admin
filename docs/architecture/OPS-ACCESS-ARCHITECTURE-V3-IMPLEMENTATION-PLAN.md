# OPS Access Architecture v3 — implementation plan

Date: 21 October 2026. Status: proposed for review. **No phase is approved or implemented by this report.**

## 1. Executive summary

Implement the v3 hierarchy incrementally on the current organization, directory, module and Action architecture. Reuse the canonical Action store, creation dialog, source adapters and Linked Records. Preserve existing workflows, Action Type, evidence, review packages, historical IDs and browser-local data.

The highest-priority work is an explicit client/factory membership model and administration authority boundary. Module policies must then consume the same effective subject and scope. Merely renaming Admin to Factory Admin or Auditor to a checkbox would leave the actual conflicts intact.

The immediate implementation program covers UI visibility and authenticated frontend commands. Production authentication, server-side tenant/factory authorization and tamper-resistant logs are a separate release prerequisite. Browser storage does not become a security boundary when the frontend checks become consistent.

Read the companion [gap analysis](OPS-ACCESS-ARCHITECTURE-V3-GAP-ANALYSIS.md) for the current architecture map, full role/module matrix, evidence E01–E39, detailed requirement rows and test inventory T01–T15. The deck reviewed was `/Users/rumesh-9634/Downloads/MetricMind_Operational_Excellence_Access_Architecture_v3.pptx`, all nine slides. The report distinguishes slide requirements from the pasted brief's preservation constraints.

## 2. Target architecture and invariants

### Responsibility map

| Responsibility | Target authority | Existing implementation to extend |
| --- | --- | --- |
| Client lifecycle/platform entitlements | MetricMind Super Admin | `lib/organizations.ts`, `lib/module-entitlements.ts`, `features/super-admin/super-admin.tsx` |
| Factory/site creation and Factory Admin assignment | Client Admin, within own client | `lib/organization-store.ts`, existing settings page patterns and directory |
| Factory users, Zones, auditor grants and module configuration | Factory Admin / Zone Champion, within assigned factories | `features/five-s/administration/*`, `features/settings/*`, existing module configuration stores |
| Operational contributions | Zone Leader, Zone Member, Standard User according to matrix, plus scoped Factory Admin | Existing module access helpers and canonical source stores |
| Audit execution | Scoped FA authority or eligible Zone Leader's scoped auditor grant | Existing Audit store, scheduling/create/execution UI |
| Assignees and ownership | One directory, eligible memberships, independent reviewer policy | Shared Action creation and canonical Action store |
| Access history | Attributed administrative events, domain events retained | Extend current browser-local architecture deliberately, production immutable audit later |

### Minimum model direction

Keep `AdminUser.id` as the durable person reference. Add client memberships, factory memberships/base roles, Zone allocations by stable IDs, explicit Factory Admin assignments, auditor grants/revocations and administration events. Keep profile identity distinct from scoped authority. No parallel Action model or independent assignee directory.

A conceptual policy input is the current authenticated person, the canonical record's organization/plant/Zone IDs, active memberships, scoped grants and module entitlement. Caller role arrays, a factory selected in the UI, and caller-supplied user IDs do not grant authority. Existing command signatures can remain temporarily compatible by treating an actor ID as an expected identity and validating it against the current session.

Resolve the canonical target before checking permission. Evaluate permission again on commit, before ID allocation, storage writes, binary assets, notifications, relationship publication or lifecycle changes. Reject unknown/ambiguous factory/Zone IDs. Module visibility is the intersection of tenant entitlements and role/scope capability, not a way to change subscription access.

### Invariants throughout all phases

- Preserve user, source, Action and evidence IDs, history, source relationships and current persistence. No demo collection reset.
- Preserve workflow transitions and status vocabulary. Access-model phases do not invent new source or Action statuses.
- Retain Red Tag own-leadership-Zone exclusion and receiving Zone Leader evaluation, including combined admin/leader identities.
- Preserve Audit scoring/checklist snapshots, scheduling lifecycle, signatures and independent Action closure rules.
- Preserve CI proposal, approval/hold/rejection, implementation, evidence and linked-Action completion requirements.
- Preserve Immediate/Corrective selection at Start Action, cancellation, undo safeguards, review/rework and independent reviewer requirements.
- Retain deletion tombstones and deleted-source references. Source deletion never cascades Actions, and deleted required Actions never imply completion.
- A user/membership change does not rewrite historical names, duplicate identities or silently close/reassign work.
- Existing routes/deep links/QR references continue to resolve to the same entity or an explicit unavailable/deleted state.

## 3. Decisions required before dependent implementation

The complete decision descriptions are D01–D11 in the gap analysis. Approval must identify the affected requirement IDs and expected tests, not simply authorize a global role rename.

| Decision gate | Required by | Output needed |
| --- | --- | --- |
| D01/D02: client/site semantics, multi-factory/Zone membership, base roles and legacy mapping | Phase 1 | Approved model and per-existing-user mapping inventory; no automatic conversion of the combined seeded Admin/Auditor/ZL persona |
| D09/D11: platform support exceptions and entitlement versus factory settings | Phase 1 authority design, Phase 3 settings | Explicit platform read/write exceptions, client lifecycle owner and scope of factory settings |
| D04/D07: auditor grant/revoke and Audit scheduling/execution/own-Zone restriction | Phase 2 grants and Phase 3 Audit | Grant scope/expiry, independent auditor assignment, in-flight revocation handling and historical reviewer compatibility |
| D05: designated CI approval and FA delegation | Phase 3 CI | Delegation/assignment mechanism and rules for leader changes, legacy Reviewer cases and completion review |
| D06/D08: permitted Red Tag Zones and Gemba contribution scope | Phase 3 sources | Approved source-entry policy without weakening existing cross-Zone restrictions or granting universal walk management |
| D03/D10: deletion ownership and Action owner/reviewer eligibility | Phase 4 | Scoped deletion mapping and assignee/reviewer policy for every base role, including source-Zone versus factory scope |

Unresolved decisions block only dependent work. Do not infer approval from silence or elapsed time. This task stops after the reports and waits for review before any Phase 1 change.

## 4. Phase sequencing and complexity

Complexity is a relative engineering estimate from the inspected working tree, not a calendar commitment. High means multiple stores/policies/routes with historical compatibility. Very high means a shared model used across nearly all modules. Calendar estimates require the decisions above and agreement on backend scope.

| Phase | Scope | Complexity | Entry dependency | Completion gate |
| --- | --- | --- | --- | --- |
| P1 | Administration hierarchy and identity model | Very high | Report review, D01/D02 and platform boundaries | Approved compatible memberships and exclusive admin assignment |
| P2 | Factory/Zone policies and auditor grants | High | P1 model and D04 scope policy | Scoped current-actor policy, grant/revoke with no unrelated privilege |
| P3 | Module UI/command enforcement | Very high | P2, source-specific decisions | Every module passes positive/negative actor/scope matrix |
| P4 | Common Action Plan and deletion alignment | High | P2/P3 source scopes, D03/D10 | All eligible roles work through existing service without lifecycle regressions |
| P5 | Regression and acceptance | High | P1–P4 stable | Frontend acceptance evidence plus explicit production limitations and manual approval |

Use small reviewable increments inside each phase. Freeze its expected behavior and regression checks before proceeding. Do not combine backend migration, notification expansion, design-system work or route cleanup with this program.

## 5. Phase 1 — administration hierarchy and identity model

### Scope

1. Inventory current identities and actual Admin/Auditor/Reviewer/Viewer assignments, plant/Zone references, pending Actions/reviews and source ownership. This inventory must include existing local data during implementation, not just fixtures. Keep personal data out of shared reports.
2. Define tenant/client, physical plant/site, person and scoped membership relationships after D01/D02. Add IDs where current names are insufficient.
3. Add Client Admin and Factory Admin assignment authority without making either a factory Add User choice. Treat Zone Champion as the agreed FA concept, not an automatic synonym for Zone Leader.
4. Introduce the three allowed factory operational base-role choices. Factory Add User and role edits must reject Admin/Factory Admin/Client Admin/Auditor escalation even if injected directly into a payload or permissions array.
5. Add actual tenant/site lifecycle commands and screens using existing page/store patterns. Current Super Admin catalog counters are not provisioning. Define status effects before implementing tenant suspension.
6. Support assigning an existing person to another permitted factory/Zone without creating a second identity. Keep client privacy boundaries in person lookup.
7. Record actual actor, target scope and time for client/factory administration, Factory Admin assignment and user/role changes.

### Files/components likely to change

- `lib/organizations.ts`, `lib/organization-store.ts`, `lib/module-entitlements.ts`.
- `features/five-s/administration/types.ts`, `permissions.ts`, `store.ts`, `users-page.tsx`, `ownership.ts`.
- `lib/current-user.ts`, `lib/demo-session.ts` and relevant demo identity/session selection for testing real directory memberships.
- `features/super-admin/super-admin.tsx`, `components/super-admin/super-admin-guard.tsx`, existing `/super-admin/organizations/*` and organization settings pages.
- `features/settings/organization-settings-pages.tsx`, `settings-access.tsx`, navigation registration after searching existing route conventions.

A distinct Client Admin assignment screen is required behavior. Choose route/component placement after reviewing existing settings routes, rather than creating another administration route family in advance. Existing platform Users/Configuration tab labels are placeholders, not reusable completed features.

### Data-model implications and compatibility

Add organization relationships to plant configuration and memberships. Keep stable IDs, existing storage keys and approved compatibility reads. Factory memberships carry roles and active state; Zone allocations carry canonical Zone and plant IDs. Avoid a single global base role if roles may vary by factory. Preserve existing name fields as historical display snapshots.

A later implementation may need a versioned, reversible local-data compatibility transformation. Design and test it separately, with failure preservation and explicit legacy mapping. Do not replace collections, regenerate person IDs or derive grants from arbitrary old permission arrays. Existing combined-role personas need documented assignments. No transformation runs in this audit.

### Dependencies, risks and tests

Depends on D01/D02/D09/D11. Main risks: duplicate people, actor switch confusion, generic permission escalation, cross-client target updates, existing Admin lockout, membership replacement and partial writes across stores. Reuse the current authenticated actor resolver as the starting boundary. Add T01–T04/T14/T15, retaining active-user ownership transfer and duplicate email/employee ID checks. Test missing/corrupt persisted membership shapes and rollback when a coordinated write fails.

### Manual UAT and acceptance criteria

- Platform Super Admin creates/updates a client according to the approved lifecycle and cannot accidentally become that client's operational Admin.
- Client Admin creates a site only in their client and assigns/revokes FA there. Wrong-client assignment fails with no state/event changes.
- FA sees factory Add User for an assigned factory. ZL/ZM/SU do not. Only ZL/ZM/SU appear as base-role options, with the same allow-list enforced by commands.
- Factory Admin cannot assign Factory Admin or Client Admin through Add/Edit User or injected permissions.
- Assign one existing person to two factories/Zones. One user ID remains, and editing one membership preserves the others and existing Action owners/history.
- Factory manager metadata does not grant authority. Same-named Zones in another plant do not match by name.
- Every successful administrative change has current actor, scope and timestamp; failed/denied writes leave state unchanged.

P1 passes when the model, commands and these journeys work with preserved legacy records, and the product owner approves the legacy role mapping. Production multi-user login is not claimed.

## 6. Phase 2 — factory/Zone permissions and auditor authorization

### Scope

1. Define one effective frontend access resolver over current session, active person/client/factory memberships, Zone allocations and entitlements. Reuse current helpers as adapters while consumers transition.
2. Separate base operational roles, admin assignments and auditor grants. Factory Admin grants/revokes auditor authorization only for eligible Zone Leaders within assigned factory/Zone scope.
3. Add grant/revoke history and approved expiry/in-flight semantics. Recheck grants at mutation time, not only when opening a page/dialog.
4. Introduce ID-based scope helpers and explicit selected factory context, validating selection against membership. A client-side selected factory cannot grant membership.
5. Keep Audit scheduling authority distinct from execution authorization. Do not grant all Auditor preset powers to a grantee.
6. Preserve existing in-progress/completed Audit, source, Action owner/reviewer history and deactivation protections during grant changes.

### Likely files and data changes

Extend administration types/store/editor, `lib/demo-session.ts`, `lib/current-user.ts`, `lib/organization-store.ts` and `lib/five-s/configuration.ts`. Adapt Audit access consumers and settings helpers only as needed for policy integration. A small shared typed access helper may be warranted after searching existing policies; avoid introducing another role store or state-management dependency.

Grant record: subject user ID, organization ID, plant ID, Zone ID scope or explicit all-Zones-in-factory scope, status/effective timestamps, actual granting/revoking user and reason where approved. An all-factory grant must not be represented by ambiguous missing Zone data. Preserve grant history rather than deleting revoked records.

### Dependencies, complexity and risks

High complexity. Depends on P1 and D04/D07. Risks include revocation stranding active Audits, inadvertently granting settings/CI/manual Actions, cached authority surviving a grant change, granting a member Auditor as a hidden second base role, and name-based scope widening. Validate both grantor and target eligibility against canonical directory/membership on commit.

### Tests, UAT and acceptance

Use T01/T03/T05/T06/T14/T15. For each operation test unauthenticated, unknown, inactive, forged expected ID, wrong client, wrong factory, wrong Zone, inactive factory/Zone, disabled module and revoked grant. Include successful scoped ZL grants and negative ZM/SU grants.

UAT: FA grants a Zone Leader Audit authorization in one Zone, verifies execution there, denies elsewhere, revokes it and checks the approved in-flight behavior. Verify the user still has one profile and unchanged base role. Confirm that settings, user management, unrelated CI approval and unrelated Action creation/review do not appear merely because of the grant.

P2 passes when effective permissions are deterministic, scope is canonical, revocation is immediately rechecked, authority history is attributed, and the approved active-work compatibility rules pass.

## 7. Phase 3 — module access enforcement

### Scope by module

| Area | Change | Existing workflow to preserve |
| --- | --- | --- |
| Settings | FA-only scoped navigation, direct-page access and commands; retain approved platform exceptions | Tenant entitlements remain platform-owned, existing custom/standard Audit snapshots and VM configuration history remain intact |
| Red Tag | Add Standard User scoped raise/view, resolve multi-Zone leadership restrictions using canonical IDs, keep target leader validation | Own leadership-Zone prohibition, receiving leader evaluation, creator cannot evaluate own tag, disposition/linked Actions |
| Gemba | Permit scoped observation contribution for all four target categories, separately authorize walk schedule/start/manage | Existing walks, evidence/assets, horizontal deployment, source prefills and cross-module links |
| CI | Allow FA/ZL/ZM initiation, deny SU; enforce designated Zone Leader or explicitly assigned/authorized FA approval | Draft/submission, hold/reject remarks, implementation team, evidence, completion review and unresolved Actions |
| 5S Audit | FA scheduling, approved auditor assignment, scoped grant on each execution write; close gaps in create/scheduled edit/start/draft paths | Cross-Zone rule pending D07, schedule timing, immutable checklist/scoring snapshots, signatures, question Action links and independent closure |
| Visual Management | Scoped view for every role; update only FA/ZL/ZM plus approved board scope, SU never update via owner/member shortcut | Board/meeting snapshots, attendance/KPIs, linked Actions and surviving historical meetings |
| Read/aggregate surfaces | Apply effective scope to lists, details, source catalogs, dashboard, reports, exports and evidence | Existing All-tab behavior, navigation/deep links, scoped Linked Records and deleted-source notices |

### Likely files/components

- `features/five-s/red-tag/access.ts`, `store.ts`, module pages/nav and Gemba-to-Red-Tag creation.
- `features/gemba/gemba-access.ts`, `gemba-store.ts`, create/detail/observation components and Gemba-to-CI entry points.
- `features/five-s/continuous-improvement/access.ts`, `store.ts`, form/detail/review pages.
- `lib/five-s/audit-store.ts`, `features/five-s/audit-list-page.tsx`, `features/five-s/components/FiveSAuditCreate.tsx`, `FiveSAuditExecution.tsx`, scheduled/review/report views.
- `features/visual-management/visual-management-access.ts`, runtime/configuration/scheduling/KPI stores, board/meeting pages and settings UI.
- `features/settings/settings-access.tsx`, `audit-configuration-permissions.ts`, organization and Action configuration pages, standard/custom questions and scoring stores.
- `lib/actions/action-configuration-store.ts`, `lib/organization-store.ts`: currently selected raw write commands lack session authorization and need command enforcement, not just navigation changes.
- `components/modules/module-gate.tsx`, module navs, sidebar and central module registry only where policy integration requires it.
- Existing dashboard/reports data consumers and `lib/relationships/*` for scope consistency. Include Visual Improvement consumers even though the deck does not supply a new VI role matrix. Preserve their policy until an explicit change is approved.

### Model implications, dependencies and risks

Consume P1/P2 IDs and grants, retaining legacy name snapshots through approved adapters. Do not add workflow states. If CI approval delegation requires new metadata, add only assigned reviewer/delegation identity/scope/history, preserving previous decisions. If Gemba contribution needs a different entry point, use the approved D08 decision rather than inventing a parallel observation system.

Very high complexity. Depends on P2 and D05–D09/D11. Important risks are granting all walk authority to observation contributors, removing own-Zone restrictions from combined roles, confusing creator/assignee/approver, and locking out historical reviews when replacing Auditor/Reviewer presets. Audit creation/draft and report reads deserve separate tests from completion.

### Tests, UAT and acceptance

Use T01/T05–T09/T11/T13/T15. Cover all base roles at UI, direct route and canonical command layers, with identical names across different plants/clients. Assert failure has no entity, asset, ID allocation, relationship, history or count side effects. Keep lifecycle assertions separate from access assertions.

Manual UAT:

- SU raises permitted Red Tags/Gemba observations, cannot create CI, and only views VM. Assign SU as board owner/member in a test fixture and verify VM writes still fail.
- ZL raises a Red Tag outside all their leadership Zones, target leader evaluates, and every own leadership Zone remains denied, including FA/ZL combination and aliases.
- ZL/ZM initiate CI, designated ZL approves with required comments, unassigned FA/Reviewer cannot approve, assigned FA can.
- FA schedules an Audit, designated authorized ZL executes only in approved scope. ZM/SU cannot start/edit/draft/complete by bypassing UI. Revocation follows D04.
- All relevant settings controls disappear for operational users and their direct commands fail. Scope-limited FA cannot edit another factory configuration.
- Unauthorized records/titles/evidence are absent from lists, reports, exports and Linked Records. All-tab refresh/sidebar behavior still works.

P3 passes when UI and command outcomes match the approved matrix across every listed module, negative scope cases preserve data, and existing workflows pass unchanged except explicitly approved authorization expectations.

## 8. Phase 4 — Common Action Plan alignment

### Scope

Keep the canonical `MyAction`, Action Center and shared linked creation. Replace scattered assignee selection/scope shortcuts with one eligibility policy used by source dialogs, manual creation where already allowed, assignment/reassignment and execution. Every target base role can be an eligible owner without automatically receiving source creation, manual Action creation, CI approval or VM update.

Apply the same current-session/scope check to due-date/priority edits, reassignment, content/evidence writes, submit/review/rework/close and generic updates. Preserve dedicated lifecycle commands and whitelists. Adapt existing source access adapters, not each source's Action model.

After D03 approval, map operational deletion authority explicitly to scoped FA if chosen. Preserve the same tombstones, archive/reference metadata, in-place listing behavior, confirmation and Action retention. Do not infer Client Admin or platform deletion rights. No deletion change proceeds without the recorded business decision.

### Likely files and model implications

`features/actions/create-linked-action-dialog.tsx`, `features/actions/action-center-data.ts`, `action-center-page.tsx`, `lib/actions/action-creation-access.ts`, `action-source-access.ts`, `action-store.ts`, `action-config.ts`, `lib/five-s/configuration.ts`, source registration adapters and `features/five-s/action-detail-page.tsx`. Also `lib/relationships/canonical-records.ts`, `use-canonical-linked-records.ts`, `route-resolver.ts`, `lib/records/record-deletion.ts` and affected menus if approved.

Add explicit client/plant/Zone identity to new records where needed, with approved legacy resolution. Preserve existing `sourceModule`, `sourceId`, child source IDs, owner/reviewer IDs, display snapshots, priority, dates/overrides, Action Type, evidence storage keys, submission revisions and histories. Do not change existing Action IDs or duplicate Actions to populate scoped views. Preserve deleted-record ID reservations.

### Dependencies, complexity and risks

High complexity. Depends on P2/P3 source policies, D03/D10, and approved historical access treatment. Risks include an owner selectable in UI but unable to execute, self-review, granting everyone manual creation, losing access to pending review packages, matching same-named users/Zones, and source completion bypass when a required Action is deleted. Keep failed-creation rollback and source-link publication checks.

### Tests, UAT and acceptance

Use T01/T03/T08/T10/T12/T15. Existing Immediate/Corrective tests must continue to reject creation-time Type injection and preserve start-dialog quota/failure/cancel/undo behavior. Add each target role as an owner across permitted source modules, independent reviewer selection, wrong-factory owners and former-owner write denial after reassignment.

UAT: create a linked Action from each permitted source, assign an eligible FA/ZL/ZM/SU, start with each Action Type, save evidence, submit, review, return for rework and close. Check source/reverse links and authorized Action Center tabs. Change membership/owner while work is open and follow approved transfer policy without altering history. Delete a source and verify every Action remains; delete one required Action and verify its source stays unresolved.

P4 passes when UI, creation, reassignment and work/review commands use compatible eligibility, historical records remain understandable, no source is falsely completed, and canonical model/store/Action Type behavior remains intact.

## 9. Phase 5 — full regression and acceptance

### Scope and likely changes

Expand existing tests and document results/UAT. No new product model is expected. Likely changes are `tests/*`, `e2e/*`, narrowly scoped fixtures/helpers and QA documentation. Keep the baseline suites in gap-analysis T01–T15. Do not remove old regression assertions simply because a role model changed.

Tests explicitly encoding old authorization need controlled revision: generic Admin creation in administration tests, ZL CI creation denial without `ci.create`, Auditor scheduling/execution and platform configuration exceptions. Change only the approved policy expectation, retaining lifecycle, data-integrity, actor/spoofing and historical assertions. Never make an old negative test pass by removing its scope checks.

### Automated acceptance

1. Run the repository's actual validation scripts: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, and relevant `npx playwright test` suites. Use isolated output/runtime copies when needed to preserve existing local development servers and work.
2. Execute role/client/factory/Zone combinations at the UI and command layers, including refresh, Back/Forward, direct detail/QR/report routes, inactive users, revoked membership, disabled modules and stale open dialogs.
3. Exercise 375px/1440px at minimum and existing P0 responsive sizes. Inspect console/hydration/Base UI warnings and keyboard behavior.
4. Compare retained owners, source links, evidence IDs/bytes/storage keys, dates, histories, deleted-reference metadata and ID allocation before/after access changes and reload.
5. Verify dashboard/Action Center/report totals use the authorized canonical rows and that no hidden foreign record title or file leaks through relationships or export.
6. Treat future server-side cross-tenant API/database/file authorization tests as a **separate production gate**. Passing frontend tests does not meet it.

### Final manual UAT checklist

| Scenario | Expected result |
| --- | --- |
| Platform creates client; ordinary user opens platform route/command | Platform authority only, denied ordinary mutations, no unintended operational rights |
| Client Admin creates factory and assigns FA | Own client only; cannot assign into another client |
| FA adds user | Only ZL/ZM/SU options; forbidden elevated payload rejected |
| One user in multiple factories/Zones | One identity, independent allocations, no overwritten owner/history |
| FA edits allocations/status | Correct scope, open-work transfer protection, attributable event, no cross-client side effects |
| Grant/revoke auditor for ZL | Scoped execution only, no settings/user-management/CI-review privilege added, preserved historical signatures |
| Settings via navigation/deep link/direct command | FA assigned scope only, with explicitly approved support exception |
| Red Tag own-Zone/cross-Zone | Own leadership Zones denied, permitted other Zone allowed, receiving leader evaluates |
| Gemba observation versus walk management | All permitted categories contribute observations; management remains separately authorized |
| CI initiate/review/complete | Target base-role matrix, designated approver/authorized FA only, no source dependency bypass |
| Audit schedule/start/draft/signature/complete | Separate scheduling/execution authority, grants and existing workflow conditions enforced |
| VM view/update with SU owner/member fixture | SU reads but cannot mutate, other roles update only within approved board scope |
| Shared Actions across all eligible roles | One directory, permitted sources, independent reviewer, Type/lifecycle preserved |
| User reassignment/deactivation/revocation | Former actor cannot write, history preserved, outstanding work handled explicitly |
| Source/Action deletion | Confirmed approved admin scope, no cascade, deleted references non-clickable, required source unresolved |
| Same-named factories/Zones and foreign IDs | No cross-client/factory records, counts, linked titles, exports or evidence |
| Reload/failure/legacy browser data | No reset, no ID reuse, clear denied/unavailable states, no partial write or unauthorized event |

P5 passes with all approved requirement IDs linked to evidence, documented remaining production gaps, no unresolved critical frontend regressions, and signed manual acceptance by product/business owners. Frontend approval does not authorize deployment or backend migration.

## 10. Risks, unresolved policy and production follow-on

- Administration hierarchy is a data-model change. A role label rename cannot safely carry multi-factory authority or scoped audit grants.
- Exact factory/Zone IDs must replace authorization by display name without rewriting historical records. Existing name fallbacks need an approved, unambiguous compatibility path.
- `primaryZone` and the fixed demo organization's assumptions are widespread. Audit consumers before switching policy; a chosen factory is not authenticated membership.
- Grant/role revocation affects future mutations and pending review eligibility. It must preserve previous decisions and explicitly handle outstanding assignments.
- Tenant catalog, operational stores and organization-specific configuration currently have different scopes. A single renamed storage key does not establish tenant isolation.
- Current platform exceptions, Reviewer behavior, Admin-only Delete and Audit own-Zone exclusion require explicit decisions. No phase silently removes them.
- Browser-local administration events support demos and regression inspection but remain editable. Production needs authenticated server actors, persistent membership, server-enforced row/file scope, transactional writes and durable audit logs, with a separately agreed identity and backend design.

## 11. Audit validation and handoff

The audit inspected the working tree and all nine presentation slides. Existing `npx vitest run` passed **131 files / 1,285 tests** without test modifications. No browser, build, lint or TypeScript verification was rerun for these documentation-only deliverables. Tests support the current baseline, not unimplemented v3 acceptance.

Only this plan and the companion gap analysis were created. No production code, test, data, workflow, permission, dependency or route change was made. Existing local work was preserved. No commit, push, merge or deployment occurred.

**Stop here for review. Phase 1 implementation requires a subsequent instruction and the applicable business decisions.**
