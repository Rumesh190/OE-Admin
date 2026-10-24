# OPS v4 demo cleanup — inspection status

> Historical initial inspection. Browser access and generated configuration were subsequently authorized and cleanup/rebuild completed. See [the completed report](OPS-IQ-DEMO-REBUILD.md) and [exact record/key manifest](OPS-IQ-DEMO-REBUILD-MANIFEST.json). The zero-change statements below describe only the initial inspection.

Date: 22 October 2026. Status: awaiting access to the target browser storage and the missing replacement configuration. Cleanup authorization is recorded; it is not being requested again.

## Actual changes to demo data

- Browser storage keys cleared: **none**.
- Browser records removed or modified: **none**.
- Replacement IQ records created: **none**.
- IndexedDB databases, stores or Blobs deleted: **none**.
- Application source/workflows/permission safeguards/models removed: **none**.
- Automated tests, builds, browser smoke or acceptance cycles run during this task: **none**.
- Commits, pushes, merges or deployments: **none**.

Only this status document was added. Earlier batch reports describe previous test runs, not runs performed under the new no-testing implementation rule.

## Inspection performed and access limitation

Read AGENTS.md and inspected canonical IQ onboarding, administration/context/role commands, Action work/verifier policy, Audit persistence, record identifiers/tombstones and shared evidence storage. Checked available connected tools for browser access. No browser connector was available; the local debugging endpoint at `127.0.0.1:9222` was unavailable. Read-only checks found no local OPS tab on port 3000 in running Google Chrome or Safari. No unrelated tab contents or browser profile database were read.

The previous Batch 4 Chromium contexts were disposable synthetic sessions and are closed. Their temporary fixture file is not evidence of the user's current browser-local records. Repository fixtures and display names cannot establish that a live record, person, client or dependency is disposable.

## Canonical storage and dependency map

The following are repository-defined locations to inspect once the actual browser/origin is available. This is **not** a list of occupied browser keys or authorized whole-key deletions.

| Storage | Scope and dependencies to reconcile |
| --- | --- |
| `five-s-administration-users-v1` | Shared canonical person profiles. Check all client/factory memberships, independent roles, ownership, creators, reviewers/verifiers/coordinators and retained history before removing any person. |
| `ops-access-v3-administration-v1` | Clients, Client memberships/admin assignments, Factory memberships/admin assignments, Zone allocations, Auditor grants and administration events. Resolve exact client/factory/person IDs; shared payload can contain both disposable and protected data. |
| `ops-organization-configuration-v1` | Factories and Zones; check parent ownership, memberships, grants, Departments and source records before removing any row. |
| `ops-access-v4-administration-v1` | Departments, independent assignments, retained events and upload intents. Check role capacity and verifier snapshots, work obligations and evidence references. Preserve schema/revision/unknown compatible fields and protected rows. |
| `manufacturing-qms-five-s-audits-v1` | Exact Audit/question links, findings, assignees, answers, evidence and signatures; linked canonical Actions must be reconciled together. |
| `standalone-5s-actions` | Cross-module canonical Actions; check source IDs, reverse links, owner capacities, verifier/coordinator selection, submissions, evidence and history. Actions from unrelated or uncertain sources are not cleanup candidates. |
| `ops-gemba-v1`, `five-s-continuous-improvements-v1` and other canonical source stores | Additional references to people, Zones, Actions and shared assets. No inference that another module is disposable merely because one linked Audit is a demo. |
| `ops-action-reminders-v1`, `ops-action-escalations-v1`, `standalone-5s-notifications` | Remove only dependencies proven exclusive to an approved deleted demo record/person. Retain unrelated entries and delivery/retry semantics. |
| `ops-organization-modules-v1` | Client entitlement entries. Rebuilding a demo does not authorize changing production entitlements or bypassing staging/activation guards. |
| `ops-record-tombstones-v1:abc-manufacturing` and canonical record counters | Preserve consumed IDs/deletion reservations; do not reset global high-water counters or enable accidental ID reuse while cleaning a subset of rows. |
| `ops-access-v3-pending-transaction-v1` | Shared recovery journal. Inspect/reconcile pending recovery before cleanup; never clear it as disposable clutter. |
| `ops-active-access-context-v1` and demo identity selection | Reconcile only if they reference a removed demo identity/scope. No global session/browser reset. |
| IndexedDB `ops-local-assets` / `gemba-photos` | Shared Audit/Action/Gemba evidence Blobs. Delete only when ownership and every surviving reference are established. No database-wide deletion. |

Fixture version markers and legacy initializers also need review to prevent removed disposable samples from automatically returning. Do not delete markers indiscriminately: existing initializers may re-seed samples. Obsolete behavior may be removed when confirmed to serve only the identified disposable dataset; approved workflows and safeguards remain.

## Known IQ configuration versus missing facts

The implemented approved plan contains:

- Independent IQ Client, Manufacturing.
- Distinct Manoj Guru Client Admin with the previously approved canonical creation attributes.
- IQ Factory 1, code IQF, Chennai.
- Existing Lakshman as the proposed explicit Factory Admin after canonical identity/membership review.
- Zone A–D names; ZA/ZB/ZC/ZD remain proposed codes in the current plan.

Still needed for the replacement environment:

1. The actual browser and OPS origin/profile containing the disposable data, or an accessible debugging connection to that tab.
2. Final Zone codes and Department names/codes/parent Zones.
3. Each approved person's canonical identity/reuse decision, operational role, Zone/Department allocation and any missing required email/Employee ID, especially Suresh.
4. The applicable independent verifier/coordinator arrangement. Supported DM/DL/ZL contracts already exist; FA-work qualification and Department-less origins remain unresolved and cannot be granted by cleanup.

Earlier requests named Rumesh, Suresh, Siva Kumar and Anand. Existing names alone do not resolve their v4 Department roles, current runtime memberships or whether historical identities are disposable. In particular, the known Anand Zone D leadership must be classified against the actual dataset and approved replacement allocation before changing it.

## Execution once access and configuration are available

1. Capture a private scoped backup and exact raw storage/version/revision inventory before changes. Include dependency references; avoid publishing personal attributes in the cleanup report.
2. Classify records as confirmed disposable, protected or uncertain. Protect uncertain rows and any references from protected records. Shared keys are edited at row/entry level rather than cleared globally.
3. Resolve remaining role/permission implementation required by the approved replacement plan before creating its data. Preserve actual-actor/context checks, independence, Auditor/own-Zone exclusions and recovery guards. Cleanup is not a qualification grant or production activation.
4. Prepare exact record-level removals and dependent link updates from the current snapshot. Apply only the already-authorized confirmed disposable scope, with backup and recovery; do not delete real/uncertain records or shared evidence.
5. Rebuild the approved IQ demo through canonical commands and genuine actor/context transitions. Record generated IDs and relationships; do not repurpose unrelated clients/factories, duplicate identities to bypass conflicts, or import synthetic test qualifications as business facts.
6. Publish the exact removed/created record IDs and modified/cleared keys, explicitly distinguishing row edits from whole-key deletion. Record retained dependencies and unresolved blockers.
7. Run no automated testing during implementation. After the approved implementation and replacement dataset are complete, run one consolidated automated acceptance cycle and report its result. Do not report the cycle as passed before it occurs.
