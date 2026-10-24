# OPS v4 Cold Start Factory Onboarding

**Status: IMPLEMENTATION COMPLETE — UNTESTED**

## 1. Cold Start detection logic

The existing `/dashboard` route now evaluates factory readiness for Client Administrators in an active factory context. Readiness comes from canonical administration records rather than a completion flag:

- active factory memberships,
- active factory Zones,
- active v4 Departments or retained canonical legacy Zone departments,
- active Zone allocations and Department Member/Leader assignments,
- valid Zone leadership and Department leadership responsibilities.

The normal factory dashboard remains unchanged for a factory that satisfies all five readiness steps. Factory Administrators and operational users are not redirected into the Client Admin onboarding presentation.

## 2. Five setup steps and canonical commands

1. **Add Users** uses `saveFactoryUser` to create a new active profile as `Standard User`, without a Zone. Person selection, membership status, and role fields are intentionally omitted from this first step.
2. **Create Zones** uses `saveFactoryZone`. The command owns factory validation, duplicate prevention, code normalization, and canonical persistence.
3. **Create Departments** opens the existing `saveDepartment` form directly from the dashboard, scoped to the selected factory. The form asks only for the parent Zone and Department name. A normalized internal code is derived from the name and new Departments start Active; editing preserves the canonical code and lifecycle status.
4. **Assign Members** opens one factory-scoped dialog listing every added user. Each member row contains Zone, Zone role, optional Department, and Department role controls. Zone allocations use `saveFactoryUser`; new Department Member or Department Leader assignments use `assignV4Role`. Each row saves independently and existing Department assignments remain preserved under the current dependency-safe lifecycle rules.
5. **Assign Operational Responsibilities** uses the existing base-role mechanism for `Zone Leader` and `Zone Member`, and `assignV4Role` for `Zone Champion`, `Zone Leader`, `Department Leader`, and `Department Member` independent assignments.

Zone Champion remains independent from Factory Administrator authority. Existing eligibility, parent-scope, duplicate, cross-Zone, revision, and context checks remain in the canonical commands.

## 3. Factory login-limit enforcement

The dashboard reads `getFactorySeatUsage`, which counts unique active factory memberships. Client Administrators without a factory-user membership do not consume a seat. The Add User control is disabled when the configured maximum is reached or when no maximum exists, and `saveFactoryUser` independently enforces the same rule.

The disposable cold-start factory is configured for five active users.

## 4. Zone and Department creation

The Get Started dashboard opens the Zone and Department dialogs directly. Creating a Department does not expand the administration panel: the user selects a Zone in the current factory, enters the Department name, and saves. The header context selector remains available for switching factories, and the dialog is keyed to the selected factory. New records appear from the subscribed canonical stores and Departments are displayed under their parent Zone. Department code and status are not exposed as creation controls. No new lifecycle state or secondary organization store was added.

## 5. Membership and role assignment behavior

Zone allocations update through factory membership commands. Department membership is represented by the approved independent `Department Member`/`Department Leader` assignments because the canonical model has no separate Department-membership entity.

The dashboard no longer presents separate member chips, an Assign Zones button, or an additional Assign Department members link. The consolidated Assign Members dialog provides the complete mapping context in one view.

All writes revalidate the authenticated actor and selected factory context. Cross-client and cross-factory assignments remain rejected by the existing services.

## 6. Setup completion rules

Each step is shown as Not started, In progress, or Completed from current records.

- Users: at least one active factory membership.
- Zones: at least one active Zone.
- Departments: at least one active Department with an active parent Zone. Existing legacy factories may satisfy this with their retained canonical Zone department.
- Members: at least one valid active Zone allocation and, when v4 Departments exist, at least one valid active Department Member or Department Leader assignment.
- Responsibilities: every active Zone has a valid leader and every active v4 Department has a valid Department Leader. Zone Champion is supported but optional.

Completion does not require a fixed number of Zones, Departments, users, leaders, or champions. The normal dashboard appears only when every step is complete.

## 7. Transition to normal Dashboard

No onboarding record is deleted or recreated. As soon as the persisted structure satisfies readiness, the existing factory dashboard renders on `/dashboard`. The normal dashboard retains a **Factory configuration** link to the existing Administration area. If essential configuration later becomes incomplete, the same data-derived setup checklist appears again without changing operational data.

## 8. Existing-data preservation

ABC Manufacturing records, legacy Zone departments, memberships, assignments, operational records, entitlements, and history are not reset or migrated. The implementation adds no onboarding-complete storage key and does not call `localStorage.clear()`.

The native development demo initializer now includes **IQ Get Started Demo**, a disposable IQ factory with:

- maximum five active users,
- Actions, Audit, and Reports enabled,
- no factory memberships,
- no Zones,
- no Departments,
- no role assignments.

Existing browser data is not modified until the existing development-only native demo initialization action is run. Reinitialization remains idempotent and preserves an explicitly changed factory module record when one already exists.

## 9. Files changed

- `features/ops-dashboard/factory-onboarding.ts`
- `features/ops-dashboard/factory-onboarding-dashboard.tsx`
- `features/ops-dashboard/factory-member-assignments-dialog.tsx`
- `features/ops-dashboard/scoped-workspace.tsx`
- `features/five-s/administration/access-v3-page.tsx`
- `lib/demo/native-demo-data.ts`
- `docs/QA/OPS-V4-COLD-START-ONBOARDING.md`

## 10. Remaining blockers and deferred acceptance scenarios

No implementation blocker was found. Automated and browser acceptance remain deferred by instruction. The final consolidated cycle should verify:

1. a new Client Admin enters the empty five-seat factory and sees Get Started,
2. the sixth active factory user is rejected,
3. duplicate and cross-factory Zones, Departments, memberships, and roles are rejected,
4. progress updates after every persisted command and survives refresh,
5. completion transitions to the existing dashboard,
6. removing required active configuration restores the setup reminder without erasing data,
7. enabled/disabled sidebar modules and direct route guards remain aligned per factory,
8. ABC Manufacturing continues to open its configured dashboard with existing records intact.

No Vitest, Playwright, browser automation, TypeScript check, lint, build, or regression suite was run in this implementation batch.
