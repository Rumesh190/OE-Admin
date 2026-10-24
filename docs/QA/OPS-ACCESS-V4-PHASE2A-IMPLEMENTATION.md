# OPS Access v4 — Phase 2A Implementation and Verification

Date: 22 October 2026. Completed scope: isolated proposed models and pure compatibility helpers, with synthetic tests only. No Phase 2B, Phase 3, active-context integration, IQ onboarding, D10 or persistence implementation.

## 1. Files created and source reconciliation

| File | Purpose |
| --- | --- |
| [`features/five-s/administration/access-v4-models.ts`](../../features/five-s/administration/access-v4-models.ts) | Readonly proposed Department, independent assignment, canonical scope and captured work/verifier-history types |
| [`features/five-s/administration/access-v4-compatibility.ts`](../../features/five-s/administration/access-v4-compatibility.ts) | Pure reference descriptions, lifecycle/scope filters, Department checks and exact snapshot comparisons |
| [`tests/access-v4-models.test.ts`](../../tests/access-v4-models.test.ts) | 28 synthetic model/constraint tests |
| [`tests/access-v4-compatibility.test.ts`](../../tests/access-v4-compatibility.test.ts) | 24 synthetic compatibility/purity tests |
| This report | Implementation/verification results, boundary audit and remaining decisions |

All five paths were absent and not ignored before implementation. Task-start `git status --short` and hashes of all existing tracked/untracked, nonignored files were recorded outside the repository. The latest four reconciled architecture documents, Phase 1A report/source/tests and relevant v3 administration/organization/Audit/Action types were inspected. Phase 1A source matches its reported state; its 63 validator and 11 characterization tests passed unchanged. No defect required altering Phase 1A or any existing file.

The architecture documents' older suggested batch numbering is contextual; the latest user brief explicitly authorizes this isolated **Phase 2A** scope. No prior planning proposal is treated as live behavior or approval to activate a role.

## 2. Types introduced

| Area | Public types / representation |
| --- | --- |
| Scope | `FactoryScope`, `ZoneScope`, `DepartmentScope`, `CanonicalScope`, `CanonicalDepartmentReference`, `DepartmentOriginWorkScope` use existing canonical ID field names; no new ID allocation scheme |
| Department | `Department` extends the Phase 1A structural record with name/code, created/updated person/time attribution, optional revision and readonly history-event references. One immutable parent chain; Active/Inactive representation retains identity/history |
| Assignment lifecycle | `AssignmentAttribution`, `AssignmentLifecycle` retain distinct assignment/person fields, original assigner/time, optional revision/history and required actor/time/reason on a Revoked lifecycle |
| Independent assignments | `ZoneChampionAssignment`, `ZoneLeaderAssignment`, `DepartmentLeaderAssignment`, `DepartmentMemberAssignment`, `RoleAssignment`; factory-only Champion, Zone-only ZL and exact Department DL/DM scopes. No Auditor grant, account administration or effective permission is created |
| FA-work designation | `IndependentVerifierDesignation` includes exactly one Action ID and explicit Client/Factory/person scope plus attribution/lifecycle; no wildcard factory-wide grant or inferred eligibility |
| Work capacity | `WorkCapacitySnapshot` captures Action/person, one exact role-assignment ID, its role/scope and actual capture actor/time. Other simultaneous roles do not replace the captured capacity |
| Verification history | `VerifierSelectionSnapshot` retains one selected person, Action/scope, explicit verifier-authorization and coordinator-authorization references/time; `VerifierReplacementHistoryEvent` retains both previous and replacement selections with actor/time/reason |
| Compatibility outcomes | `CompatibilityResult`, `CompatibilityProblem`, `DepartmentDefinitionResult` are local description/check shapes, not persisted schemas or operational permission decisions |

All model fields and nested references/arrays are readonly. These are **proposed in-memory schemas**, not storage readers/writers, migrations, live grants or a second directory/Action system. Existing v3 Inactive membership/role representations remain untouched; the new proposed assignment lifecycle represents Active/Revoked with explicit retained revocation metadata.

## 3. Pure helpers implemented

| Function | Behavior and limit |
| --- | --- |
| `describeZoneDepartment` | Distinguishes legacy display string from an explicitly supplied canonical Department reference; no matching by name or fabricated Department |
| `describeAuditDepartment` | Same explicit-reference resolution while retaining the entire supplied Audit snapshot, including unrelated signature/assignment history |
| `describeZoneLeadership` | Preserves original legacy leader/allocation data beside explicit multi-leader lifecycles; never derives an assignment from `leaderId`, replaces the old leader or normalizes historical allocations |
| `describeActionReviewer` | Retains legacy reviewer ID/name/auditor/history beside an explicitly referenced verifier selection; never selects, appoints or replaces a reviewer |
| `isActiveAssignment` | Identifies an Active status only; not effective eligibility or authority |
| `filterActiveRoleAssignments` | Filters supplied role rows by Active status and **exact** explicit scope; factory Champion does not become Zone/Department membership |
| `validateProposedRoleAssignment` | Reuses unchanged Phase 1A checks for the proposed tuple, supplied eligibility and relevant active conflicts; no history normalization or role inference |
| `hasSameDepartmentIdentity` | Compares canonical Department ID and immutable Client/Factory/Zone parent identity; display-name/status changes do not change identity. Does not implement an update/transfer command |
| `validateDepartmentForNewAssignment` | Reuses Phase 1A parent-chain validation and explicit Department status; no unfinished-work scan, membership eligibility or lifecycle mutation |
| `validateDepartmentDefinition` | Validates explicit parent identities/nonempty name/code and proposed case-insensitive active name/code uniqueness per parent Zone; rejects reuse of a supplied existing Department ID. Does not reserve names or create a record |
| `matchesRecordedWorkCapacity` | Compares exact role-assignment ID/person/capacity/scope. Retained capacity may still match a now-revoked historical assignment; this does not authorize current work |
| `matchesActionSpecificDesignation` | Matches one active designation to exact requested Action/Client/Factory/person; no qualifications, coordinator rights or verifier authority inferred |

Compatibility results explicitly distinguish `legacy-only` (retained information, no canonical resolution), `v4-reference` (a supplied reference resolves structurally) and `unresolved` with `MISSING_REFERENCE`, `UNRESOLVED_REFERENCE`, `AMBIGUOUS_REFERENCE` or `PARENT_CONFLICT`. An explicit invalid v4 reference never falls back to a legacy name/leader/reviewer. No missing Client/Factory scope defaults to ABC.

Historical identity descriptions allow inactive records/parents to remain identifiable; new-assignment checks require active parent/status facts. Describing retained data does not authorize a real actor to read it: current/legacy read policies remain separate. Selection authorization references are retained opaque facts, not resolved into qualifications. Models/helpers are typed structural utilities, not parsers for untrusted persisted JSON.

Department definition adds `DUPLICATE_DEPARTMENT_ID`, `DUPLICATE_DEPARTMENT_NAME` and `DUPLICATE_DEPARTMENT_CODE` to relevant reused Phase 1A violation codes. Its uniqueness checks concern proposed active records supplied explicitly; historical inactive identity is retained. Parent immutability/no hard deletion are represented by readonly identity and retained history, not implemented as runtime mutation guards. R08 dependency coverage remains future work.

## 4. Approved invariants versus proposed technical details

Approved cardinality/scope rules are exercised through the existing Phase 1A validator: multiple Champions/Factory and ZLs/Zone; one actively led Zone/person/Factory; multiple DLs/DMs; same-Zone multiple Departments; ZL Department alignment; no cross-Zone Department allocation; independent roles without inherited powers. Department work origin and person-ID-based verifier histories are represented without adding Action statuses or operations.

Technical details remain proposed: exact TypeScript field/layout names, lifecycle metadata shape, snapshot/reference discriminators, optional revision/history fields, result/error shapes and proposed active Department name/code uniqueness. No persisted version, storage key, transaction, migration or live read adapter was approved or implemented. No helper establishes coordinator/verifier eligibility, choosing among multiple work capacities, replacement authority or domain mutation rights.

## 5. Actual test and verification results

Tests ran in the requested sequence. The earlier 27-test model pass preceded the final canonical-ID-reuse edge case; current counts are below.

| Command | Result |
| --- | --- |
| `npx vitest run tests/access-v4-models.test.ts` | **28 passed**, 1 file |
| `npx vitest run tests/access-v4-compatibility.test.ts` | **24 passed**, 1 file |
| `npx vitest run tests/access-v4-validators.test.ts` | **63 passed**, 1 file |
| `npx vitest run tests/access-v4-legacy-characterization.test.ts` | **11 passed**, 1 file |
| `npx vitest run tests/access-v3-phase1.test.ts tests/access-v3-phase2.test.ts` | **60 passed**, 2 files |
| `npx vitest run tests/audit-independent-action-closure.test.ts tests/action-plan-creation.test.ts tests/action-store.characterization.test.ts tests/action-plan-execution-types.test.ts tests/action-start-undo.test.ts tests/audit-evidence-quota.test.ts tests/action-evidence-quota.test.ts` | **107 passed**, 7 files |
| `npx tsc --noEmit --incremental false` | Passed; no compiler cache written |
| `npm run lint -- features/five-s/administration/access-v4-models.ts features/five-s/administration/access-v4-compatibility.ts tests/access-v4-models.test.ts tests/access-v4-compatibility.test.ts` | Passed on all changed TypeScript files |
| `git diff --check` and explicit untracked-file whitespace checks | Passed |
| Task-start hash comparison, report links and import-boundary checks | Passed; only five permitted new files; every pre-existing file preserved |

**52 new tests + 241 unchanged regression tests = 293 passed.** Tests cover active/ended lifecycles, independent role cardinality, Department chain/uniqueness/parent identity, work-capacity binding, single-Action designation, historical selection retention, legacy snapshots/unknown refs, foreign/missing/ambiguous scope, frozen inputs and deterministic outputs. No test expectations or existing fixture utilities were changed.

No browser acceptance, full-unit-suite run, build or full-repository lint was performed. Existing regression suites use their established synthetic in-memory storage stubs in the Node test runner, not active user browser records. The new tests are entirely pure synthetic fixtures and require no browser/storage/session setup. Unit success does not establish production authorization, tenant isolation, live schema compatibility or runtime integration readiness.

## 6. Existing-file preservation and runtime isolation

Final task-start hash comparison confirms only the five new files listed above were added; all pre-existing tracked/untracked nonignored files remain byte-identical, including Phase 1A, v3 code/tests, architecture documents and existing local work. Ordinary Git diff was supplemented with new-file checks because untracked contents are absent from that diff.

`access-v4-models.ts` imports only Phase 1A types. `access-v4-compatibility.ts` imports only Phase 1A pure validation and types from the new isolated model module. No mutable administration/organization/Action/Audit store, current user/session hook, entitlement reader, browser API, network, clock or ID generator is imported or accessed. Neither new module is imported by any pre-existing production file; references are limited to the new isolated modules/tests. No barrel export or runtime wiring was added.

No live client/factory/Zone/Department/person/role/Action/Audit records were created. In-memory synthetic test values are not application records. No entitlement, subscription, navigation, scoring, evidence/signature, leadership/grant, reviewer/revision/history, storage key/payload, recovery journal or migration changed. No browser state was inspected/reset; no commit/push/merge/deploy occurred.

## 7. Remaining R01–R10 implications

- **R01:** coordinator qualification and verifier replacement authority/pending-review handling unresolved. Snapshots/history represent references and retain previous selection without authorizing replacement.
- **R02:** detailed eligible owner/work-capacity choice unresolved. Captured exact references are compared, never inferred from highest/global role, UI selection or names.
- **R03:** independent FA-work verifier qualifications unresolved. An active exact-Action designation match is not sufficient authorization or proof of independence/eligibility.
- **R04:** escalation resolution/cancellation remains unimplemented; no new escalation workflow/model engine added in this scope.
- **R05:** SLA clock/reset/notification delivery guarantees remain unimplemented; no timers, outbox or notification engine introduced.
- **R06:** production legacy policy/read/storage adapters, version/transaction/recovery and concurrent asset handling remain unresolved. Pure descriptions are not migrations, storage adapters or normalization pipelines.
- **R07:** detailed Department allocation and Champion/retained-read permissions remain external; exact-scope filtering grants no access.
- **R08:** unfinished-work dependency coverage, deactivation/deletion/revocation guards and authorized transfer remain future contracts. No scans or mutation commands added.
- **R09:** final IQ operational configuration and first-FA bootstrap remain unimplemented; no records or activation created.
- **R10:** reviewed existing-person cross-client attachment authority/process remains unresolved; no client membership inferred or added.

## 8. Recommended next batch and stop

Smallest safe next task: separately approve concrete R06 storage/legacy read/transaction compatibility contracts and the R01–R03 qualification/selection matrices, using these isolated models/tests as review material. After those approvals, a smallest candidate Phase 2B implementation batch is isolated versioned-payload validation and recovery dry-run tests against synthetic old/new payloads, without live persistence or authorization replacement. It still requires a new explicit scope and approval; no Phase 2B persistent-model or Phase 3 runtime integration can be inferred from these data shapes.

Stop after Phase 2A. Do not begin Phase 2B, Phase 3, D10, IQ onboarding or entitlement activation.
