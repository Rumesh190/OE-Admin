# OPS Access v4 — Phase 1A Implementation and Verification

Date: 22 October 2026. Scope: standalone pure validation and isolated regression characterization only. Phase 1A is complete within this boundary; no runtime integration, policy replacement, persistence, IQ onboarding or D10 is implemented.

## A. Files created

| File | Purpose |
| --- | --- |
| [`features/five-s/administration/access-v4-validators.ts`](../../features/five-s/administration/access-v4-validators.ts) | Import-free structural inputs, stable violations and six pure validator entry points |
| [`tests/access-v4-validators.test.ts`](../../tests/access-v4-validators.test.ts) | 63 positive/negative, scope/cardinality, frozen-input and determinism tests |
| [`tests/access-v4-legacy-characterization.test.ts`](../../tests/access-v4-legacy-characterization.test.ts) | 11 tests exercising unchanged v3 policy bodies with synthetic read-only dependencies |
| This report | Implementation scope, actual verification and remaining policy gates |

All four paths were absent and not ignored at task start. No existing production, test, fixture, architecture document or configuration file was overwritten. The task-start Git status and file hashes were recorded outside the repository before changes.

## B. Implemented validators and boundaries

All validators return `{ valid, violations }`; each violation contains a stable code and relevant canonical record IDs. They accept readonly structural inputs, allocate only ordinary result arrays/objects, and do not mutate supplied data. IDs are exact strings resolved against explicit input catalogs; there is no display-name matching, prefix-derived identity, implicit ownership, default tenant or legacy-string-to-Department conversion.

| Function / requested area | Implemented structural checks |
| --- | --- |
| `validateOrganizationalParentChain` — A | Exactly one active canonical Client/Factory/Zone/Department record for each requested ID; complete parent ownership chain, missing/ambiguous/unresolved IDs, inactive parents and conflicting references |
| `validateZoneLeaderAssignment` — B | Many different people may lead one Zone; one active led Zone per person/factory; independent factory assignments; duplicate active tuples/assignment IDs rejected. Inactive/revoked history does not create current conflicts |
| `validateDepartmentAssignment` — C | Multiple leaders/members per Department; combined Leader/Member assignments confined to one operational Zone/person/factory; multiple same-Zone Departments allowed; Department assignments align with actively led Zone, including when proposing a new ZL assignment; active canonical person/parents and exact supplied eligibility required |
| `validateIndependentRoleAssignment` — D | Separate FA/Champion/ZL/DL/DM tuples and scopes; roles can coexist; no generated memberships/grants/permissions. Champion/FA remains factory-scoped; ZL Zone-scoped; Department roles require Department chain |
| `validateDepartmentActionOwner` — E | Canonical originating Department chain, supplied active eligible work assignment, exact responsible person ID and same originating Client/Factory/Zone; missing origin/work/eligibility or foreign ownership denied |
| `validateIndependentVerification` — F | Explicit action/scope-bound verifier and coordinator eligibility facts; verifier/coordinator differ from creator and all supplied retained completers; draft may lack verifier; submission cannot; active FA-work designation must match exact Action, verifier and scope |

Errors: `MISSING_ID`, `UNRESOLVED_ID`, `AMBIGUOUS_ID`, `INACTIVE_RECORD`, `PARENT_CONFLICT`, `INVALID_ROLE_SCOPE`, `INVALID_ROLE`, `INVALID_INPUT`, `DUPLICATE_ASSIGNMENT`, `ZONE_LEADERSHIP_CONFLICT`, `DEPARTMENT_ZONE_CONFLICT`, `LED_ZONE_CONFLICT`, `ELIGIBILITY_REQUIRED`, `INACTIVE_ASSIGNMENT`, `ACTION_ZONE_CONFLICT`, `VERIFIER_REQUIRED`, `COORDINATOR_REQUIRED`, `INDEPENDENCE_CONFLICT`, `DESIGNATION_SCOPE_CONFLICT`.

These are Phase 1A local validation outcomes, not replacements for existing production errors or an approved operational API. An ended assignment may remain structurally representable even if its historical parent no longer resolves; it never becomes a current eligible owner or a source of authority. Conflicts are checked against a proposed active assignment, not by globally invalidating unrelated historical records. Existing v3 multi-Zone allocations are not rewritten, normalized, revoked or hidden.

`AssignmentEligibility` identifies the exact proposed assignment/person/role/scope. `ReviewEligibilityFact` identifies the exact Action/person/scope and an explicit supplied eligibility decision. No validator determines who may issue those facts. Review facts are already-resolved inputs; this function compares canonical identifiers rather than establishing directory membership or qualification. No automatic candidate selection, permission set, role granting, work-capacity override or verifier replacement policy exists. `valid: true` means only that the supplied structural facts satisfy these checks; it is not sufficient authorization for a real assignment, Action or review.

The validator module has no imports, browser/client directive, clocks, random/ID generation, network calls, store/session reads, evidence access or audit-history writes. It is imported only by the two new test files. Nothing in application code imports it.

## C. V3 characterization coverage and isolation

The new characterization suite imports the existing `factory-authorization.ts` and `audit-authorization.ts` policy bodies unchanged. Vitest injects synthetic directory/configuration/state/session/entitlement **read dependencies**, with JSON snapshots for the existing payload-read interface. It never loads a real user directory or uses `window`, localStorage, sessionStorage, IndexedDB, a browser profile or runtime data. The test runner's existing environment is Node. Fixtures are rebuilt before each test; no v3 command is called by this new suite.

| Required legacy coverage | New characterization or existing protection |
| --- | --- |
| FA independent of CA/SA/manager metadata | Newly tested: actual policy requires explicit active FA assignment; CA and SA do not inherit it; FA needs no operational FM to execute directly |
| Existing Zone allocation representation and multiple led Zones readable | Newly tested: multiple existing v3 Leader allocations returned unchanged, no v4 normalization |
| Explicit Auditor grant eligibility | Newly tested: ZL label alone is insufficient; active eligible base role and leadership allocation required |
| Own-Zone restrictions, including legacy `leaderId` | Newly tested: grants cannot override current own-Zone exclusions or legacy leader reference |
| Direct FA Audit execution | Newly tested through actual `canExecuteScopedAudit` with no FA Auditor grant/FM; CA denied |
| Grant revocation | Newly tested: future execution denied; grant record and supplied Audit history retained |
| Legacy department strings | Newly tested: policy reads leave Production strings and metadata unchanged |
| Signature/assignment retention through supported reassignment | Protected by unchanged `tests/access-v3-phase2.test.ts`, executed successfully in this task. New suite only tests non-mutating history preservation during eligibility reads; it does not claim to exercise reassignment |
| Audit completion independent of linked Action closure | Protected by unchanged `tests/audit-independent-action-closure.test.ts`, executed successfully; no duplicated completion harness introduced |
| Synthetic v4 roles do not expand module access | Newly tested: constructing/validating Champion input does not change v3 directory/state, FA/Auditor eligibility, Audit execution, or CI/Red Tag create outcomes |

Existing v3 and workflow suites use their existing per-test in-memory storage stubs and authenticated fixture utility. Their simulated persistence stays inside the isolated Vitest process; no active browser data is accessed. Those existing test expectations, setup utilities and fixtures were not changed. The new suite's mocked read boundaries prove present policy behavior, not integration of real persistence, active context or production security.

## D. Executed validation

Final new-test counts below reflect the current files; an earlier 56-test validator pass preceded additional edge-case coverage.

| Command | Actual result |
| --- | --- |
| `npx vitest run tests/access-v4-validators.test.ts` | **63 passed**, 1 file |
| `npx vitest run tests/access-v4-legacy-characterization.test.ts` | **11 passed**, 1 file |
| `npx vitest run tests/access-v3-phase1.test.ts tests/access-v3-phase2.test.ts` | **60 passed**, 2 files |
| `npx vitest run tests/audit-independent-action-closure.test.ts tests/action-plan-creation.test.ts tests/action-store.characterization.test.ts tests/action-plan-execution-types.test.ts tests/action-start-undo.test.ts tests/audit-evidence-quota.test.ts tests/action-evidence-quota.test.ts` | **107 passed**, 7 files |
| `npx tsc --noEmit --incremental false` | Passed, exit 0; incremental disabled to avoid writing a compiler cache |
| `npm run lint -- features/five-s/administration/access-v4-validators.ts tests/access-v4-validators.test.ts tests/access-v4-legacy-characterization.test.ts` | Changed TypeScript files passed, exit 0; full-repository lint was not run |
| `git diff --check` plus explicit new-file whitespace checks | Passed |
| Import/reference and task-start hash boundary checks | Passed: no production consumer; no pre-existing file changed |

Current coverage: **74 new tests and 167 existing regression tests passed**. No failures remained. No automated browser acceptance, build or full-unit-suite run was performed; those are not claimed. No real storage, security/tenant-isolation or IQ acceptance claim follows from these unit tests.

## E. Scope verification

Task-start hashes cover existing tracked and untracked repository files. Final comparison confirmed exactly the four new files in section A and byte-identical pre-existing files, including all previous uncommitted source/test/architecture changes. `git diff --check` is supplemented by new-file checks because untracked files do not appear in the ordinary Git diff.

Import inspection found only `tests/access-v4-validators.test.ts` and `tests/access-v4-legacy-characterization.test.ts` referencing the validator. Its source has zero imports; no runtime wiring, barrel export, current-context change, persistence adapter, entitlement/navigation/UI edit, seed change or migration exists. Existing source and tests stayed intact. No IQ/person/factory/Zone/Department/role/grant/Action/Audit records, subscription maps, evidence or histories were created or changed in application runtime. No browser storage reset or browser test was run. No commit/push/merge/deploy occurred.

## F. Outstanding blockers and architecture reconciliation

No R-series policy was resolved by this implementation:

- **R01:** coordinator eligibility/grantor/replacement and pending-review handling remain external. Only supplied eligibility and mandatory independence are checked.
- **R02:** eligible owner/work-capacity selection remains external. The owner validator only enforces structural same-origin-Zone scope; it does not select capacity or invent factory-level/legacy exceptions.
- **R03:** FA-work verifier qualifications/designation authority remain external. Only supplied eligibility, independence and exact Action designation are checked; no privilege is granted.
- **R04/R05:** escalation resolution/cancellation, SLA clock/reset/notification transport remain unimplemented.
- **R06:** live legacy read/policy/storage/version/recovery adapters remain unimplemented. Synthetic inputs are not a storage schema or migration. Characterization preserves current behavior rather than normalizing it.
- **R07:** detailed Department allocation/Champion/retained-read boundaries remain external; a structural role result never authorizes a read or write.
- **R08:** unfinished-work dependency coverage/lifecycle guards are not implemented; no deactivation/revocation command is introduced.
- **R09:** final IQ configuration and first-FA bootstrap remain blocked; no onboarding occurs.
- **R10:** reviewed cross-client attachment authority/procedure remains unresolved and unimplemented.

The reconciled architecture called its suggested bounded validator batch “phase 2A”; the current explicit user brief calls and authorizes it **Phase 1A**. This report uses the latest scope/name and leaves all four architecture documents unchanged. Earlier contract text calling technical interfaces proposed does not authorize production integration, nor does this standalone implementation approve those operational interfaces. No other contradiction required changing existing policies, fixtures or production code.

## G. Recommendation and stop

Smallest next task: a separately scoped review that approves concrete R01–R03 coordinator/owner/verifier qualification matrices and the R06 compatibility/transaction contract before any live adapters or commands. These pure validators may inform that review but must not be wired to runtime as authorization.

Do not begin Phase 1B, Phase 2, Phase 3, D10, context persistence, IQ onboarding or entitlement activation from this handoff. Stop after Phase 1A.
