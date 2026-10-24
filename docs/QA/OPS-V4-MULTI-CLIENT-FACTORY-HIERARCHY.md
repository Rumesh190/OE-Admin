# OPS v4 — Multi-Client and Multi-Factory MVP

**Status:** IMPLEMENTATION COMPLETE — UNTESTED

This batch implements the simplified Metric Mind → Client → Factory → Zone/Department/User hierarchy in the existing browser-local OPS architecture. The addendum governs the final presentation and scope.

## 1. Platform and four-client hierarchy

The native demo initializer now provides four independent disposable demonstration clients:

- IQ
- Mitsubishi
- Hyundai
- Kavery Hospital

Each client has its own canonical organization ID, Client Administrator identity, membership, and module-entitlement entry. Existing unmarked organizations, including ABC Manufacturing, are preserved.

Metric Mind remains the single Platform Super Admin identity, `USR-OPS-SUPER-ADMIN`.

The Clients page now shows the essential MVP columns: Client, Client Admin, Factories, Enabled Modules, Status, and Manage. Client detail uses only Overview, Factories, and Modules.

## 2. Client Admin permissions

A Client Administrator is restricted to their own client and its factories. Canonical administration commands now explicitly permit a Client Administrator to:

- View and edit existing factory details.
- Add and manage factory users.
- Create and edit Zones.
- Create and edit Departments.
- Assign Zone Champion, Zone Leader, Department Leader, and Department Member responsibilities through the existing v4 assignment service.
- Appoint and manage Factory Administrators.
- Manage Auditor authorizations through existing eligibility rules.

Client Administrator authority remains separate from operational roles and does not permit editing Metric Mind module entitlements.

## 3. Factory creation request and approval

Client Administrators can no longer create an active factory directly.

The existing administration state now stores minimal factory requests with:

- Factory name
- Optional description
- Pending, Approved, or Rejected status
- Requestor and decision identity
- Request and decision timestamps
- Created factory reference after approval

A Client Administrator submits a request from the Factories section. Metric Mind reviews it in the same client's Factories section and selects Approve or Reject.

Approval creates one active factory through the canonical organization configuration transaction and links it to the requesting client. Rejection creates no factory. A decided request cannot be processed again, and duplicate active or pending factory names are rejected.

Metric Mind can also directly add a factory from the same Factories section.

## 4. IQ's three factories

The disposable IQ dataset now contains:

| Factory | Canonical ID | Initial structure |
|---|---|---|
| BYD | `PLANT-cd757fcd-3d35-4348-aad0-015d603110e0` | Existing IQ demo Zones, Departments, roles, Audits, and Actions are retained under the same factory identity. |
| Mahindra | `PLANT-IQ-MAHINDRA` | Operations Zone and Operations Department. |
| Boat | `PLANT-IQ-BOAT` | Operations Zone and Operations Department. |

The prior disposable IQ Demo Factory identity is reused as BYD so its existing operational references remain valid. Its sample Audit and Action records keep their IDs and are relabeled with BYD as the factory display name.

The existing IQ Factory Admin receives explicit assignments for all three factories. No assignment is inferred from a display name.

## 5. Client-specific module entitlements

- All four demo clients receive separate entries in the canonical organization entitlement store.
- Metric Mind changes entitlements through the existing Modules page and canonical save service.
- Disabled modules disappear from the client's sidebar and ordinary module navigation.
- Direct URLs return a concise Access Unavailable state.
- Command authorization continues to read current canonical entitlements.
- Disabling a module does not remove its records.
- Legacy modules without safe tenant-aware storage remain unavailable even when enabled, preventing ABC Manufacturing data from appearing in another client.

No persona-specific or sidebar-specific entitlement flags were added.

## 6. Native profile switching

The existing account-menu switcher now contains eleven personas:

- Metric Mind
- IQ Manoj
- Mitsubishi Client Admin
- Hyundai Client Admin
- Kavery Hospital Client Admin
- IQ Factory Admin
- IQ Zone Champion
- IQ Zone Leader
- IQ Department Leader
- IQ Department Member
- IQ Standard User

Each Client Admin persona carries its own organization reference. Switching selects that person's client context and replaces the prior persona context. Operational IQ personas continue to select BYD as their explicit factory context. The existing development-only identity persistence remains in use.

## 7. Client, Factory, Zone, and Department isolation

- Client listings and administration commands filter by canonical organization ID.
- Factory access validates both factory ID and owning organization ID.
- Client Admin factory contexts are limited to factories owned by that Client Admin's client.
- Factory Admin and operational contexts continue to require explicit memberships or assignments.
- Zones and Departments validate their canonical parent factory chain.
- Role assignments retain organization, factory, Zone, and Department scope.
- Mitsubishi, Hyundai, and Kavery Hospital begin with no factories and cannot access IQ's factories.
- Tenantless legacy module routes remain blocked in non-ABC contexts.

This is browser-local MVP authorization. It is not represented as production server authorization.

## 8. Administration UI

Metric Mind client detail contains:

1. Overview
2. Factories
3. Modules

Client Administration contains:

1. Factories
2. Users & Roles
3. Module Access

The Factories section includes existing factories, the Request Factory action, request statuses, factory editing, and Factory Admin assignment. Users & Roles groups factory users, Zones, Departments, independent role assignments, and Auditor authorization in the existing Administration area. Module Access is read-only for Client Administrators.

Current client and factory selectors use human-readable labels. Technical IDs are retained in storage and authorization but are not primary UI labels.

## 9. Demo records created or replaced

The initializer replaces only records belonging to clients marked with the disposable dataset marker `ops-iq-v4-demo-v1`.

Created or rebuilt:

- Four demo client records.
- Four Client Administrator people and memberships.
- Three IQ factory records.
- Two additional IQ Factory Admin memberships and assignments for Mahindra and Boat.
- Basic Mahindra and Boat Zones and Departments.
- Independent entitlement maps for all four demo clients.
- Eleven-person native demo manifest.

Replaced within the marked disposable IQ dataset:

- `IQ Demo (fictional)` client presentation becomes `IQ` while retaining its canonical organization ID.
- `IQ Demo Factory` becomes `BYD` while retaining its canonical factory ID.
- Existing IQ demo Audit and Action factory labels become `BYD`; record IDs and operational history are retained.

No global browser-storage reset is used. ABC Manufacturing, unmarked organizations, and unmarked operational data remain outside the replacement scope.

## 10. Simplification and remaining limitations

The active UI no longer includes:

- Locked disabled-module sidebar entries.
- The separate IQ staged-onboarding panel.
- Placeholder Users and Configuration client-detail tabs.
- A separate platform factory-request dashboard.
- Repeated factory module badges inside Users & Roles.
- The extra platform administration-history shortcut.

Remaining limitations:

- Gemba, Red Tag, Continuous Improvement, Visual Improvement, and Visual Management still lack safe multi-tenant record identity. Their enabled routes remain restricted for non-ABC clients.
- The MVP remains browser-local and development-demo oriented.
- Existing dependency safeguards can block role revocation where the consolidated unfinished-work index is incomplete.
- Initialize Role Demo must be used once after loading this implementation; use Reset Demo Data on later rebuilds.

## 11. Exact files changed

- `app/(app)/super-admin/organizations/[id]/factories/page.tsx`
- `components/navigation/sidebar-nav.tsx`
- `components/navigation/user-menu.tsx`
- `components/ops/access-context-boundary.tsx`
- `features/five-s/administration/access-v3-page.tsx`
- `features/five-s/administration/access-v3-state.ts`
- `features/five-s/administration/access-v3-store.ts`
- `features/five-s/administration/access-v3-types.ts`
- `features/five-s/administration/access-v4-context.ts`
- `features/five-s/administration/access-v4-panel.tsx`
- `features/five-s/administration/access-v4-store.ts`
- `features/ops-dashboard/scoped-workspace.tsx`
- `features/settings/scoped-settings.tsx`
- `features/super-admin/super-admin.tsx`
- `lib/demo/final-demo.ts`
- `lib/demo/native-demo-data.ts`
- `lib/demo/switch-final-persona.ts`
- `lib/modules.ts`
- `docs/QA/OPS-V4-MULTI-CLIENT-FACTORY-HIERARCHY.md`
- `docs/QA/OPS-V4-IQ-CLIENT-ADMIN-COMPLETION.md` (superseded-behavior notice)

Extensive pre-existing local changes were preserved. No unrelated work was reset or reverted.

## 12. Demonstration and deferred acceptance checklist

### Demonstration steps

1. Open the account menu and select **Initialize role demo**. If the new dataset is already active, select **Reset demo data** instead.
2. As Metric Mind, open **Clients & subscriptions**.
3. Confirm IQ, Mitsubishi, Hyundai, and Kavery Hospital appear with their assigned Client Admins.
4. Open IQ and select **Modules**.
5. Disable Red Tag and save.
6. Switch to IQ Manoj.
7. Confirm Red Tag is absent from the sidebar.
8. Open the Red Tag URL directly and confirm Access Unavailable appears.
9. Open **Administration → Factories** and confirm BYD, Mahindra, and Boat.
10. Select BYD and open **Users & Roles**.
11. Use the active-context selector to select IQ · BYD, then manage users, Zones, Departments, role assignments, or Auditor authorization.
12. Switch to Mitsubishi Client Admin and confirm there are no factories and no IQ data.
13. Switch to IQ Manoj, open Factories, select **Request Factory**, enter a name, and submit.
14. Switch to Metric Mind, open IQ → Factories, and approve the pending request.
15. Switch to IQ Manoj and confirm the approved factory appears.
16. Switch to Metric Mind, re-enable Red Tag for IQ, then switch back and confirm it returns to eligible navigation while the safe legacy-integration restriction remains.

### Deferred consolidated checks

The explicitly deferred final cycle should verify:

- TypeScript, lint, and production build.
- Unit and browser acceptance suites.
- Eleven-person initialization and refresh persistence.
- Cross-client route and command isolation.
- Factory request duplicate and repeated-decision protection.
- Approved factory creation and rejected-request non-creation.
- Client Admin Zone, Department, user, role, Factory Admin, and Auditor operations.
- Independent entitlement changes across all four clients.
- Disabled sidebar and direct-route behavior.
- Existing ABC and IQ operational-record preservation.
- Browser Back/Forward behavior and console warnings.

No Vitest, Playwright, browser automation, TypeScript check, lint, production build, or regression suite was run. No automated test files were created. No commit, push, merge, or deployment was performed.
