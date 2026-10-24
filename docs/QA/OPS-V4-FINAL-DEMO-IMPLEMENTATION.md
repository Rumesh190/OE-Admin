# OPS v4 — Final role-based demo implementation

**PARTIALLY IMPLEMENTED — BLOCKERS REMAIN · UNTESTED**

22 October 2026. Implementation and offline dataset construction only. No automated acceptance, browser interaction, TypeScript checking, linting or build was performed. Existing dirty local work was preserved. No commit, push, merge or deployment.

Business sources: the latest available `MetricMind_Operational_Excellence_Access_Architecture_v3.pptx` (previously extracted into `/tmp/ops-batch4-architecture-ppt.txt`), the approved v4 master specification/decision register, Batch 1–4 reports, and the final MVP brief. The PPT's combined Factory Admin/Champion designation is superseded by independent v4 assignments: Champion never inherits FA authority.

## 1. Implemented features

- Eight named personas in the existing account menu, available from every persona **inside the marked isolated dataset**. Existing ordinary-browser identity switching remains available outside it.
- Stable canonical person IDs; no second authentication/user-management store. The small demo manifest contains presentation labels and preferred scope, never permission grants.
- Identity selection clears the previous context, then selects an actually authorized platform, client or factory context through existing validators. Missing/inactive membership fails closed and shows an error. Switching returns to Dashboard; it needs no restart.
- Visible identity/role plus client/factory/Zone/Department scope in the header. Existing avatars follow the selected canonical person and personal profile.
- Identity/context keyed remounts continue to discard open forms, task previews and captured authority. Existing asynchronous Action/evidence commands continue to revalidate their captured context/revision.
- Primary Dashboard and Reports routes have a v4 scope projection of **authorized Audit and Action records only**. Counts come from existing canonical hooks. CA/SA receive no inherited operational records. This is not the full legacy dashboard/report library or a new database.
- Actions main route has a canonical v4 task inbox, All/status tabs with counts, search and existing detail links. Requires the client's Actions entitlement. Audit-only clients retain the existing narrow task deep links; the inbox is not implicitly enabled for them. Status tab changes use browser history, and the existing reload initializer resets All.
- Settings presents platform controls, client administration, factory administration, Department allocation, Champion oversight or personal preferences according to actual scope/assignments.
- Sidebar omits unmigrated foreign-client modules; client/platform identities do not acquire operational menu items from tenant subscriptions. Champion oversight becomes discoverable through Administration without adding mutation authority.
- A shared persistence guard prevents Gemba/Red Tag/CI/VI/VM legacy stores from treating platform identity, foreign context, or new scoped profiles as legacy ABC write authority. Red Tag and VM permission helpers also reject platform/scoped identities. Gemba's passive migration and Red Tag reconciliation skip unauthorized writes. This is a restriction, not a new v4 permission matrix.
- Existing Audit/D10/Action work, explicit Action type, evidence, independent verifier/coordinator, review/rework, own-Zone exclusion and grant/revocation commands are reused without relaxed authorization.
- Fictional dataset generator and fresh-context manual launcher; the real-IQ guided onboarding panel is omitted within this isolated demo.

## 2. Eight-persona access matrix

All rows describe the prepared fictional dataset, subject to current canonical membership, context, entitlements and record policy. A displayed role label grants no authority.

| Persona | Scope | Administration | Audit | Audit-origin Actions |
| --- | --- | --- | --- | --- |
| Metric Mind | Platform | Clients/subscriptions/entitlements | No inherited factory execution | No inherited operational write |
| IQ Manoj | IQ Demo client | Factories and FA appointments | No inherited execution | No inherited work/review |
| IQ Factory Admin | IQ Demo Factory | Users, Zones, Departments, independent roles, explicit Auditor grants | Existing FA execution/setup; both demo Audits visible | Read/coordinator; explicitly selects the eligible independent verifier |
| IQ Zone Champion | Factory oversight | Existing minimum Department oversight, no FA controls | No execution | No invented factory-wide task/evidence access |
| IQ Zone Leader | Demo Zone B; explicit Auditor grant for A | Personal preferences; no factory administration | Assigned A Audit execution; own B execution denied | Finding creator/source access; no implicit owner/verifier authority |
| IQ Department Leader | Demo Assembly, Zone A | Existing same-Department member allocation | No Audit execution | Explicitly selected verifier of the DM task; review/rework/close after valid owner submission |
| IQ Department Member | Demo Assembly, Zone A | Personal preferences | No Audit execution | Assigned task, type choice, work/evidence, submit; no self-verification |
| IQ Standard User | Factory membership and Zone A allocation, no independent role | Personal preferences | No execution/assigned Audit | No task in the initial dataset; no CI initiation or invented assignment capacity |

Gemba, Red Tag, CI, VI and VM operations remain restricted for this independent client. Their existing legacy workflows remain separate. The PPT defines several broad contributions, but the v4 Department/Champion scope, source linking and workflow integration is unfinished; this report does not claim those contributions are implemented.

## 3. Sidebar visibility by persona

- Metric Mind: Dashboard, Settings, Clients & subscriptions; platform shell also provides Organizations navigation.
- IQ Manoj: Dashboard, Settings, Administration.
- FA, Champion and DL: Dashboard, Audit, Actions, Reports, Settings, Administration. Audit listing does not imply execution; Champion/DL initially see no authorized Audit records.
- ZL, DM and Standard User: Dashboard, Audit, Actions, Reports, Settings. Record policies determine visible rows; DM and Standard User initially see no Audits, Standard User sees no Actions.
- Unsupported foreign modules stay hidden even if a subscription flag is later enabled. Their direct operational routes remain restricted. No platform operational bypass was added.

## 4. Settings visibility by persona

| Persona | Settings links |
| --- | --- |
| Metric Mind | Clients & subscriptions, Module entitlements, personal preferences |
| IQ Manoj | Client administration (factories/FA appointments), personal preferences |
| FA | Factory administration (users/Zones/Departments/roles/Auditor grants), personal preferences |
| Champion | Factory oversight (existing read projection), personal preferences |
| ZL | Personal preferences |
| DL | Department allocations, personal preferences |
| DM | Personal preferences |
| Standard User | Personal preferences |

Legacy module configuration screens remain blocked in foreign scope, including for FA. This is a remaining implementation gap; the FA appointment is not projected into legacy Admin permission arrays. Platform module entitlements use their existing canonical platform editor. Changing a subscription flag does not grant a person factory authority.

## 5. Factory/Zone/Department access behavior

- Every operational persona belongs explicitly to IQ Demo and its single factory. FA is appointed separately by CA. CA has no factory membership/FA appointment; SA has neither.
- Champion is an independent factory-level assignment. ZL has Zone B leadership and a separate explicit Auditor grant for A. DL/DM are assigned to the Assembly Department in A. Standard User has ordinary factory membership and A allocation only.
- Neutral `Standard User` factory membership supports the independent v4 assignments without duplicating them as legacy ZL/Zone Member roles.
- Each Audit question carries a canonical Department. D10 records the exact DM role assignment as immutable work capacity. The selected DL verifier and FA coordinator are distinct from the owner and ZL finding creator.
- Audit/task deep links continue through existing routes and record authorization. DM/DL task access does not reveal the whole originating Audit.
- Default task status is All; All contains all statuses of authorized tasks. Search can narrow visible rows. Changing persona discards the previous form and returns to Dashboard; navigating directly afterwards uses the new person's persisted validated context.
- Scope and authorization are frontend/browser-local demo controls. No backend isolation, real authentication or cross-device synchronization is claimed.

## 6. Demo dataset and storage isolation

Prepared file: `/tmp/ops-final-demo.json` (private file mode on creation). No browser storage was read or written. The generator starts with an empty in-memory map, constructs ordinary records through existing canonical commands, then serializes them. It uses no user snapshot/backup and never connects to Brave.

Canonical directory bootstrap contains the existing platform identity with the presentation name Metric Mind and a new fictional FA person profile with **no roles, memberships or grants**. Existing platform attachment/CA appointment commands then create FA authority. Remaining people are created through canonical Client Admin/factory-user commands. Only the fictional in-memory client receives the explicit disposable-demo Active marker; no real IQ client is activated.

Stable person IDs use a dedicated deterministic UUID namespace in the offline generator and existing canonical ID prefixes. Browser runtime ID generation is unchanged. Every regeneration creates fresh command/history timestamps and future due dates. Other entity allocation IDs are deterministic for the current generator sequence; they are not a production ID reservation strategy.

| Dataset record | Canonical ID |
| --- | --- |
| Client: IQ Demo (fictional) | `ORG-7e3a7444-ab9b-4338-a09e-296a2ccfaf9a` |
| IQ Demo Factory / IQDEMO | `PLANT-cd757fcd-3d35-4348-aad0-015d603110e0` |
| Demo Zone A / DA | `ZONE-1832c6e1-d580-473b-a47d-8d3ccf9c1d4a` |
| Demo Zone B / DB | `ZONE-0cfa0bc0-1ca8-419a-a749-e44ebbf51a84` |
| Demo Assembly | `DEPT-1e2ec7e9-4033-4b4d-ab8a-51affa166cd5` |
| Demo Maintenance | `DEPT-a91d717b-5a41-435d-a75d-bf674107037b` |
| Assigned Zone A Audit / FA Zone B Audit | `AUD-000001`, `AUD-000002` |
| DM task, selected DL verifier, FA coordinator | `ACT-000001` |

All eight canonical person IDs are included in the generated file's `created.personas` and demo manifest. All non-platform contacts use the reserved fictional domain `iq-demo.invalid` and `IQ-DEMO-*` Employee IDs. There is no reuse/transfer of Rumesh, Lakshman, Siva Kumar, Anand or Manoj from the ordinary browser.

The file supplies empty legacy Gemba, Red Tag, CI, VI and VM collections plus current fixture-version/reset markers to avoid importing unrelated first-load examples into the demonstration. These are new empty dataset keys, not cleared existing browser keys. Audit and Action numbering retains the existing compatibility sequence key namespace (`abc-manufacturing`) while actual record tenant IDs are explicit; this does not associate the records with ABC.

The manual launcher opens a **new, nonpersistent Chromium context**, imports this fictional file into that context alone, and closes it on page close. Refresh retains that context's state. Closing/relaunching resets the demo by constructing a new context from the file; it never removes existing origin keys or calls `localStorage.clear()`.

## 7. Exact startup and launcher commands

From `/Users/rumesh-9634/Projects/Ops`, start the dev server only if it is not already running:

```bash
npm run dev -- --hostname localhost --port 3000
```

Generate the isolated dataset (implementation/data construction, no test runner):

```bash
node scripts/ops-final-demo-prepare.cjs /tmp/ops-final-demo.json
```

**Manual launcher below was written but NOT RUN.** The current batch prohibits browser automation; obtain product-owner authorization before launching it. It uses the already installed Playwright library solely to open a fresh headed browser/context and navigate to the demo, without assertions or test execution.

```bash
OPS_DEMO_BROWSER_EXECUTABLE='/tmp/ops-p0-browsers/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' node scripts/ops-final-demo-launch.mjs /tmp/ops-final-demo.json
```

If Chromium is already installed at Playwright's normal location, omit the executable override. `OPS_DEMO_BASE_URL` can select another loopback origin; default is `http://localhost:3000`. Do not use the old live-snapshot preparation tool for this task. Do not launch against or attach to an existing browser profile. Do not start a second dev server against an existing `.next` lock.

Reset: close the launched browser page, then run the launcher again with the same dataset. To rebuild future dates and fresh history, rerun the preparation command first. No regular browser or data deletion is involved.

## 8. Profile-switching instructions

After an authorized manual launch, open Account menu (avatar, top right). Select any of the eight names directly; the selected item is checked. Name/avatar/role, sidebar and Settings follow the chosen identity. The correct authorized platform/client/factory context is selected automatically. No intermediate Super Admin selection is required. The selected persona opens Dashboard; use sidebar or a copied task/Audit link to continue.

If scope selection fails after a membership was revoked or deactivated, the identity remains selected with no inherited context and the error is visible on reopening Account menu. Do not bypass it with storage edits; review canonical administration or reset the disposable context.

## 9. Ten-minute client demo walkthrough (proposed; NOT executed)

1. **0:00–1:00, Metric Mind:** show name/role and platform Settings. Inspect Clients & subscriptions / entitlements. Explain that this identity has no inherited factory operational write.
2. **1:00–2:00, IQ Manoj:** switch directly; show automatic client context, factory and FA appointment controls. No factory Add User.
3. **2:00–3:00, IQ Factory Admin:** inspect users, the two Zones, independent Departments/assignments and the explicit Zone-A Auditor grant. Do not revoke a grant during the main walkthrough.
4. **3:00–4:00, IQ Zone Champion:** show factory oversight and absence of FA mutation controls. Do not promise broad task/evidence visibility.
5. **4:00–5:00, IQ Zone Leader:** show Zone B leadership and assigned Zone A Audit. Open `AUD-000001`; show the fictional noncompliance and existing `ACT-000001`. No own-Zone execution authority.
6. **5:00–7:00, IQ Department Member:** Actions → All → `ACT-000001`. Select Immediate or Corrective Action, Start, save actual notes/category/nonnegative savings, upload a real demo file, then submit. No work/evidence/submission was pre-fabricated in the dataset.
7. **7:00–8:00, IQ Department Leader:** open the same task. The recorded selection permits independent review. Send back with a reason; optionally switch DM, restart and resubmit, then DL verify/close if the complete package is valid.
8. **8:00–9:00, IQ Standard User:** show personal Settings, no administration controls/CI creation, and no assigned Action/Audit records initially.
9. **9:00–10:00, FA:** show canonical Dashboard/Reports counts reflecting work and retained task/source history. Explain the explicitly restricted other-module scope and that this browser is disposable.

Do not present this proposed walkthrough as accepted behavior until the consolidated browser cycle passes.

## 10. Removed disposable demo data

**Existing browser records removed: zero. Existing browser keys cleared: none.** No browser was inspected or automated, no ordinary OPS snapshot was imported, no existing demo/real/uncertain records were deleted. Earlier live-IQ cleanup manifests describe historical work and were not reused or altered here.

The new `/tmp/ops-final-demo.json` was generated/replaced during offline construction only. Its `removed` array is empty. Fresh unsupported-module collections are initialized empty rather than importing legacy example records.

## 11. Remaining business-policy and implementation blockers

- **Other-module v4 integration is incomplete.** Gemba observation contribution versus walk authority, CI initiation/approval for independent Department roles, Red Tag cross-Zone evaluation, VI approvals and VM board/meeting updates still require their contextual canonical adapters and individually approved Department/Champion boundaries. The existing v4 decision register R07 and phase-8 plan explicitly reserve these projections. The broad PPT permissions do not by themselves supply Department/Champion workflow policy. These modules stay restricted, not apparently functional.
- **Factory module settings** still rely on legacy ABC configuration helpers. FA user/Zone/Department/role/Auditor administration works through existing scoped services; checklist/module configuration migration is not completed here.
- **Champion read scope** remains the existing minimum Department oversight. No new aggregate/detail/evidence privilege is invented.
- **General Action creation/source types and some assignment capacities** remain limited to the protected Audit-origin service. Standard User/FA work capacity has no implemented qualified verifier contract. ZL-owner work needs two independent FAs; this eight-persona dataset deliberately uses DM work instead.
- **Admin deletion** remains the existing protected policy: legacy Admin in compatible scope. V4 FA deletion is not silently inferred; its menu remains absent. No new delete authority or cascade is introduced.
- **Role revocation/Department deactivation** remain blocked by the incomplete unfinished-work dependency index. Auditor grant revocation remains its existing separate protected workflow.
- Full report library/exports, dashboard analytics and supported-module record/evidence isolation beyond Audit/Action are not certified by this limited authorized projection.
- Before expanding scope, approve each missing Department/Champion contribution, review and evidence boundary; implement its canonical command/read adapters and scoped configuration/deletion contract. No permission workaround is justified for the demonstration.

## 12. Exact files changed in this batch

Prior changes in these files were retained. File inventory compared to a task-start content-hash baseline:

- `app/(app)/settings/page.tsx`
- `components/navigation/active-access-label.tsx`
- `components/navigation/header.tsx`
- `components/navigation/sidebar-nav.tsx`
- `components/navigation/user-menu.tsx`
- `components/ops/access-context-boundary.tsx`
- `docs/QA/OPS-V4-FINAL-DEMO-IMPLEMENTATION.md`
- `features/five-s/administration/access-v3-store.ts`
- `features/five-s/administration/iq-onboarding-panel.tsx`
- `features/five-s/continuous-improvement/store.ts`
- `features/five-s/red-tag/access.ts`
- `features/five-s/red-tag/store.ts`
- `features/gemba/gemba-store.ts`
- `features/ops-dashboard/scoped-workspace.tsx`
- `features/settings/scoped-settings.tsx`
- `features/visual-improvement/visual-improvement-store.ts`
- `features/visual-management/visual-management-access.ts`
- `features/visual-management/visual-management-store.ts`
- `lib/current-user.ts`
- `lib/demo/final-demo.ts`
- `lib/demo/switch-final-persona.ts`
- `lib/legacy-operational-write.ts`
- `scripts/ops-final-demo-launch.mjs`
- `scripts/ops-final-demo-prepare.cjs`

Private construction artifacts: `/tmp/ops-final-demo.json`, `/tmp/ops-final-mvp-baseline.json`, `/tmp/ops-final-mvp-files.json`. No application data file or committed fixture was replaced.

## 13. Deferred consolidated testing checklist

**Requires explicit product-owner approval. No item below was run in this batch.**

- TypeScript, lint and appropriate build; existing complete unit/regression suite after implementation is finalized.
- Launch/reset isolation: ordinary Brave storage byte-for-byte unchanged, no profile/CDP reuse, no global clearing, real IQ unchanged, no unrelated fixture records seeded.
- All eight identity switches from each role; immediate name/avatar/role/navigation/Settings/scope changes, no restart, no stale dialogs or asynchronous evidence authority. Refresh, Back/Forward and direct record links; no hydration mismatch/flicker or relevant console errors.
- SA/CA operational write denial through commands and UI; no inherited factory authority. FA scoped administration; Champion no FA controls; DL exact Department allocation; DM/Standard no admin. Inactive memberships and malformed/revoked context fail closed.
- All/status task counts, filters and records agree; open, refresh, cross-module and same-module sidebar return select All. Every authorized status is included; unsupported routes remain restricted.
- Audit schedule/start/setup/save, exact other-Zone grant and own-Zone prohibition, grant revocation and reassignment history; no DM/DL Audit execution or source-detail leakage.
- D10 idempotence/exact links, current assignment eligibility, Action type selection, Start/Undo, real evidence durability, explicit independent verifier/coordinator, submission/rework/resubmission/closure, stale revision, quota/recovery and source reverse links.
- Scoped Dashboard/Reports counts match authorized canonical records and current entitlement changes; no ABC/unrelated tenant rows/titles/files/metrics.
- Legacy Red Tag cross-Zone restrictions and retained workflows; legacy CI/Gemba/VI/VM persistence and passive migrations under the new guard, including identity changes during async migration. Admin deletion retains existing limitations and history.
- Repeat dataset construction preserves stable persona IDs, future dates, valid independent assignments and empty unsupported-module collections; reset returns initial generated state.

Actually performed: targeted repository/specification inspection, source edits, task-start hash inventory comparison and offline canonical dataset construction via `node scripts/ops-final-demo-prepare.cjs /tmp/ops-final-demo.json`. An initial construction attempt correctly rejected scheduling FA as an ungranted Auditor; the builder now uses the existing permitted direct-FA start for the Zone-B example. A subsequent source inspection replaced legacy Zone construction with the existing canonical v4 Zone command. These construction steps are not browser or regression acceptance. No Vitest, Playwright execution, browser automation, TypeScript check, lint, build or new automated test files.
