# OPS Access v4 — Decision Register

Reconciled 22 October 2026. This register separates approved business requirements from design proposals, unresolved policy and implementation blockers. Approval of planning values does not authorize record creation, permission changes, migrations or activation. See the [master specification](OPS-ACCESS-ARCHITECTURE-V4-MASTER-SPEC.md), [gap analysis](OPS-ACCESS-V4-GAP-ANALYSIS.md) and [implementation plan](OPS-ACCESS-V4-IMPLEMENTATION-PLAN.md).

## 1. Approved business decisions

| ID | Approved requirement | Required consequence |
| --- | --- | --- |
| A01 | Platform → Clients → Factories → Zones → independent Departments | Canonical parent IDs; no interpretation of one legacy department string as multiple Department entities |
| A02 | Multiple Champions/factory; oversight of all its Zones | Separate factory assignment and read/escalation projection; no membership in every Zone |
| A03 | Multiple ZLs/Zone; one led Zone/person/factory | Separate assignment/cardinality checks; no automatic rewrite of v3 multi-Zone history |
| A04 | Multiple DLs and DMs/Department; person may join several Departments within one Zone | Explicit assignments, unique active tuples and one operational Department Zone/person/factory |
| A05 | Separate explicit roles; no inherited authority | SA != FA; CA != FA; FA module approval/closure independent; Champion != FA/Verifier/Auditor |
| A06 | DL allocations limited to eligible people already in same Zone | No account creation, cross-Zone allocation, system role/grant changes or implied Department mutation permissions |
| A07 | New-v4 creator/approver and creator/completer/verifier must be different canonical people | Role combinations/reassignment never bypass person-ID/history exclusions; absent eligible verifier blocks approval/verification |
| A08 | DM→independent DL; DL→independent ZL; ZL→independent FA; FA→explicit independent authorized verifier | Preserve canonical Action lifecycle/statuses; no default CA/Champion verifier |
| A09 | Preserve Phase 2 Audit scheduling/grants/own-Zone exclusion/direct FA/evidence/signature/history/scoring/completion | No new independent Audit review; preserve v3 execution exceptions and isolate new Action verification |
| A10 | Noncompliant Audit still requires canonical corrective Action linkage | D10 must reuse shared Action service, never relax finding completeness or invent owners/reviewers |
| A11 | Champion selects one accountable recipient at DL→ZL→FA level; other authorized leaders may view | Selected recipient acknowledgment; rejection reason; explicit same-level reroute/upward escalation only |
| A12 | Per-level configurable calendar-hour response SLA configured by assigned Factory Admin; expiry notifies Champion | No automatic next-level escalation or underlying Action reassignment; absent recipient stays pending; FA nonresponse stays overdue |
| A13 | Departments Active/Inactive, no transfers, no hard-delete of referenced records | Block deactivation with unfinished work until completion or authorized explicit reassignment; retain ownership/evidence/history |
| A14 | IQ new independent client, Manufacturing; IQ Factory 1, Chennai | New generated IDs; ABC/Egmore untouched; factory code IQF confirmed by U11 |
| A15 | Zones A/B/C/D, proposed ZA/ZB/ZC/ZD; Department/person allocations unapproved | Confirm final codes/configuration; never fill missing lists with ABC copies or invented Production Departments |
| A16 | New distinct IQ CA Manoj Guru / manoj@IQ.com / Manoj_001 | Do not reuse ABC USR-MANOJ-GURU; check runtime case-insensitive global uniqueness |
| A17 | Lakshman proposed IQ FA; existing ABC attachments deferred | Require separately approved cross-client attachment operation and active tenant-context policy first |
| A18 | IQ initially Audit only, staged activation after scope verification | Do not enable modules in this task; do not implicitly enable Actions/Reports/Dashboard to make dependencies work |
| A19 | Preserve ABC leadership/memberships/history/subscription; no duplicate-person or temporary-elevation workaround | Anand remains ABC Zone D Leader; all existing canonical IDs/roles/evidence/assignments retained |
| A20 | Documentation only; four named Markdown deliverables; no code/data/migrations/permission/entitlement changes | Stop after documentation; no destructive tests, commit, push, merge or deployment |

| A21 / U01 | Explicit Client/Factory context persists on refresh | Revalidate every protected operation; context preference is not authority; no ABC fallback |
| A22 / U02 | ZL Department assignments remain in the Zone they lead | No new-v4 cross-led-Zone allocation; legacy multi-Zone adapters separately reviewed |
| A23 / U03 | New Department Action responsible person stays in originating Zone | Enforce on assignment and every reassignment; immutable origin |
| A24 / U04 | Independent authorized coordinator, neither creator nor completer, selects independent eligible verifier before submission; capacity captured at assignment | Creation/draft may lack verifier; review submission cannot; coordinator eligibility/replacement remains R01 |
| A25 / U05 | Authorized same-client CA may designate eligible independent verifier for one FA Action | Action-specific only; no automatic CA verification, coordinator or other operational authority |
| A26 / U06-A | Narrow Audit-origin corrective Actions through canonical service | No general Actions entitlement or unrelated source access; D10 implementation not authorized |
| A27 / U08 | New-v4 history readable only by currently authorized actors | Preserve explicit legacy v3 read compatibility until separately reviewed transition |
| A28 / U09 | Additive canonical Departments | Preserve legacy Zone department strings and Audit snapshots; no automatic migration |
| A29 / U10 | FA appoints/revokes Champions, ZLs, DLs; FA or eligible DL manages authorized same-Zone DM allocations | No DL accounts/system grants/cross-Zone assignment; exact extended scope remains R07 |
| A30 / U07 | Assigned FA configures calendar-hour response SLA per level | Expiry notifies Champion; no automatic progression; delivery/clock details remain R05 |
| A31 / U11 | IQ Factory 1 code confirmed IQF | Do not request factory-code confirmation again; Zone codes/Departments/people and activation remain gated |

## 2. Proposed technical approaches — not approved implementation

| ID | Proposal | Review needed |
| --- | --- | --- |
| T01 | Extend existing canonical directory/configuration/v3 metadata with Department and independent assignment collections | Exact payload schema/version, prefixes, validators, compatibility and migration contract; no new identity/Action store |
| T02 | Common immutable parent chain, attributed assignment/event history, expected revisions and unique-active constraints | Atomic validation/recovery across collections; old records cannot be required to have new fields |
| T03 | Actual-SA `attachExistingPersonToClient` with verified person/target/reason and append-only membership | Approval of platform grantor and confirmation/privacy policy; no automatic role/FM/grant |
| T04 | Explicit platform/client/factory access context, no silent ABC fallback, context-bound cache/dialog/file invalidation | U01 refresh persistence approved; exact serialization/context invalidation and production architecture proposed |
| T05 | Separate assignment-based authority with v3 adapters and policy version for new records | Multi-Zone legacy conflicts, same-person roles, old readers and staged rollout |
| T06 | One persisted eligible verifier, selected explicitly from deterministically sorted candidates; revalidate every protected operation | U04 coordinator/pre-submit gate and U05 Action-specific CA designation approved; R01/R03 eligibility/replacement remains; sorting cannot appoint a first leader |
| T07 | New scoped Audit-origin corrective-task capability using canonical Actions without general Actions module access | U06-A business capability approved; resolver and minimum task boundary proposed; no general entitlement/manual creation/unrelated sources |
| T08 | Atomic D10 Action/question-link publication, idempotent retry, original-payload recovery and tracked asset cleanup | Cross-store journal design and deletion/tombstone semantics; no partial source completeness |
| T09 | Separate Champion escalation contract/events; proposed response states; derived overdue; minimal delivery intents | U07 FA/calendar-hour rule approved; R04/R05 transitions, clock and delivery boundary unresolved; do not alter VM escalation or build Notification Center implicitly |
| T10 | Department dependency index, current authorized retained reads, no automatic reactivation of grants | U08/U09 business rules approved; R06/R08 adapters, complete dependency registration and authorized reassignment tooling |
| T11 | Deny-by-default new-client staging and explicit IQ entitlement snapshot before activation | Avoid current Active/broad-default window, preserve existing client behavior; IQF confirmed, R06/R09 staging/bootstrap approval remains |

## 3. U-series reconciliation ledger

All eleven business updates are accepted planning decisions; residual questions are split into R-series items so resolved decisions are not re-opened.

| Decision | Fully specified business boundary | Residual technical/policy gate |
| --- | --- | --- |
| U01 resolved | Explicit context refresh persistence; every protected operation revalidates | Context ID/revision/storage and legacy read adapters R06; no authority in preference |
| U02 resolved | ZL Department assignments align with led Zone | Legacy multi-Zone adapter R06; no migration |
| U03 resolved | Department Action owner stays in originating Zone | Exact within-Zone Department and non-Department owner eligibility R02 |
| U04 resolved | Independent authorized coordinator selects before submission; work capacity captured; no-verifier draft allowed, submission blocked | Coordinator qualification/grantor/replacement R01; multi-role capacity rule R02 |
| U05 resolved | Same-client CA Action-specific FA-work designation; no automatic verifier/operational powers | Eligible verifier qualification, self-designation and revocation consequences R03/R01 |
| U06-A resolved | Audit-origin canonical corrective tasks without Actions entitlement | Capability implementation and idempotent recovery R06; no D10 implementation authorized |
| U07 partially resolved in detail | Assigned FA configures calendar-hour response SLA; Champion notified on expiry; no auto-progression | Remaining lifecycle R04, start/reset and delivery guarantees R05 |
| U08 resolved | Current-authorized new-v4 history; explicit legacy compatibility hold | Legacy adapter R06 and unfinished-work transition R08 |
| U09 resolved | Additive Departments; preserve strings/snapshots; no automatic migration | Exact storage/read/Zone-create adapter R06 |
| U10 resolved | FA appoints/revokes Champion/ZL/DL; FA/eligible DL manages same-Zone DM allocations | Detailed eligible-DL/oversight projection R07 |
| U11 resolved for factory code | IQF confirmed | Final Zone/Department/person/first-FA activation approvals R09; not a code question |

## 4. Remaining decisions and exact approval gates

Each row is unresolved, with a recommendation only. Missing policy returns a blocked operation; recommendations must not become implementation defaults. Phrases “eligible,” “authorized coordinator” and “independent verifier” require explicit reviewed qualification rules beyond a role label.

| ID / precise decision | Recommended safe policy — not adopted | Phase blocked | Existing behavior to preserve | Required approval |
| --- | --- | --- | --- | --- |
| R01 Coordinator eligibility/grantor, candidate participation exclusions beyond mandatory actors, verifier replacement authority and pending-review consequences | Explicit scoped coordinator capability; coordinator != creator/completer; one selected eligible verifier; replacement by independently authorized coordinator with reason/revision and retained selection/submission history. No role fallback or automatic pending-review change | 6 verification/submission; 7 full hierarchy | Existing Action reviewers/rework/revisions and legacy exceptions; new-v4 draft creation without verifier allowed | Product/access owner approves coordinator qualification, grantor, selection/replacement matrix and pending-review handling |
| R02 Who may choose owner/work capacity when person has multiple roles; eligible Department within originating Zone; non-Department/factory work owner route | Validate exact capacity assignment against source/work scope; no lowest-role shortcut; keep new Department owners in origin Zone; block unsupported non-Department routes until approved | 4 work allocation; 6 D10 owner assignment | U02/U03 invariants; canonical Actions, immutable source/history and existing legacy assignment behavior | Product approves eligible-owner/assigning-actor/capacity matrix for each pilot work origin |
| R03 Eligible FA-work verifier qualification, required membership/scope/authority, CA self-designation when independently qualified, designation revoke while review pending | Current active scoped qualification plus Action-specific CA designation; never creator/completer; CA alone never eligible. Block self-designation/pending-review revocation path until explicitly decided | 6 FA-work submission/review; 7 designation UI | Approved U05 CA Action-specific designation; no CA operational inheritance; old reviewer paths unchanged | Authorization owner approves qualification, independent CA cases and designation lifecycle matrix |
| R04 Escalation resolution/cancellation authority/evidence, exact states, rejection/ack ordering, Department-less entry and manual transition matrix | Champion records request outcome with reason only after authorized response; no underlying record closure; missing recipient remains pending; no invented skipped level. These are proposals, not defaults | 7 escalation lifecycle | Existing VM escalations, Action states; required ack/rejection reason/one recipient/manual hierarchy | Product approves state/actor/transition/outcome matrix and missing-Department handling |
| R05 SLA start/ack/reset/pause/clock presentation, exact hours and reliable expiry-notification delivery scope | Positive explicit hours per level, elapsed UTC hours including weekends (proposed interpretation), policy snapshot per recipient interval; deduplicated expiry intent/notification. App-open demo only if explicitly accepted; otherwise reliable scheduler/outbox required | 7 SLA/delivery acceptance; reliable production delivery 9 | Assigned FA configuration, calendar-hour response rule, Champion notification, no auto-progression; postponed Notification Center | Product approves deadline rules/values and demo delivery guarantee; architecture owner approves minimal transport/scheduler scope |
| R06 Exact context/legacy/schema/version/read adapters, multi-Zone mixed-model behavior, new Zone/string coexistence, idempotency/tombstone/recovery and concurrent assets | Additive refs, explicit new policy discriminator, old keys/unknown fields/original-payload recovery retained; block ambiguous mixed scope/new assignment, no automatic migration; reserved deleted source links block duplicates pending reviewed repair | 2 persistent model; 3 live context; 4 Department UI; 5 safe staging; 6 D10 transaction | V3 grants/all own-Zone exclusions, legacy reads/reviewers, strings/snapshots/signatures and browser recovery | Engineering/access review approves concrete compatibility/storage/transaction contract and negative-test fixtures before writes/live adapters |
| R07 Detailed eligible-DL member allocation boundaries and Champion aggregate/detail/evidence projection | DL manages only own assigned Departments in same Zone; FA any approved same-Zone DM allocation; minimum factory oversight fields, separate evidence authorization. No privilege inference | 4 expanded DL controls; 7 Champion projection; 8 other module projections | Approved U10 grantors, cross-Zone prohibition, no Champion mutation/admin; module permissions unchanged | Product approves detailed allocation/read-projection matrix; same-Zone allowance does not imply all-Department powers |
| R08 Complete unfinished-work/deactivation obligations and authorized reassignment tooling | Index owned tasks, pending review/verifier obligations, relevant module unfinished work, unresolved escalations/allocations; block if index incomplete or no eligible replacement; domain-authorized reassignment preserves origins/history | 2/4 lifecycle commands; 5 onboarding readiness with relevant allocations; 8 module activation | Existing outstanding Action/CI and last-FA protections; evidence/assignment history; no silent ownership transfer | Product/engineering approve dependency coverage, unfinished-state table, replacement authority and recovery acceptance |
| R09 First IQ FA/bootstrap and final onboarding/activation configuration | Confirm existing Lakshman identity/reuse separately, reviewed CM first, actual IQ CA explicit FA assignment; no temporary promotion. Approve Zone codes/Departments/allocations, contacts/runtime uniqueness and staged gates. IQF is settled | 5 real provisioning; 6 activation | ABC/Egmore ownership, Anand Zone D and other memberships/history/subscription; no duplicate-person workaround | User approves final IQ configuration, Lakshman reuse, bootstrap sequence and explicit later activation after tests |
| R10 Cross-client attachment actual-actor grantor, identity review/consent, inactive CM reactivation and append/revoke policy | Proposed actual-SA-reviewed append-only ordinary CM with verified person/client/reason, duplicate/inactive guards and active context; no roles or account duplication | 3 attachment command; 4 attachment UI; 5 first-FA bootstrap | Current foreign-person denial/private joinClient guard, canonical identity/history and existing memberships | Separate explicit user/access-owner approval of attachment authority/procedure; context persistence alone is insufficient |

## 5. Implementation blockers versus resolved policy

- **B01 / P0:** approved context and narrow task business rules are still unimplemented. Existing source continues ABC shell fallback, immediately Active new clients/broad entitlement defaults and foreign-person denial. R06/R10 and explicit implementation approval gate foundations; R09 gates actual IQ setup.
- **B02 / P0:** independent coordinator authorization/replacement and FA-work verifier qualification remain R01/R03; new-v4 review submission cannot ship with creator/auditor fallback. Draft work may proceed without verifier after authorized implementation.
- **B03 / P0:** D10 owner/capacity R02 and transaction/evidence R06 contract, minimum task access and scoped capability enforcement still missing. U06-A is no longer an unresolved subscription choice. Findings retain required canonical link checks.
- **B04 / P1:** additive Departments, role assignments and unfinished-work safety await R06/R08 implementation contracts; approved led-Zone/cardinality/appointing rules must not migrate legacy data.
- **B05 / P1:** escalation lifecycle R04 and SLA timing/delivery R05 unresolved; only FA-configured calendar hours and no-auto-progression are settled. VM flow remains distinct.
- **B06 / production:** browser-local context/history/notifications do not replace server authentication, row/file scope, transactions, immutable events or background delivery.

## 6. Deferred requirements and compatibility holds

Other IQ operational module integration/activation, Notification Center expansion, production backend/isolation/scheduler design, global legacy permission/read/reviewer migration and deletion-policy changes remain separately scoped. A new independent Audit review stage is not approved. Existing ABC-person attachment is not authorized by these documents. No data/role/grant/entitlement activation, schema/migration or D10 implementation is authorized.

Nonblocking for the minimal pure-validator batch: R04/R05 escalation delivery/lifecycle, R07 expanded projections, other modules and production decisions. They still block their own features; do not silently implement recommendations. R06 approval of live storage/legacy adapters is not needed to characterize unchanged legacy reads in isolated tests, but is mandatory before replacing live policy or writing new collections.

## 7. Phase 1 readiness

**Resolved:** U01/U02/U03/U04/U05/U06-A/U08/U09/U10, U07 calendar-hour/FA-configured/no-progression boundary and U11 IQF. No request to reconfirm these decisions is needed.

**Proposed:** exact request/result/error envelope and interfaces in master section 12; work-capacity/candidate resolvers, scoped CA designation, context preference format, source uniqueness/idempotency journal, role/Department storage adapters and IQ staging/activation command. These are documentation contracts, not new APIs or schemas.

**Blocking:** R01–R03 for complete Action policy, R06/R08 for live hierarchy/recovery, R09/R10 for IQ bootstrap, R04/R05 for escalation and R07 for expanded allocation/oversight. Each row above states recommendation, phase, preserved behavior and approval owner. Full implementation approval is not ready merely because all U-series planning updates are incorporated.

**Minimum next batch:** after explicit scope approval, pure hierarchy/context input validators and read-only legacy compatibility characterization with isolated tests in existing policy areas. No persistent writes, live guard replacement, records, membership attachment, entitlement activation or D10. This can proceed without adopting unresolved privilege/recovery recommendations.

**Before IQ onboarding:** prove context refresh/revocation, identity/first-FA guard, explicit scope/cardinality/alignment, owner/capacity/coordinator/designation independence, no-verifier draft versus review-submit gate, scoped Audit-origin task/evidence and one-per-source retry/recovery, full legacy compatibility, unfinished-work guards and staged entitlements; run one consolidated isolated browser acceptance after all approved implementation. Live directory uniqueness still needs authorized read-only verification.

## 8. Reconciliation validation and stop

Four existing permitted documents updated; all earlier approved business decisions and source findings retained. Static reinspection covered actual administration/eligibility/journal commands, Audit source-link/authorization and Action creation/review checks, entitlements and local notification helpers. Documentation consistency, source/link references, file-boundary hashes and `git diff --check` were checked. No application tests/browser UAT or production-readiness claim. No application code/data, storage, workflow, grant, role or entitlement changes; no commit/push/merge/deploy. Stop after documentation reconciliation.
