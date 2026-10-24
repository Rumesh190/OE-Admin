# OE Egmore Client Demo Readiness

## Status

Source inspection and implementation are complete for the scoped development dataset. Automated checks and browser acceptance were intentionally deferred by the product brief. No item in this report is labelled verified or demo ready.

## Egmore factory configuration

- Client: `abc-manufacturing` — ABC Manufacturing
- Factory: `PLANT-EGM` — Egmore Plant, Chennai
- Preparation is development-only and available to Metric Mind in platform Settings.
- The preparation command uses the existing canonical browser stores, preserves records with unrelated IDs, reconciles stable Egmore demo IDs, and writes an explicit disposable manifest at `ops-egmore-client-demo-v1`.
- No global storage reset is used.
- The development preparation raises Egmore's maximum active-user limit to at least 30 without reducing a higher existing limit. It ensures the ten-person roster below exists and preserves additional stored profiles. The source fallback directory contains 24 active Egmore profiles; the exact active browser count therefore remains an acceptance-cycle check.

## Enabled modules

The preparation action updates only `PLANT-EGM` in the canonical factory entitlement state. It enables Gemba, Red Tag, Continuous Improvement, Audit, Visual Improvement, Visual Management, Actions and Reports. The retired Red Flag capability remains disabled. No entitlement for Tambaram, IQ, Mitsubishi or Hyundai is changed.

## Demo user directory and assignments

The source directory retains all existing ABC profiles. The preparation action reconciles this ten-person demonstration roster without duplicating identities:

| Person | Base factory role | Zone | Independent responsibility |
|---|---|---|---|
| Lakshman | Zone Leader | Zone A | Factory Admin; Auditor for Zones B, C and D |
| Rumesh | Zone Leader | Zone B | Auditor for Zones A, C and D |
| Manoj Guru | Zone Leader | Zone C | Zone leadership |
| Anand | Zone Leader | Zone D | Existing Zone D leadership preserved |
| Ritika | Zone Member | Zone A | Zone Champion; Assembly Department Member |
| James | Zone Member | Zone A | Assembly Department Leader |
| Siva Kumar | Zone Member | Zone B | Quality / Inspection Department Leader |
| Madavan | Zone Member | Zone C | Maintenance Department Leader |
| Meena | Zone Member | Zone D | Warehouse / Dispatch Department Leader |
| Gurumurthi | Standard User | None | Standard factory access |

Metric Mind and ABC Manufacturing Admin retain their existing platform/client identities. The Auditor grants omit the Auditor's own led Zone, so the existing own-Zone execution restriction remains meaningful.

## Zones and Departments

Existing Zone IDs and leadership are retained:

- `ZONE-A` — Zone A, led by Lakshman
- `ZONE-B` — Zone B, led by Rumesh
- `ZONE-C` — Zone C, led by Manoj Guru
- `ZONE-D` — Zone D, led by Anand

Stable independent Departments are reconciled beneath those Zones:

- `DEPT-EGM-ZA-ASSEMBLY` — Assembly
- `DEPT-EGM-ZB-QUALITY` — Quality / Inspection
- `DEPT-EGM-ZC-MAINT` — Maintenance
- `DEPT-EGM-ZD-WAREHOUSE` — Warehouse / Dispatch

## Operational record coverage

| Module | Prepared canonical coverage | Readiness |
|---|---|---|
| Gemba | 4 walks and 15 observations across Zones A–D; issue, positive and opportunity observations; two linked Actions | IMPLEMENTED — UNTESTED |
| Red Tag | 12 stable Egmore records plus preserved unrelated records; Open, Under Review, Decision Made, Disposition In Progress, Awaiting Verification and Closed examples | IMPLEMENTED — UNTESTED |
| Continuous Improvement | 12 stable proposals covering draft, submitted, review, approved, in progress, hold, rejected, completion review and completed states | IMPLEMENTED — UNTESTED |
| Visual Improvement | 8 stable records covering Draft, Planned, In Progress, Submitted, Returned and Completed states | IMPLEMENTED — UNTESTED |
| Visual Management | 6 boards, 4 meetings, 5 topics, 1 decision and 2 escalations with existing Action/CI/Red Flag links | IMPLEMENTED — UNTESTED |
| 5S Audit | 11 Egmore completed Audits from the canonical audit fixture, plus existing preserved browser records | PARTIALLY IMPLEMENTED — UNTESTED |
| Actions | 30 canonical Actions with varied statuses, owners, priorities, sources and due dates | IMPLEMENTED — UNTESTED |
| Dashboard | Existing factory-scoped dashboard consumes canonical module and Action stores | PARTIALLY IMPLEMENTED — UNTESTED |
| Reports | Existing report views consume canonical records and factory context; no static Egmore KPI totals were added | PARTIALLY IMPLEMENTED — UNTESTED |

The requested approximate totals are reached for Gemba, Red Tag, Continuous Improvement, Visual Improvement, Visual Management, Audit and Actions. The canonical Audit fixture is weighted toward completed Audits, which remains an acceptance-cycle limitation rather than a hidden total.

## Cross-module relationships

- Gemba observations reference existing Actions such as `ACT-GEM-014-01` and `ACT-GEM-014-02`.
- Visual Management topics and decisions retain links to `ACT-VM-001`, `CI-2026-013` and historical Red Flag records.
- Continuous and Visual Improvement records retain their existing Action IDs where the source fixtures define them.
- Audit findings and Actions continue to use the canonical Audit/Action models.
- The new Red Tag records do not invent Action links. Red Tag Action linking must be demonstrated live through the existing workflow so every link points to an actually created canonical Action.

## Dashboard and Reports coverage

The prepared records provide real status, priority, date, Zone, owner, Audit-score and escalation distributions. The existing Dashboard and Reports code remains the source of truth; the preparation command does not write aggregate counters or chart values. Unsupported metrics must continue to render their existing unavailable state.

Source inspection found canonical inputs for Action status/priority/source distributions, Egmore Audit trends and Zone comparisons, CI/Visual Improvement states, Gemba observations, Red Tag lifecycle states and Visual Management escalations. Runtime agreement between cards, charts and drill-down lists remains deferred to browser acceptance.

## Live creation flow status

| Flow | Existing route/entry point | Status |
|---|---|---|
| Gemba walk and observation | `/gemba/new`, then walk detail | IMPLEMENTED — UNTESTED |
| Red Tag | `/5s/red/create` and Gemba observation shortcut | IMPLEMENTED — UNTESTED |
| Continuous Improvement | `/continuous-improvement/new` | IMPLEMENTED — UNTESTED |
| Visual Improvement | `/visual-improvement/new` | IMPLEMENTED — UNTESTED |
| Visual Management | Board meeting mode, topics, escalations and follow-ups | IMPLEMENTED — UNTESTED |
| 5S Audit | Existing Audit create/start surface | IMPLEMENTED — UNTESTED |
| General/linked Action | Shared Action creation and source-linked dialogs | IMPLEMENTED — UNTESTED |

Creation uses the existing stores and serialized record-ID allocator. Approval, review, verification and workflow transitions still use their existing role-specific commands. A previously approved MVP compatibility rule allows active factory users to open module creation flows; it does not grant approval, Audit execution or Action verification authority. This is broader creation access than the latest brief requests and should be resolved as a product decision before backend authorization is finalized.

## Role switching walkthrough

1. Use the existing top-right profile switcher and select Metric Mind → Platform Administration.
2. Open Settings and run **Prepare Egmore Demo Data**.
3. Select ABC Manufacturing → Egmore Plant in the existing context selector.
4. Switch among the canonical Egmore profiles. Each switch should recompute context, navigation and factory-scoped data.
5. Use Lakshman for Factory Administration and cross-Zone Audit work.
6. Use Rumesh for Zone B leadership and an Audit in Zone A, C or D.
7. Use Ritika to demonstrate Zone Champion access without Factory Admin authority.
8. Use James or Siva Kumar for Department leadership; use a Department Member/Standard User profile for assigned work.

## Initialization and reset

Prepare:

1. Run the application in development mode.
2. Switch to Metric Mind → Platform Administration.
3. Open `/settings`.
4. Select **Prepare Egmore Demo Data**.
5. Wait for the success message, then select ABC Manufacturing → Egmore Plant.

The command atomically reconciles only Egmore directory entries, factory configuration, module records, memberships, Departments, assignments, Auditor grants and factory entitlements. It records the stable IDs and affected storage keys in `ops-egmore-client-demo-v1`.

Reset:

1. Return to Metric Mind → Platform Administration → Settings.
2. Select **Reset Egmore Demo Data**.
3. Confirm **Restore demo baseline**.

Reset restores only the stable dataset IDs and leaves unmarked records untouched. It does not call `localStorage.clear()` and does not remove another client's or factory's data.

## Fifteen-minute client demonstration script

1. **0:00–2:00 — Metric Mind:** select ABC Manufacturing → Egmore Plant, show the enabled-module list and explain factory-level entitlements.
2. **2:00–4:00 — Dashboard:** show current work, Action status/priority mix, Audit activity and factory scope.
3. **4:00–6:00 — Reports:** filter Egmore by period/Zone and open supporting records rather than presenting static totals.
4. **6:00–8:00 — Gemba and Red Tag:** open a populated walk, inspect its observations and linked Actions, then create a Red Tag from an observation or the Red Tag create page.
5. **8:00–10:00 — Role switch:** switch to Rumesh and start only an eligible cross-Zone Audit. Record a noncompliance and create the supported corrective Action if eligible assignments are available.
6. **10:00–12:00 — Action execution:** switch to the selected owner, open the assigned Action, update it through the permitted lifecycle and add valid evidence.
7. **12:00–13:30 — Independent review:** switch to the recorded verifier and demonstrate only the transition permitted by the existing authorization snapshot.
8. **13:30–15:00 — Improvement system:** show CI, Visual Improvement and Visual Management records, then return to Dashboard/Reports to show data sourced from the canonical records.

Do not force a terminal transition when evidence or an eligible verifier is unavailable during the demonstration.

## Known limitations and blockers

- Browser-local persistence is a demo mechanism, not server authorization or multi-user synchronization.
- The preparation command was source-reviewed only; it has not been executed in the active browser under this batch's testing constraint.
- The Audit seed is rich in completed history but does not yet provide the requested balance of Scheduled and In Progress Egmore Audits.
- The existing source data contains historical non-Egmore Audit fixtures. Factory scoping must be checked in the final browser cycle.
- Red Tag demo records intentionally avoid fabricated Action links; demonstrate canonical linking live.
- Dynamic role visibility, own-Zone Audit prevention, Dashboard recalculation, report drill-down agreement and persistence after refresh remain unverified.
- Broad active-user creation compatibility remains enabled from the earlier approved demo MVP requirement; approval and verification rules remain restricted.

## Files changed for this implementation

- `lib/demo/egmore-demo-data.ts`
- `features/settings/egmore-demo-controls.tsx`
- `features/settings/scoped-settings.tsx`
- `lib/records/module-records.ts`
- `features/gemba/gemba-store.ts`
- `features/five-s/continuous-improvement/store.ts`
- `features/visual-improvement/visual-improvement-store.ts`
- `features/visual-management/visual-management-store.ts`
- `docs/QA/OE-EGMORE-CLIENT-DEMO-READINESS.md`

## Deferred final testing checklist

- Prepare twice and confirm counts do not increase.
- Confirm the manifest and only the documented storage keys change.
- Confirm 30-seat limit and actual factory membership count agree.
- Confirm all Egmore modules appear and other factory entitlements remain unchanged.
- Exercise every create/list/detail/refresh path in the table above.
- Verify source → Action and Action → source navigation for every existing linked record.
- Verify own-Zone Audit execution is denied and granted cross-Zone execution succeeds.
- Verify Department/Zone/Factory role differences after every profile switch.
- Compare Dashboard cards and Reports totals with their drill-down records.
- Confirm Back/Forward navigation, direct record links, persistence and console state.
- Confirm reset restores stable demo records while preserving a separately created unmarked record.
- Run the consolidated lint, TypeScript, automated test, build and browser acceptance cycle only after implementation batches are complete.
