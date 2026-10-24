# OPS v4 Dynamic Switcher, Cold Start and Role Dashboards

**Status: IMPLEMENTATION COMPLETE — UNTESTED**

## Dynamic switcher implementation

The development-only account menu now builds its nested hierarchy from active canonical records. Metric Mind appears as the single Platform Super Admin. Active clients contain their active Client Administrators and active factories. Each factory contains a **View as Client Admin** option plus active authorized factory users grouped by their derived primary role.

Search matches client names, factory names, user names, primary roles and independent responsibilities. Search results render their parent client and factory, while the normal view uses expandable client and factory menus. The selected canonical person ID and exact client/factory target determine the checkmark.

The fixed persona manifest remains disposable seed metadata only. It is no longer the source for switcher options, identity validation, header role labels, Administration role routing or newly provisioned Client Administrators.

## Canonical identity sources

- Person identity and active state: `five-s-administration-users-v1` through the existing administration directory.
- Client Administrator authority: active canonical client memberships with `clientAdmin`.
- Factory access: active factory memberships and Factory Administrator assignments.
- Zone role: canonical factory membership and Zone allocation records.
- Independent responsibilities: active v4 Zone Champion, Zone Leader, Department Leader and Department Member assignments.
- Auditor responsibility: active Auditor grants.
- Client/factory hierarchy: active organization and factory configuration records.

New clients and their automatically provisioned Client Administrators now appear without updating the demo persona manifest. Newly created factories and factory users appear from their canonical stores after the existing store notifications.

## Identity and context selection

The existing profile-switch transaction stages the selected canonical person ID, recalculates authorized contexts for that identity, selects the requested client or factory by canonical ID, and rolls back all identity/context keys if validation fails. A new context selection ID forces the existing access boundary to remount scoped content, discarding open forms and previous identity UI state before navigation to `/dashboard`.

The header context selector continues to use the same access-context store. Profile and context selections therefore remain synchronized rather than maintaining separate scope state.

## Cold Start detection and setup

Cold Start readiness continues to be calculated from persisted canonical memberships, Zones, Departments, allocations and leadership assignments. Client Administrators entering an incomplete factory receive the Get Started view on `/dashboard`; configured factories keep their existing dashboard.

The five steps use existing commands:

1. Add factory users with `saveFactoryUser` and enforce the factory seat limit.
2. Create Zones with `saveFactoryZone`.
3. Create Departments with `saveDepartment` under the selected Zone.
4. Assign all factory users through the consolidated member dialog using Zone membership and Department assignment commands.
5. Complete Zone and Department leadership through canonical base roles and independent assignments.

No completion flag, onboarding route, duplicate directory or secondary role store was added.

## Seat-limit enforcement

Seat usage counts unique active factory memberships. Client Administrators do not consume seats unless they also have an active factory-user membership. The UI disables additions at capacity and `saveFactoryUser` independently rejects additions or reactivations beyond the Metric Mind configured limit.

## Administration and operational dashboards

The `/dashboard` route now separates canonical administration identities from operational identities:

- Metric Mind retains the platform dashboard.
- Client Administrators retain client/factory administration and Cold Start onboarding.
- Factory Administrators retain the factory overview and Administration access.
- Zone Champions, Zone Leaders, Zone Members, Department Leaders, Department Members and Standard Users receive a focused operational dashboard.

The operational dashboard shows the active factory, canonical role/responsibilities and Zone/Department scope, followed by **My Work** and **My Modules**. Work counts use readable factory-scoped v4 Actions, responsible-person ownership, explicit verifier eligibility and authorized Audits. Empty work is reported without fixture counts.

Dashboard module cards and sidebar items consume the same visible-module projection. Direct routes continue through the existing module and access-context boundaries. For this frontend demo MVP, all factory-enabled modules remain available in every authorized factory context; backend tenant enforcement will replace this browser-local compatibility behavior.

An active factory user may start and execute a demo Audit directly as themselves when Audit is enabled. Scheduling an Audit for another auditor remains limited to Factory Administration.

## Demo module creation

For the frontend demo, record creation is independent of the active factory user's operational role. Client Administrators, Factory Administrators and active factory members—including Zone Leaders, Department Leaders and Zone Members—can create records in every module enabled for the selected factory.

The shared creation rule is enforced at both the UI and browser-local command boundaries for Gemba, Red Tag, Continuous Improvement, Audit, Actions, Visual Improvement and Visual Management. Red Tags can be saved even when the creator is the Zone Leader or no separate reviewer is configured; immediate review submission still requires a different eligible Zone Leader. Visual Management members can start and operate a meeting on a visible active board, while board configuration and scheduling permissions remain unchanged.

Review, verification, configuration and administrative lifecycle permissions remain separate. Production role and tenant enforcement is intentionally deferred to the backend authorization layer.

## Existing-data preservation

No person, membership, factory, Zone, Department, assignment, entitlement or operational record was deleted or rewritten. XYZ Components and Kavery Hospital were not recreated. No global storage reset was added. Demo reset behavior remains limited to records already marked disposable.

## Changed files

- `components/navigation/user-menu.tsx`
- `components/navigation/sidebar-nav.tsx`
- `components/modules/module-gate.tsx`
- `components/ops/access-context-boundary.tsx`
- `components/ops/administration-subject-boundary.tsx`
- `features/five-s/administration/access-v3-page.tsx`
- `features/five-s/administration/access-v3-store.ts`
- `features/ops-dashboard/scoped-workspace.tsx`
- `features/ops-dashboard/operational-dashboard.tsx`
- `lib/current-user.ts`
- `lib/demo/canonical-profiles.ts`
- `lib/demo/switch-final-persona.ts`
- `lib/navigation/visible-module-access.ts`
- `lib/legacy-operational-write.ts`
- `lib/demo/demo-module-creation.ts`
- `lib/actions/action-creation-access.ts`
- `features/actions/action-center-page.tsx`
- `features/five-s/continuous-improvement/access.ts`
- `features/five-s/continuous-improvement/new-page.tsx`
- `features/five-s/continuous-improvement/owner.ts`
- `features/five-s/continuous-improvement/store.ts`
- `features/five-s/red-tag/access.ts`
- `features/five-s/red-tag/red-tag-module.tsx`
- `features/gemba/gemba-access.ts`
- `features/visual-improvement/visual-improvement-access.ts`
- `features/visual-improvement/visual-improvement-new-page.tsx`
- `features/visual-management/visual-management-access.ts`
- `docs/QA/OPS-V4-DYNAMIC-SWITCHER-COLD-START.md`

The previously implemented Cold Start files and forms remain part of the completed flow.

## Remaining blockers

- Gemba, Red Tag, Continuous Improvement, Visual Improvement and Visual Management still use shared browser-local demo stores. Factory entitlements apply; creation-role and full record-level tenant enforcement remain backend work.
- Existing active Department assignments cannot be replaced or revoked because the approved unfinished-work dependency index is incomplete. The consolidated member UI preserves those assignments and permits safe same-Zone base-role changes.
- This remains browser-local demo authentication and persistence, not production server authorization or multi-device synchronization.

## Deferred acceptance scenarios

1. Search and switch through every client, factory, Client Administrator and factory user.
2. Create a client and confirm its provisioned administrator appears immediately without a manifest entry.
3. Create or approve a factory and confirm it appears beneath its canonical client.
4. Add, deactivate and reassign factory users and confirm switcher options follow active authorization.
5. Switch the same canonical user between multiple authorized factories and verify exact factory context.
6. Confirm context switching remounts forms, sidebar, dashboard and module access.
7. Enter an incomplete factory as Client Admin, complete all five steps and verify transition to the normal dashboard.
8. Confirm seat limits reject the first user above capacity.
9. Verify operational users see My Work/My Modules without factory administration KPIs.
10. Verify Client Admin, Factory Admin and Metric Mind dashboards retain their approved administration views.
11. Verify direct disabled-module routes remain blocked and every enabled demo module opens from each authorized factory context.

No Vitest, Playwright, TypeScript check, lint, build, browser automation or regression suite was run in this implementation batch.
