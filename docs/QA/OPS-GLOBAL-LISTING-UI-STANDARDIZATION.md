# OPS global listing UI standardization

## Existing UI inventory (before implementation)

| Module | Navigation and data source | Existing list behavior |
| --- | --- | --- |
| Gemba | OpsTabBar; visible walks and their observations | Overview, walks, observations; separate record tables; search/status/type filters; newest first; mobile cards |
| Red Tag | RedTagNav; useRedTags snapshot | Overview, Red Tags (already all statuses), Awaiting Closure, Closed, Settings; search/status/section/reason/person/date; mobile cards |
| Actions | OpsTabBar; canonical action store through getRoleVisibleActions | My Actions, Created by Me, privileged Team Actions, Awaiting Review, Completed, Settings; URL filters; summary quick scopes; OpsFilterBar/OpsDataTable |
| CI | ImprovementTabs delegates to OpsTabBar; canViewImprovement | Overview, Improvements (all), Review Queue, Completed; pipeline/table, stage/search/plant/zone/people/benefit/date/sort |
| Audit | AuditNav; existing audit snapshot | All audits and Settings; lifecycle/search/plant/department/date filters; mobile cards; filter bar inside header |
| Visual Improvement | Custom tab renderer; canViewVisualImprovement | Overview, Improvements (all), Gallery, Awaiting Review, Completed; search/status/category/location/owner/date/benefit/sort |
| Visual Management | OpsTabBar plus Base UI meeting tabs; existing visibility helpers | Overview, Boards (all), Meetings (Upcoming/Calendar/History), Settings; boards and meetings remain distinct |
| Reports | OpsTabBar; buildReportLibrary from visible canonical sources | All and enabled module tabs; module/plant/zone/date/generator/status/search/sort/export; no placeholder counts |

## Scope and source of truth

Presentation and read-only listing selectors only. Existing stores, access helpers, statuses, workflows and record formats remain authoritative. The Action detail page already had an uncommitted change at task start and is outside this task. Historical Red Tag direct handling remains supported; its removed creation button is not restored.

## Shared presentation architecture

- `components/ops/ops-listing.tsx`: `OpsListingLayout` reuses PageContainer; `OPS_LISTING_TABLE` gives scoped listing tables consistent headers, spacing, dividers and hover treatment. `OpsListingToolbar` supplies search/filter wrapping and a visible Clear Filters control on new VM list toolbars.
- `components/ops/ops-tabs.tsx`: one tab renderer with token-based active underline, counts, focus styling, contained horizontal scrolling and manual keyboard activation (Left/Right/Home/End to focus, Enter/Space to activate buttons; Enter for links).
- `components/ops/ops-filter-bar.tsx`: existing expandable Action filter bar now supports visible clearing without opening More filters.
- Existing OpsDataTable, OpsEmptyState, domain columns, badges, mobile cards and module filter controls are reused.
- `useUrlState` accepts an optional push mode for scope navigation; its existing replace default stays unchanged. `useListingFilter` keeps read-only filters in the URL across list remounts and reloads. No store or business record changes.

## Final navigation

| Module | Final tabs |
| --- | --- |
| Gemba | Overview, All Walks, All Observations; Received Deployments remains a separate observation subview |
| Red Tag | Overview, All, Under Review, Awaiting Closure, Closed, Settings |
| Actions | All (default), My Actions, Created by Me, Team Actions for existing eligible roles, Awaiting Review, Completed, Settings |
| CI | Overview, All, Proposals, In Progress, Under Review (existing review queue), Completed |
| Audit | All, Scheduled, Draft, In Progress, Review, Completed, Settings; existing lifecycle order retained |
| Visual Improvement | Overview, All, Gallery, Awaiting Review, Completed |
| Visual Management | Overview, All Boards, All Meetings, Settings; Meetings provides All actual meetings, Upcoming schedules, Calendar and History |
| Reports | All plus the existing six active report modules: Gemba, Continuous Improvement, Red Tag, Audit, Actions and Visual Management |

Existing tab IDs and routes are retained wherever possible. No new routes were introduced. CI's Under Review keeps the existing Review Queue scope (submitted, under_review, on_hold, awaiting_completion_review); Proposals uses draft/submitted and In Progress uses in_progress. No statuses are merged or renamed in persistence. Audit Review remains its existing computed presentation stage. The raw persisted Draft status is explicitly recognized by listing filters and counts without changing the workflow helper.

## All-tab behavior and data integrity

- All Actions delegates to the existing role-visible selector, includes all ten supported persisted statuses, and supplies its count from that same selector. My Actions and Created by Me now include completed records in their ownership/creator scopes, as requested. Existing review authority and privileged Team Actions behavior remain unchanged.
- Red Tag All already included every supported status; it is now named All, with an explicit Under Review view (Open and Under Review) alongside existing closure views. Legacy tags and historical disposition data remain supported.
- CI and Visual Improvement All retain their existing visibility checks and include every supported stage, including rejected/returned and completed records.
- Gemba still uses visible walks and observations attached to those walks. Walks and observations remain separate tables. Existing Received Deployments behavior is retained.
- VM All Boards uses existing board visibility. All Meetings displays every authorized persisted meeting, including In Progress and Completed. Scheduled occurrences remain in Upcoming/Calendar because they are schedule records, not executed meeting records.
- Reports All consumes the existing canonical report-library builder with the existing entitlement and visibility filtering. The active registry deliberately excludes legacy Red Flag / Visual Improvement library categories; their existing direct report routes remain unchanged. Module tabs and counts share the same library.
- No access helper, workflow store, persisted status, record shape, storage key, ID, migration or fixture was changed. Existing browser-local/demo access limitations remain as implemented; this task does not add backend authorization.

## Search, filter and sorting behavior

Search remains first in the toolbar. Existing module-specific filters, sorts and meaningful columns remain available. New VM toolbars add search and existing status filters. Clear controls reset filters without mutating records. Existing newest-created-first helpers remain the default; legacy missing dates retain the existing fallback ordering. Pagination/list navigation is retained as implemented (the affected lists do not gain artificial pagination).

Action scope changes clear contradictory status/overdue filters while retaining search and other filters. CI/VI scope changes clear contradictory stage/status filters and preserve the remaining URL filters. Scoped CI/VI views ignore hidden status controls. Red Tag links carry search/section/reason/person/date filters between status routes, dropping the previous status filter. Audit lifecycle tabs override the status selector visibly and reset its stored filter on tab changes. Report module tab changes clear a previously selected module filter.

## Overview exclusions and before/after

Overview charts, KPI calculations, zone rankings, pipelines and board visualizations retain their existing implementations. Shared tab and shell presentation is applied without replacing dashboard content. Reports and VI tabs now sit directly below their headers. Audit filters moved below the navigation rather than remaining inside the page header. VI's independent tab renderer now delegates to OpsTabBar. Actions no longer forces long titles to overflow into the Source column; the title can wrap and retains its full accessible text.

## Verification results

Validation was performed locally on 21 October 2026. Final automated results:

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed; rerun after build generation completed |
| `npm run lint` | Passed, 0 errors and 10 existing warnings in untouched files |
| `npm run build -- --webpack` | Passed |
| `npx vitest run` | 129 files, 1,259 tests passed |
| `git diff --check` | Passed |
| Listing browser acceptance | 9 tests passed, including 50 route/viewport combinations, all-status Action fixtures, count integrity, search/clear/reload, Back/Forward and CI filter persistence; additional status-count/subset acceptance across Red Tag, Audit, CI and VI |
| Existing browser regressions | 6 passed: Action Type execution/reassignment, Red Tag cross-Zone/Keep flows, report/filter interactions; each at 320px and 1440px |

Browser tests use the existing local Chrome for Testing executable and a task-owned loopback server. The initial sandbox server launch failed with EPERM and the installed Brave executable could not launch; the local test Chrome completed successfully. Initial obsolete label assertions and count-badge locators were corrected. The first seeded Action count test expected only its ten fixtures; it now checks the full displayed count against actual authorized rendered rows while separately checking all ten synthetic status records. The application intentionally preserves its demo seeds. An additional browser check caught a real Red Tag query-only navigation issue; All/Under Review now use the shared URL-state update on the same listing route. Status-route links remain links and carry the non-status filters. The subset check also excludes Audit’s non-record empty-state row when comparing record counts. No tests were skipped or weakened.

The first concurrent standalone type check raced Next's generated type cleanup during the build; the standalone check was rerun after build generation rather than changing TypeScript configuration.

Initial responsive acceptance: all ten listing routes passed at 1440, 1024, 768, 390 and 320px, with keyboard focus checks, no horizontal page overflow, no clipped controls, no unnamed buttons and no page errors. Desktop and narrow-mobile screenshots were generated in Playwright's per-run test-results directory (regenerated on subsequent runs); representative Action desktop and CI narrow-mobile screens were visually inspected. Wide tables retain contained scrolling and mobile cards remain available.

## Known limitations

- Existing local/demo permission and persistence behavior is preserved; the work does not implement multi-user or cross-device synchronization.
- VM scheduled occurrences and persisted meetings remain distinct views; All actual meetings does not fabricate execution records from schedules.
- Overview dashboards remain module-specific. Some established module filter layouts and mobile cards retain their domain-specific structure while sharing tabs, shell, table tokens and clearing behavior.
- Tab counts describe the authorized tab dataset before search/additional filters, while the rendered list reflects the active filters.
- Historical Red Tag Direct Handling remains supported without restoring its removed creation button, following the earlier explicit user request.

## Manual UAT checklist

- [ ] Review all module tabs at desktop and mobile widths, including focus/hover and count badges.
- [ ] Verify All includes supported legacy, completed and closed records for each intended role.
- [ ] Combine search and location/status/owner filters, switch scopes, clear filters and reload.
- [ ] Use browser Back/Forward, open records and return to lists.
- [ ] Check Gemba walk/observation separation and Gemba → Red Tag / CI creation.
- [ ] Check all seven Red Tag decisions, Keep closure, linked Actions, verification, history and QR printing.
- [ ] Check CI approvals, benefits, completion review and linked records.
- [ ] Check Audit creation, scheduling, draft continuation, scoring, evidence and reporting.
- [ ] Check Immediate/Corrective Action Type execution, reviewer authority and reassignment.
- [ ] Check VM board metrics, meeting scheduling/execution, escalations and Action links.
- [ ] Check report source navigation, CSV export, report print/export and entitlement visibility.
- [ ] Confirm Overview dashboards retain expected data and interactions.

Manual UAT approval remains pending. No commit, push, merge or deployment was performed.

## Mandatory All defaults — follow-up

The main module entry defaults are now:

| Entry | Selected tab |
| --- | --- |
| `/gemba` | All Walks |
| `/5s/red` | All |
| `/continuous-improvement` | All |
| `/audits` | All |
| `/actions` | All |
| `/visual-improvement` | All |
| `/visual-management` | All Boards |
| `/reports` | All |

Visual Management's existing Overview is available at `/visual-management?tab=overview`; Boards and Meetings remain separate listing types. No workflow routes were removed.

`lib/navigation/listing-defaults.ts` defines the exact listing routes eligible for reload normalization. `ListingDefaultsInitScript` runs before application markup and only handles an actual browser reload. It replaces a non-default listing URL with its All entry and removes tab/status/stage/view/due scope filters. Search and unrelated location/source filters remain intact. The stale document is hidden during replacement so a previously selected tab is not painted or hydrated. A normal navigation or browser Back/Forward is never normalized. Explicit query-tab links therefore remain usable during navigation.

Dedicated record/detail/report/settings paths are excluded. Audit record deep links using `?audit=...` are also excluded. Main sidebar links use canonical module entries; same-path sidebar clicks explicitly notify existing URL subscribers and select All, clearing the previous scope and filters. Modifier-click/new-tab behavior remains native.

Inspection found no saved listing-tab preference in localStorage or sessionStorage. This implementation adds no storage-backed preference and does not clear unrelated storage. Tab URLs represent explicit current navigation, not a saved default.

Follow-up validation:

- `npx tsc --noEmit`: passed in the working repository.
- `npm run lint`: passed with the same 10 existing warnings and no errors.
- `npx vitest run`: 130 files, 1,269 tests passed.
- `npm run build -- --webpack`: passed in an isolated copy of the current source.
- Nine new browser tests passed across all eight module entries, including refresh from Overview/status tabs, sidebar re-entry, cross-module return, explicit observation deep links, record-detail reload and Back/Forward. Reload animation-frame sampling found no non-All selected-tab paint, and no page/hydration errors were recorded.
- Existing listing acceptance suite: all nine tests passed, including all authorized Action statuses, counts, search/clear, scope subsets, navigation and responsive geometry at 1440, 1024, 768, 390 and 320px. Follow-up browser total: 18 tests passed (nine defaults tests plus nine existing listing tests).
- `git diff --check`: passed.

An existing development server was detected and left running. Browser and build validation used `/private/tmp/ops-defaults-qa`, an isolated copy without environment files, reusing the existing dependencies and Chrome for Testing executable. Its dev command uses webpack because Turbopack disallows the external dependency symlink. No repository configuration was changed for that workaround.

Manual UAT remains pending. No commit, push, merge or deployment was performed.
