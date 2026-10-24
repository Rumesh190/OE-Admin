# OPS v4 — Metric Mind Full Access and Module Restoration

**Status: PARTIALLY IMPLEMENTED — UNTESTED**

Source implementation was completed for Metric Mind platform authorization, active client/factory selection, module navigation, ABC operational workflows, and tenant-scoped Audit/Action reads. Five legacy operational stores still lack tenant and factory identity fields, so their IQ write integration cannot be completed safely without persisted-model migrations. They remain blocked in IQ rather than exposing ABC records as IQ data.

No Vitest, Playwright, browser automation, TypeScript check, lint, build, or regression suite was run, as required by this batch.

## 1. Metric Mind authorization changes

- Reused `USR-OPS-SUPER-ADMIN` as the single **Metric Mind — Platform Super Admin** identity.
- Added a shared explicit Platform Super Admin operational policy.
- Operational authority requires an active factory context selected by Metric Mind.
- Platform administration remains available in platform or client context.
- Metric Mind bypasses tenant module-subscription hiding in `ModuleGate` and sidebar presentation.
- Metric Mind can read tenant-scoped v4 Audits and Actions in the exact selected factory.
- Metric Mind can schedule scoped Audits through the administrative path. Audit execution and Action completion still preserve assignment, verifier, coordinator, evidence, and separation-of-duties rules.
- Legacy operational writes are allowed only in the selected ABC Manufacturing / Egmore factory, because those persisted records do not carry tenant IDs.

## 2. Restored modules and routes

The normal OE sidebar now exposes these modules for Metric Mind:

| Module | Route |
|---|---|
| Dashboard | `/dashboard` |
| Gemba | `/gemba` |
| Red Tag | `/5s/red` |
| Continuous Improvement | `/continuous-improvement` |
| Visual Improvement | `/visual-improvement` |
| Visual Management | `/visual-management` |
| 5S Audit | `/audits` |
| Actions | `/actions` |
| Reports | `/reports` |
| Settings | `/settings` |
| Administration | `/settings/administration` |
| Clients & Subscriptions | `/super-admin/organizations` |

Visual Improvement is restored as a first-class registered OE module rather than a hidden legacy navigation item. Existing routes, pages, stores, and workflows are reused.

## 3. Actual read/write capabilities implemented

### Selected ABC Manufacturing / Egmore Plant

Metric Mind can open and operate the existing supported workflows for:

- Gemba creation and lifecycle commands.
- Red Tag creation and management, while retaining the independent Zone Leader review requirement.
- Continuous Improvement creation, editing and implementation. Review remains unavailable when Metric Mind created the same proposal.
- Visual Improvement creation and management. Independent review remains unavailable for the creator.
- Visual Management configuration and board operations.
- General Action creation and canonical Action commands.
- Existing Dashboard, Reports, Settings and Administration capabilities.

The stores continue to enforce their existing evidence, transition, ownership, linking and audit-history rules.

### Selected fictional IQ factory

- Metric Mind can inspect all canonical v4 Audits and Actions in the selected IQ factory.
- Metric Mind can access tenant administration, users, roles, Departments, entitlements and module configuration through existing commands.
- Audit and Action execution continues to require the assigned owner/verifier/coordinator identities. Metric Mind is not silently substituted for those actors.

## 4. Remaining integration gaps

Gemba, Red Tag, Continuous Improvement, Visual Improvement and Visual Management persist records without a canonical `organizationId` and factory ID. Their records identify only human-readable plant and Zone values. Supporting IQ writes in those stores would require:

1. additive tenant/factory fields in each persisted model;
2. migration and validation for existing records;
3. tenant-filtered reads and direct-record lookup;
4. tenant-scoped ID allocation and source-link validation;
5. module-specific role decisions for Department and Zone Champion authority;
6. compatible cross-module Action provenance.

Those migrations were not fabricated in this batch. When IQ is selected, the route boundary continues to block these tenantless stores with a clear message. This prevents legacy ABC records from appearing in or being written to IQ.

## 5. Client/factory context selection

- The header now provides Metric Mind with the existing authorized context options: platform, each active client, and each active factory.
- Selection uses the canonical access-context store and generates a new selection revision.
- Changing scope returns to the Dashboard, remounting scoped content and discarding open form authority.
- The existing header identity label shows Metric Mind, Platform Super Admin, and the active client/factory.
- The fictional IQ client and IQ Demo Factory become selectable after native demo initialization.

## 6. Dashboard changes

- Platform context shows a real platform overview based on canonical active client and factory records, with links to Clients & Subscriptions, Administration and Settings.
- Selecting ABC/Egmore opens the complete existing OE dashboard and its canonical module analytics.
- Selecting the fictional IQ factory shows its tenant-scoped Audit and Action workspace and counts. Missing legacy-module data is described as unavailable rather than replaced with fake KPIs.

## 7. Other personas

- The native account menu remains the sole switcher with exactly eight personas.
- Client and factory personas remain constrained by their active context, tenant entitlements, v3 memberships, v4 assignments and module-specific roles.
- Other scoped personas can see only entitled modules while a factory context is active.
- The Platform Super Admin policy does not grant or mutate permissions for the other seven identities.

## 8. Files changed in this batch

- `lib/platform-operational-access.ts`
- `lib/modules.ts`
- `lib/legacy-operational-write.ts`
- `lib/five-s/audit-authorization.ts`
- `lib/actions/action-v4-policy.ts`
- `lib/actions/action-creation-access.ts`
- `features/five-s/administration/access-v4-context.ts`
- `features/five-s/administration/factory-authorization.ts`
- `features/five-s/components/FiveSAuditCreate.tsx`
- `components/navigation/access-context-selector.tsx`
- `components/navigation/header.tsx`
- `components/navigation/sidebar-nav.tsx`
- `components/modules/module-gate.tsx`
- `components/ops/access-context-boundary.tsx`
- `features/ops-dashboard/scoped-workspace.tsx`
- `features/gemba/gemba-access.ts`
- `features/five-s/red-tag/access.ts`
- `features/five-s/continuous-improvement/access.ts`
- `features/five-s/continuous-improvement/store.ts`
- `features/visual-improvement/visual-improvement-access.ts`
- `features/visual-management/visual-management-access.ts`
- `features/actions/action-center-page.tsx`

## 9. Demo data changes

No browser storage or disposable demo record was changed during this source-only implementation. The native initializer/reset remains the source of the fictional IQ client and factory. No storage key was cleared and `localStorage.clear()` was not introduced.

## 10. Deferred consolidated acceptance

1. Initialize the native role demo and select Metric Mind.
2. Confirm exactly eight account-menu personas.
3. Confirm all restored modules appear in the normal OE sidebar.
4. Switch between platform, ABC client, ABC/Egmore factory, fictional IQ client and IQ Demo Factory.
5. Confirm scope changes return to Dashboard and discard open forms.
6. In ABC/Egmore, exercise supported create/view/edit lifecycle paths for Gemba, Red Tag, Continuous Improvement, Visual Improvement, Visual Management and general Actions.
7. Confirm creator/reviewer and verifier/coordinator separation remains enforced.
8. In IQ Demo Factory, verify canonical Audit/Action reads and authorized task operations.
9. Confirm tenantless legacy modules do not display ABC records under IQ.
10. Switch through the other seven personas and verify sidebar, Settings, Administration, Audit and Action capabilities match their memberships and entitlements.
11. Confirm direct links cannot cross client/factory boundaries.
12. Review the browser console and responsive header/sidebar behavior.
