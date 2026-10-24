# OPS Access v4 — Batch 4 UI readiness

Date: 22 October 2026. **PARTIALLY UI READY.** Supported Department-origin workflows pass focused Chromium smoke and are testable in a disposable synthetic browser context. Real IQ operational UAT remains blocked by approved roster/Department/activation prerequisites. This is neither full v4 acceptance nor production readiness.

## Reviewed sources and implementation boundary

Business source reviewed: the available nine-slide `MetricMind_Operational_Excellence_Access_Architecture_v3.pptx` in Downloads. No separate v4 PPT was found in repository documents, attachments, Documents or Downloads. Subsequent approved v4 decisions and implementation briefs govern the explicit hierarchy, independent roles and verification refinements; the older deck's combined FA/Champion wording does not confer v4 Factory Admin powers on Champions.

Reviewed the v3 Phase 1/2 reports, v4 master specification, decision register, gap/implementation plans, Phase 1A/2A reports, Phase 2B storage/recovery/gate contracts and accelerated Batch 1–3 reports against current code. Earlier documentation-only statements are historical; later explicit implementation approvals apply. Unresolved business policies remain blocked.

Canonical sources remain the existing administration directory/memberships/configuration and v4 envelope, Audit store, `MyAction`/Action store, shared evidence Blob storage, module entitlement store and explicit context policy. No parallel store, new route family, UI design system, package or backend was introduced.

## Implemented technical fixes

1. Added the missing v4 **Undo Start Work** command/UI by delegating to the existing canonical lifecycle. Retains draft work, capacity and history; requires current owner, context and revision.
2. Action detail now disables protected controls on a stale form or pending recovery, identifies invalid/revoked verifier/coordinator selection, explains absent eligible verifiers, displays the selected coordinator, and disables submission until selection is currently valid. Existing service checks remain authoritative.
3. Scheduled Audit setup catches command errors and displays them in the form. Stale versioned setup requires **Reload Audit setup**. Setup editing is disabled for people without the existing explicit Factory Admin authority; execution retains existing Auditor/FA policy.
4. Audit record query changes remount the `/audits` screen so supported source links cannot retain a previously selected record.
5. Replaced Audit's inner nested `main` landmark with an **Audit question workspace** section.
6. Organizational access displays a loading state while context hydrates. IQ activation-readiness exceptions are visible instead of silently omitted; activation remains disabled.
7. Audit listing controls now consider selected context as well as profile type. A legacy canonical person in a foreign factory cannot use ABC demo reset or legacy settings navigation. The reset command independently rejects a foreign context even when its Audit list is empty.
8. Added a repeatable test-only fixture export and headed manual launcher using the already established Batch 3 synthetic setup and existing demo identity switcher. Nothing is seeded into a user's existing browser or application on page load.

## Routes and canonical UI wiring

| Route | Inspected / smoke outcome |
| --- | --- |
| `/super-admin/organizations` | Chromium renders client listing and **Create client** control under actual SA identity |
| `/super-admin/organizations/[id]` | Chromium renders existing synthetic client's **Assign Client Admin** control |
| `/settings/administration` | Chromium exercises **Active context**, CA **Create factory** form/cancel, FA **Create Department** form/cancel and **Auditor Authorization** / **Grant authorization** controls |
| `/settings/users` | Existing alias integration inspected; no separate browser CRUD acceptance claimed |
| `/audits` | Chromium renders All listing, selects canonical Zone/Department and eligible Auditor, creates a Scheduled Audit, saves setup and starts execution |
| `/audits?audit=[id]` | Chromium opens exact existing finding and follows task reverse link back to this Audit |
| `/actions/[id]` | Chromium creates/opens the real linked Action, preserves scope and exercises work/evidence/verification/rework/closure and refresh |
| `/actions` | Chromium denies general listing in Audit-only synthetic context |
| `/5s/actions/[id]` | Existing canonical detail alias inspected; separate browser alias run deferred |
| `/5s/audits` and Audit report route | Existing compatibility/report wiring inspected; separate browser/report acceptance deferred |

Administration dialogs remain wired to existing protected canonical commands. The smoke cancels administration forms rather than inventing additional organizational configuration. Tests exercise the underlying authorized administration persistence in isolated storage.

## Supported journeys and states

The smoke covers the existing single-question synthetic Department-origin Audit → **0 Non Compliance** → observation → **Add Action** → exact **Owner and recorded work assignment** → **Create corrective Action** → **View Action** → source reverse link → actual owner with selected context → explicit **Corrective Action** type → **Start work** → **Undo Start Work** → restart → work notes/category/savings → durable resolution upload and **View authorized evidence** → independent FA coordinator selects **Eligible verifier** / **Confirm explicit verifier** → owner submits → selected DL **Send back for rework** → owner explicitly restarts/resubmits → DL **Verify and close** → refresh.

Exactly one canonical v4 Action exists after the source journey. The unselected `reviewer2` identity is denied the task. General Actions remains disabled; narrow access does not enable manual Action creation or Action Center. Client/factory administration, directory and organization configuration raw payloads are unchanged by the business journey.

Scheduled creation uses the existing assigned Zone-B Leader Auditor grant for Zone A, the exact canonical Department and explicit factory context. The assigned FA saves setup and starts through existing authority. This does not establish a new Auditor review stage.

Loading, empty scope, unavailable task/record, missing Department, no eligible owner/verifier, stale revision, failed upload, revoked selection and recovery states were traced in current components/services. Relevant scope/revision/storage failures are covered by focused tests. The browser pass does not inject every negative state or certify every permission combination. Audit completion independently of Action closure remains the approved existing contract, covered by retained Batch 3 tests; this smoke does not complete/sign the entire Audit.

## Business-policy and capability blockers

- **IQ operations:** no IQ client activation, entitlement change, approved operational roster or approved Department facts were supplied or generated. The guided staging workflow exists; do not complete real setup from synthetic fixture values.
- **Department-less origins:** Audit can exist without a Department, but corrective Action owner eligibility remains blocked. No fallback Department is inferred from a legacy string.
- **Factory Admin work:** no approved Action-specific verifier qualification facts; designation and review remain blocked. CA status alone does not qualify a verifier.
- **ZL work:** requires one eligible independent FA verifier and a different eligible FA coordinator. A one-FA factory remains blocked.
- **Deactivation/revocation:** existing role revocation and Department deactivation remain disabled until complete unfinished-work dependency coverage exists. No reassignment or cross-module revocation policy was invented.
- New v4 ownership reassignment/due-date/priority editing and other-module v4 activation remain outside this batch.
- Existing browser-local guards and shared local storage are frontend/demo boundaries, not production authentication, server tenant isolation, backend transactions or cross-device synchronization.

## Validation actually executed

| Check | Result |
| --- | --- |
| `npx tsc --noEmit --incremental false` | Passed |
| ESLint on exact changed `.ts`, `.tsx`, `.mjs` files | Passed, zero warnings/errors |
| `OPS_V4_UAT_FIXTURE_PATH=/tmp/ops-v4-uat-fixture.json npx vitest run tests/access-v4-batch4-fixture.test.ts tests/access-v4-batch1.test.ts tests/access-v4-batch2.test.ts tests/access-v4-legacy-characterization.test.ts --reporter=dot` | **62 passed**, 4 files; fixture spec imports unchanged Batch 3 cases, retaining their assertions |
| Focused Chromium spec `e2e/access-v4-batch4-smoke.spec.ts` | **2 passed**, final run 18.5 seconds; no blocking console/hydration errors |
| `node --check scripts/ops-v4-manual-uat.mjs` | Syntax checked; interactive headed handover itself was not launched |
| Changed-file whitespace and task-start content-hash inventory | Checked; existing files retained; exact scope below |

New focused checks cover canonical v4 Undo Start/revision protection, exporting the established synthetic fixture without IQ and denial of empty-foreign-scope demo reset. Earlier smoke attempts diagnosed a localhost development-origin restriction and corrected test selectors/identity matching. A work-upload attempt before the work save settled was correctly rejected; final smoke waits for the save before upload. Those failed setup attempts are not counted as successful acceptance.

No production build, broad regression suite or complete historical Playwright suite was run. Full browser/security acceptance remains separate. Evidence screenshots are temporary: `/tmp/ops-v4-scheduled-audit-smoke.png` and `/tmp/ops-v4-denied-smoke.png`; final smoke log `/tmp/ops-batch4-smoke.log`.

## Local startup and safe UAT preparation

The existing local dev server on port 3000 was reused without stopping it. For a fresh local startup, run from the repository:

```bash
npm run dev -- --hostname localhost --port 3000
```

Use `http://localhost:3000` for this server. The initial `127.0.0.1` smoke origin received development asset 403 responses; localhost worked without loosening Next configuration. Do not start a second server against the same `.next` lock or kill an existing user process to follow this guide.

Generate the **existing synthetic test context**, not IQ or an application seed route:

```bash
OPS_V4_UAT_FIXTURE_PATH=/tmp/ops-v4-uat-fixture.json npx vitest run tests/access-v4-batch4-fixture.test.ts --reporter=dot
```

The exported fixture is temporary and contains the same `Synthetic Audit Tenant`, `Synthetic factory`, canonical synthetic Department and scoped identities used by Batch 3 tests. Its isolated active Audit-only entitlement is a test fixture, never a new application activation command or business approval. It contains no IQ tenant. Generated canonical IDs vary on regeneration; use the UI names below.

Launch a separate disposable browser/context:

```bash
export OPS_QA_BROWSER_EXECUTABLE='/tmp/ops-p0-browsers/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
node scripts/ops-v4-manual-uat.mjs /tmp/ops-v4-uat-fixture.json
```

That executable was available on this machine for the successful smoke. Where Playwright Chromium is installed normally, omit the executable override. An alternative local port can be supplied through `OPS_V4_UAT_BASE_URL`, restricted to localhost/127.0.0.1. The launcher never connects to your regular browser profile, clears storage, or copies data from it. Closing the launched page closes its disposable browser; changes made during that isolated manual session are temporary. Regenerating a fixture does not update an already open context.

The exact automated smoke command used the available executable and running server:

```bash
OPS_QA_EXTERNAL_SERVER=1 OPS_QA_BROWSER_EXECUTABLE='/tmp/ops-p0-browsers/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' npx playwright test e2e/access-v4-batch4-smoke.spec.ts --reporter=line --output=/tmp/ops-batch4-smoke-results
```

## Exact identities and context selection

1. The launcher opens `/settings/administration` as canonical **Lakshman**, explicitly assigned FA in **Synthetic Audit Tenant · Synthetic factory**.
2. To switch to a scoped fixture person, open **Account menu**, select **OPS Super Admin**, open **Account menu** again, then select the exact name with subtitle **Scoped OPS demo**. The scoped roster is shown only under SA in the existing demo switcher. This is identity switching, not an administrative promotion.
3. Open `/settings/administration`, choose **Active context** → **Synthetic Audit Tenant · Synthetic factory** for `owner`, `reviewer`, `coordinator`, `auditor`, `reviewer2` or Lakshman. Identity changes invalidate the prior person's context.
4. For **Synthetic Client Admin**, select **Synthetic Audit Tenant · Client administration**. For platform administration select **Metric Mind · Platform administration** under actual OPS Super Admin.
5. Use exact **reviewer**, not **reviewer2**. The latter is deliberately not the selected task verifier and should be denied task review.

## Manual UAT walkthrough

1. As Lakshman in the synthetic factory, inspect **Create Department**, **Assign independent role**, **Independent assignments**, and **Auditor Authorization**. Existing synthetic facts are already present; do not enter IQ values or create substitute approvals.
2. Open `/audits`; confirm **All**. Open the pre-existing single-question Audit. Its ID is `auditId` in the temporary fixture; direct link format is `/audits?audit=<auditId>`.
3. Select **0 Non Compliance**, enter an observation, choose **Add Action**. Select **owner · Department Member**, provide a future **Due date**, and choose **Create corrective Action**. The fixture custom question does not require a finding photo; standard questions still require their policy-mandated evidence.
4. Choose **View Action**. Confirm exact source, owner and recorded capacity. Follow **Open originating Audit**, then **View Action** again. The existing Action must open, not duplicate.
5. Through the identity sequence above select `owner` and factory context. Open the copied `/actions/<id>` link. Confirm Start is disabled until choosing **Immediate Action** or **Corrective Action**. Choose **Corrective Action**, **Start work**, optionally **Undo Start Work**, then restart.
6. Enter **Resolution notes**, **Corrective action category** and nonnegative **Cost saving**. Choose **Save work** and wait for the controls to re-enable. Upload **resolution evidence**; use its file button and **View authorized evidence**. Submission stays disabled without a valid explicit selection.
7. Select `coordinator`, factory context, and the same Action link. In **Independent verifier selection**, choose exact `reviewer`, then **Confirm explicit verifier**. The logged-in independent FA is recorded as coordinator; no coordinator is inferred from creator/owner.
8. Return as `owner` in the same context. Choose **Submit for independent review**.
9. Select `reviewer2` and factory context; the task should be unavailable. Select exact `reviewer`, context and task link. Enter **Review / rework reason**, choose **Send back for rework**. Owner restarts with explicit type and resubmits. Reviewer then chooses **Verify and close**.
10. Refresh the closed task. Confirm Completed, retained evidence and **Retained task history**. Opening `/actions` in this Audit-only context remains denied.
11. Separately as FA, `/audits` → **Start Audit** → **Zone A** → **Canonical Department (optional)** → **Approved synthetic Department** → **Assigned auditor** → `auditor`. Enter future **Scheduled Date**, **Scheduled Time**, **Due Date**, then **Schedule Audit**. In **Pre-start setup**, **Save Setup**, then **Start Audit**. No leadership/authorization is granted by these controls.
12. For administration display UAT, switch SA and open `/super-admin/organizations`; inspect the synthetic client. Switch **Synthetic Client Admin** and client context; inspect **Create factory** and **Assign Factory Admin**, without granting new unapproved facts. CA should not see **Add User**. Return FA for factory-user/Zone/Department management.

Testable now in the isolated launcher: scoped administration forms, context switching, existing Auditor authorization display, Department-origin Audit/Action journey, durable evidence read/write, explicit coordinator/verifier, rework, closure, refresh and denied general Actions. Existing ordinary browser data is separate and may not contain this tenant or any approved v4 configuration. Real IQ operations, unsupported origin/qualification/dependency-policy cases remain blocked there.

## Preservation and final acceptance recommendation

No user's active browser was inspected, reset or migrated. No IQ provisioning, client activation, real membership/grant/entitlement changes or legacy conversion was performed. Browser writes and Blob uploads were restricted to fresh synthetic test contexts. The smoke checks preservation of canonical administration/configuration/directory payloads in that context; it does not certify unseen historical records in a user's normal browser. Existing local source work, including the preceding quota fix, remains preserved. No commit, push, merge or deployment.

Next, after explicit authorization, consolidate full regression/browser acceptance for v3/ABC/XYZ compatibility, all supported v4 actor/scope combinations, role/entitlement changes during mounted forms/uploads, stale and recovery cases, multi-tab behavior, quota/IndexedDB failures, standard Audit evidence/signatures/completion, responsive/keyboard operation and alias/Back/Forward navigation. Resolve actual IQ configuration and unsupported qualification/origin/dependency policies separately before considering activation.

## Exact files changed in Batch 4

### Created

- `e2e/access-v4-batch4-smoke.spec.ts`
- `scripts/ops-v4-manual-uat.mjs`
- `tests/access-v4-batch4-fixture.test.ts`
- `docs/QA/OPS-ACCESS-V4-BATCH4-UI-READINESS.md` (this report)

### Modified

- `app/(app)/audits/page.tsx`
- `features/actions/audit-action-detail.tsx`
- `features/five-s/administration/access-v4-panel.tsx`
- `features/five-s/administration/iq-onboarding-panel.tsx`
- `features/five-s/components/FiveSAuditExecution.tsx`
- `features/five-s/components/FiveSAuditList.tsx`
- `features/five-s/components/FiveSAuditScheduled.tsx`
- `lib/actions/action-store.ts`
- `lib/five-s/audit-store.ts`
- `tests/access-v4-batch3.test.ts`

The Batch 3 test change only exports its existing setup for reuse; its existing assertions and fixtures are preserved.

**PARTIALLY UI READY** — supported synthetic journeys pass focused UI smoke. IQ business configuration/activation, FA-work qualification, Department-less origins and complete dependency-policy operations remain blocked. Stop after this batch.
