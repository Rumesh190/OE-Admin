# OPS v4 — IQ Client Administrator Completion

> Superseded by `OPS-V4-MULTI-CLIENT-FACTORY-HIERARCHY.md`. The later approved MVP hides disabled modules and requires Metric Mind approval for new factories.

**Status:** IMPLEMENTATION COMPLETE — UNTESTED

This batch completes the IQ Manoj Client Administrator presentation and authorization integration against the existing OPS v4 access architecture. Automated verification was intentionally deferred by the implementation brief. The review performed in this batch was limited to source inspection and consistency checks.

## 1. IQ Manoj role and context behavior

- The existing canonical IQ Manoj persona is reused through the native account-menu switcher.
- Switching to IQ Manoj selects the IQ client context rather than a platform or unrelated client context.
- Client Administrator authority remains client-scoped. It does not imply Platform Super Admin, Factory Administrator, Auditor, Zone Leader, action-owner, verifier, or other operational authority.
- The accepted Metric Mind Platform Super Admin dashboard was not redesigned in this batch.

## 2. All-module sidebar visibility

- IQ Client Administrators receive the complete registered operational module catalog in the existing sidebar.
- Dashboard, Gemba, Red Tag, Continuous Improvement, Visual Improvement, Visual Management, 5S Audit, Actions, Reports, Settings, and Administration remain discoverable.
- Other personas continue to receive the existing entitlement-filtered navigation behavior.
- Disabled operational modules remain navigable to an explanatory access state and display a lock indicator with a `Disabled` label.

## 3. Enabled and disabled module UI

The client experience distinguishes these states:

- **Enabled and available:** The entitlement, implementation, selected context, and operational role permit the requested operation.
- **Disabled by Metric Mind:** The module is visible, marked disabled, and opens a state explaining that Metric Mind controls the entitlement.
- **Enabled but integration unavailable:** The entitlement is enabled, but the legacy module does not yet carry safe IQ tenant/factory identity.
- **Enabled but role-restricted:** The entitlement is enabled, but Client Administrator authority does not grant the operational permission required by the route.

IQ Client Administrator screens expose no entitlement switches.

## 4. Metric Mind entitlement management

- The existing Clients & Subscriptions and Module Access interfaces continue to write through the canonical organization entitlement service.
- Visual Improvement is included in the registered entitlement catalog alongside the other operational modules.
- No sidebar-specific, settings-specific, or persona-specific entitlement flags were added.
- One saved client entitlement state therefore governs IQ Manoj and other IQ personas.
- Disabling a module changes availability only; it does not delete or reset module records.

## 5. Entitlement propagation

- The canonical entitlement store notifies same-tab subscribers after a save and listens for browser storage changes.
- Sidebar indicators, the client dashboard, Client Administration, Settings, and direct-route enforcement read from that same state.
- Switching back to IQ Manoj therefore resolves the current IQ entitlement state rather than a persona-local copy.
- Canonical Audit and Action mutations re-evaluate their relevant entitlements when the command executes. A form opened before revocation cannot rely only on its initial render-time access state.
- Re-enabling an entitlement restores access to existing authorized records where the module integration and operational role permit it.

## 6. IQ Client Administration functionality

The existing Administration area now provides IQ Manoj with:

- A client overview showing client status, active factories, enabled module count, and Factory Administrator assignments.
- Existing canonical factory creation and management operations allowed to Client Administrators.
- Existing canonical Factory Administrator assignment and revocation operations.
- A read-only Module Access view explaining that Metric Mind manages entitlements.
- Existing user, auditor-authorization, and history views subject to their current command-level authorization.

Factory Administrator-only user creation remains Factory Administrator-only. Client Administrator status does not reveal platform controls or grant factory module configuration.

## 7. Client dashboard

- IQ Manoj receives a client-level dashboard built from canonical organization, access, and entitlement state.
- It shows the IQ client name, active factory count, active Factory Administrator assignment count, enabled module count, module availability, and links to Client Administration and Client Settings.
- It does not fabricate operational KPIs or read ABC Manufacturing operational records as IQ data.
- The Metric Mind dashboard path and presentation were left unchanged by this batch.

## 8. Direct-route and command authorization

- The application access boundary classifies IQ module routes using the current client entitlement, tenant-integration availability, selected context, and approved role authority.
- A direct URL cannot turn a disabled entitlement into module access.
- Legacy tenantless module routes remain blocked in IQ contexts even when enabled, preventing accidental disclosure of ABC Manufacturing records.
- Audit and Action command policies recheck canonical access and entitlement state at mutation time.
- Reports remain read-only and still require an authorized operational context where applicable.
- Client Administration mutations continue to use the existing canonical access-v3 commands and revision rules.

## 9. Remaining tenant-integration limitations

Gemba, Red Tag, Continuous Improvement, Visual Improvement, and Visual Management still use legacy record models that do not carry sufficient tenant and factory identity for safe IQ operation. When IQ has an entitlement for one of these modules, the UI reports **Enabled but integration unavailable**. The route remains blocked so ABC Manufacturing records cannot appear in IQ.

Audit, Actions, and Reports have v4-aware access paths, but an IQ Client Administrator still needs the appropriate operational context or role for operational work. Entitlement alone does not supply that authority.

The application remains browser-local. Its client-side guards provide the current demo/MVP enforcement model and are not a substitute for server-side production authorization.

## 10. Exact files changed in this batch

- `lib/modules.ts`
- `components/navigation/sidebar-nav.tsx`
- `components/ops/access-context-boundary.tsx`
- `features/ops-dashboard/scoped-workspace.tsx`
- `features/five-s/administration/access-v3-page.tsx`
- `features/settings/scoped-settings.tsx`
- `features/settings/module-access-page.tsx`
- `lib/actions/action-v4-policy.ts`
- `docs/QA/OPS-V4-IQ-CLIENT-ADMIN-COMPLETION.md`

The repository contained extensive pre-existing local work. This batch preserved it and did not reset, revert, or broadly reformat the worktree.

## 11. Deferred consolidated acceptance scenarios

The final consolidated test cycle should verify:

1. Switch to Metric Mind and confirm the accepted platform dashboard remains unchanged.
2. Open Clients & Subscriptions, select the IQ Demo client, and inspect the complete entitlement catalog.
3. Disable one IQ module and confirm the saved entitlement remains visible after leaving and returning to the client.
4. Switch to IQ Manoj and confirm the IQ client context is selected.
5. Confirm the complete module catalog remains visible in the sidebar.
6. Confirm the disabled module shows its lock/Disabled treatment.
7. Open the disabled module through both the sidebar and a direct URL and confirm the `Disabled by Metric Mind` state.
8. Open an enabled legacy tenantless module and confirm the `Enabled but integration unavailable` state without displaying ABC records.
9. Open an enabled operational module for which IQ Manoj lacks authority and confirm the `Enabled but role-restricted` state.
10. Open IQ Client Administration and verify client status, factories, Factory Administrator assignments, and read-only module access.
11. Exercise the existing approved Client Administrator factory and Factory Administrator assignment commands.
12. Confirm IQ Manoj cannot edit entitlement switches or access platform administration.
13. Confirm IQ Settings shows the same read-only entitlement state as Client Administration and the sidebar.
14. Open an authorized Audit or Action form, revoke its relevant entitlement as Metric Mind, and confirm a subsequent save is rejected without deleting the record.
15. Re-enable the module, switch back to IQ Manoj, and confirm the sidebar and all read-only entitlement views update.
16. Confirm existing authorized records reappear after re-enabling and were not recreated or reset.
17. Confirm IQ pages never expose ABC Manufacturing operational records.
18. Confirm browser Back/Forward navigation, deep links, and the native persona switcher continue to work.
19. Inspect the browser console for relevant errors or Base UI warnings.
20. Run the deferred TypeScript, lint, build, unit, and browser acceptance checks only after explicit approval for the consolidated cycle.

No automated tests, browser automation, TypeScript checks, lint, or production build were run. No test files were created. No commit, push, merge, or deployment was performed.
