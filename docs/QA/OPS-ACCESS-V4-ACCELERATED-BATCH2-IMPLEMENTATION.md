# OPS v4 — Accelerated Batch 2 implementation

Date: 22 October 2026. Scope: resumable staged IQ onboarding, canonical identity checks, Department-less v4 Zones and tenant-safe Administration integration. **Workflow implementation complete within the approved boundary; live IQ provisioning remains pending. Not fully verified or operationally ready.** Full regression, build and browser acceptance remain deferred until after Batch 3.

## 1. Implemented capabilities

The approved Batch 2 brief, four v4 architecture documents and Batch 1 implementation report were reconciled against current Administration commands, directory, organizational persistence, journal, context, entitlements and UI. Earlier documentation-only approval gates are historical for the implementation explicitly authorized here; unapproved Departments, operational allocations, Zone codes and activation remain gated.

The existing Administration page now provides:

1. SA creation of the independent IQ client in Staged state.
2. SA creation of the distinct IQ Manoj Guru Client Admin after fresh global contact checks.
3. Actual verified IQ Client Admin creation of IQ Factory 1, IQF, Chennai.
4. Actual SA confirmation of existing Lakshman's canonical ID, email, Employee ID and mandatory review reason before ordinary IQ client attachment.
5. Actual IQ Client Admin appointment of reviewed Lakshman as Factory Admin, without promoting the Client Admin or granting Zone/Auditor roles.
6. Actual assigned FA configuration of Zone A–D with explicitly confirmed codes and no fabricated Department.
7. Source-derived progress, actor instructions, honest configuration-pending states and a read-only future activation checklist.

No function runs provisioning on module import, page load or refresh. No actor is impersonated automatically. The workflow uses existing public canonical commands for client/person/factory/FA creation and Batch 1 attachment; the new public v4 Zone command uses the existing administration journal coordinator.

## 2. Files created

| File | Purpose |
| --- | --- |
| `features/five-s/administration/iq-onboarding.ts` | Approved configuration, canonical record/identity resolution, scoped readiness projection and captured write expectations |
| `features/five-s/administration/iq-onboarding-store.ts` | Authorized, retry-safe step commands and Department-less v4 Zone command |
| `features/five-s/administration/iq-onboarding-panel.tsx` | Existing-Administration workflow, confirmations, pending states and disabled activation |
| `tests/access-v4-batch2.test.ts` | 14 focused identity, scope, retry, preservation and recovery tests |
| This report | Actual implementation, verification and provisioning boundary |

## 3. Existing files modified

| File | Focused change |
| --- | --- |
| `features/five-s/administration/store.ts` | Fresh canonical directory reader for identity-sensitive writes; malformed or ambiguous data is preserved and rejected |
| `features/five-s/administration/access-v3-store.ts` | Account creation and person eligibility use fresh canonical directory; legacy Zone editor cannot overwrite v4 Zones |
| `features/five-s/administration/access-v4-store.ts` | Optional full identity/contact confirmation, expected directory token and attributed review snapshot on attachment |
| `features/five-s/administration/access-v4-context.ts` | Shared explicit ABC compatibility-scope predicate |
| `features/five-s/administration/access-v4-panel.tsx` | Mount the IQ onboarding panel within existing Administration |
| `features/five-s/administration/access-v3-page.tsx` | Avoid invalid-context/v3-profile fallback; IQ uses guided Zone creation; new Zones show independent Departments and bypass the legacy string editor |
| `features/super-admin/super-admin.tsx` | Existing-route onboarding link; staged module controls show disabled/non-operational state |
| `lib/organization-store.ts` | Additive v4 Zone discriminator, explicit Client ownership and attributed code confirmation; legacy Zone field requirements retained |
| `lib/administration-v4-storage.ts` | Add canonical organization configuration to v2 journal's target allowlist |
| `lib/module-entitlements.ts` | Shell capabilities use selected tenant; scoped new profiles/invalid/platform contexts have no implicit ABC fallback |
| `components/ops/access-context-boundary.tsx` | Keep guarded Super Admin routes accessible; prevent foreign/invalid contexts from rendering ABC operational or legacy configuration views; wait for settings context hydration |
| `components/navigation/notification-bell.tsx` | Do not mount the legacy Action/notification reader or attention evaluator in foreign, platform, invalid or unsupported scoped administration contexts |

These changes extend existing modules/routes. No package, separate directory, duplicate identity store, parallel Administration module or onboarding progress database was introduced.

## 4. Current IQ configuration readiness

| Item | Approved target / actual status in this run |
| --- | --- |
| Client | IQ, Manufacturing, Staged. Workflow available; no live canonical client ID verified or created. |
| Client Admin | Distinct Manoj Guru, `manoj@IQ.com`, `Manoj_001`. Workflow available; live uniqueness and canonical ID remain unverified. ABC `USR-MANOJ-GURU` is never reused. |
| Factory | IQ Factory 1, IQF, Chennai. Actual IQ CA must create it; no live factory ID verified or created. |
| Lakshman | Existing canonical `USR-LAKSHMAN` is the reviewed candidate, never a name-only match. Live ID/contact confirmation, attachment and FA appointment remain pending. |
| Zones | Zone A–D names approved; ZA/ZB/ZC/ZD remain proposals. Code fields start empty and confirmation starts unchecked. No Zone was created in live data. |
| Departments/personnel | No approved names, codes, Leaders/Members or operational allocations. Configuration remains pending; no placeholders or copied ABC strings. |
| Operations | No Audit/D10 activation or general Actions access. No operational entitlement was enabled. |

## 5. Live provisioning boundary and pending steps

**Actual live records created: none. No provisioning actor/context evidence or generated live canonical IDs are available.**

No active browser session or browser-local directory was inspected. It would be unsafe to treat repository seeds or synthetic test storage as the user's active runtime, to confirm identity on the user's behalf, or to fabricate an authenticated actor. Provisioning therefore remains pending under the brief's explicit safety boundary.

An authorized operator must select platform context and use the workflow, verify the live directory's uniqueness, complete the actual IQ CA steps under that identity, provide Lakshman's identity confirmation/reason under SA, appoint FA under IQ CA, and finally configure approved Zones under FA. The page reports records only when canonical persisted relationships exist. Cross-client attachment and IQ FA appointment are implemented capabilities, not completed live assignments.

## 6. Identity, ownership and authorization

- Email and Employee ID comparisons are case-insensitive across the current canonical directory, including inactive profiles. Cached directory data cannot hide a collision in the approved creation path or underlying account-creation command.
- A matching contact is recognized for resume only when it is already the distinct active IQ CA with an unambiguous active IQ Client Admin membership. Colliding/unreviewed people block creation; there is no name merge, overwrite or fabricated alternate profile.
- IQ must have an independent Client ID. Existing ABC/XYZ IDs cannot be accepted as renamed IQ. IQ factory lookup requires explicit IQ ownership, correct name/code/location and an independent factory ID; Egmore cannot be adopted.
- Protected steps validate actual identity/context, canonical status and membership, expected v4 revision and exact current v3/directory/configuration payloads. CA and SA do not inherit FA authority.
- Attachment records exact ID/contact confirmation, actual SA actor/time and reason. It appends ordinary membership only. Existing/inactive memberships, dormant assignments and unreviewed historical attachment require review instead of automatic activation.
- FA appointment requires the actual verified IQ CA, exact IQ factory, reviewed canonical Lakshman attachment and explicit person confirmation. Existing inactive/ambiguous FA history is not reactivated.

## 7. Zone and Department compatibility

New v4 Zones remain in the canonical configuration under their immutable factory, with explicit Client ID, `accessModel: v4`, confirmed code attribution, empty legacy `department`, and no fabricated leader. Empty means no legacy Department value; independently persisted Departments remain separate records. No existing Zone is converted or moved.

The existing legacy Zone command still requires a nonempty Department string for legacy creation and retains ABC strings/leadership. It rejects rewriting a v4 Zone through the old string editor. Uniqueness is factory-scoped; duplicate/conflicting or legacy-matching records stop rather than being copied or normalized. Generic v4 Zone creation is available as an authorized public command, while IQ UI uses the approved four names and explicit confirmation.

Department creation/allocation remains the existing Batch 1 feature after actual configuration approval. This batch creates none. Department deactivation and role revocation retain Batch 1's incomplete-dependency-index blockers.

## 8. Staging and future activation gate

New IQ stays Staged. Effective access for all operational capabilities remains false even if a stored map is missing or someone has separately configured flags. Existing ABC/XYZ default behavior and existing subscription payloads are preserved. Shell menus use selected tenant capabilities; staged module controls do not present an executable activation path.

Readiness includes independent ownership, verified CA, reviewed FA appointment, confirmed Zones, approved Departments/personnel, scoped Audit authorization, D10, consolidated authorization/regression acceptance and explicit business activation approval. Unapproved configuration and future acceptance are never inferred complete from mere record existence. No activation operation or D10 implementation is exposed.

## 9. Tenant isolation in views

The IQ readiness projection requires validated platform, IQ client-administration or assigned IQ FA context. ABC administrators receive no IQ projection. IQ administrators receive their own client/factory/Zone identifiers; full Lakshman contact review fields are projected only to platform context. Existing Administration person selectors remain membership-scoped.

IQ context cannot render legacy ABC operations or ABC legacy configuration, even when a reused person retains ABC Admin permissions. Invalid contexts do not fall through to old Administration defaults. Guarded Super Admin routes remain their own administrative domain. Legacy notifications are unmounted outside their supported ABC operational scope so ABC titles/counts/detail links and Action attention evaluation do not run in staged IQ administration. This is an isolation guard, not a Notification Center expansion.

These are browser-demo controls, not production server security. Existing identity-switcher controls deliberately remain the demo mechanism; this batch does not claim real tenant authentication.

## 10. Recovery and idempotency

Progress is derived from canonical records and memberships, not checkmarks or local progress flags. Each reopening/retry recognizes exact compatible client, IQ CA, factory, reviewed membership, FA assignment and confirmed v4 Zone records. Successful retries do not add IDs/events or duplicate assignments. Conflicts, inactive history or contact ambiguity block instead of modifying earlier records.

Each step is separately committed. Existing canonical client/person/factory/FA commands retain their original administration journal/recovery boundary; the new Zone plus its administration event use Batch 1 v2 Prepared/Committed recovery. Attachment uses Batch 1's journaled membership/history transaction. Unknown compatible configuration fields survive writes. Failures leave earlier completed steps available to resume; they do not undo unrelated successful provisioning.

Cooperating new writers use the administration Web Lock, captured revisions/read tokens and final authorization. LocalStorage has no general atomic compare-and-swap; older synchronous v3 writers do not participate in that lock. Mixed/uncooperative cross-tab writers, compatible bundle rollout and real backend transactions remain limitations before operational activation. Original-only v3 journals use existing v3 recovery; v2 journals use v4 recovery. No journal is cleared automatically as a data-loss shortcut.

## 11. Targeted validation actually executed

- `npx vitest run tests/access-v4-batch2.test.ts tests/access-v4-batch1.test.ts tests/access-v4-legacy-characterization.test.ts`: **44 passed** — 14 new Batch 2, 19 Batch 1 and 11 unchanged legacy authority checks.
- Coverage includes distinct Manoj identity, fresh case-insensitive contact collisions, no ABC identity reuse, SA-only reviewed attachment, actual CA appointment, no CA/SA factory inheritance, all-step retry idempotency, canonical factory/Zone ownership, explicit code confirmation, Department-less compatibility, unchanged legacy strings, duplicate/foreign/malformed scope rejection, staged entitlements, scoped view projection, failed account creation rollback and failed Zone/event rollback with preserved unknown fields.
- `npx tsc --noEmit --incremental false`: passed after integration and final isolation changes.
- Changed-file ESLint passed; the two final view-isolation files were rechecked after the final safeguard.
- Tests use isolated in-memory browser storage and stubbed locks. They do not inspect or modify the active browser, prove genuine concurrent-tab behavior, or constitute browser acceptance.
- No full unit/regression run, production build, full-repository lint, Playwright or browser walkthrough was run, following the accelerated testing policy.

## 12. ABC/XYZ preservation evidence

Task-start Git status and SHA-256 inventory are recorded at `/tmp/ops-batch2-status` and `/tmp/ops-batch2-before.json`. Focused edits preserve previous local work. Final scope comparison covers the 12 existing files and five new files listed above; all other baseline files remain byte-identical, including Audit/Action lifecycle implementations, prior tests and architecture reports. No fixture seeding or migration script was added; existing seed definitions are not changed.

Synthetic tests compare existing people and ABC memberships/authority before and after the complete IQ workflow, retain old Zone records/strings, and verify existing subscription/Audit/Action payload bytes are untouched. These assertions are source/code-level preservation evidence. Actual browser-local ABC/XYZ records and histories were unavailable and are not claimed verified.

## 13. Batch 3 prerequisites and deferred verification

1. Complete actual staged provisioning through verified actors and the workflow; repository code alone is not live onboarding evidence.
2. Confirm Zone codes and approve Department/user/allocation details. Resolve any runtime contact, inactive membership or dormant assignment conflict through explicit review.
3. Keep IQ non-operational until scoped Audit authorization, canonical D10 corrective Actions, remaining owner/reviewer policies and all required acceptance are implemented and approved in their authorized batch.
4. Preserve the incomplete dependency-index stop on deactivation/revocation; do not substitute a partial work scan.
5. Resolve compatible-reader/writer rollout and mixed-tab concurrency limitations before relying on operational tenant isolation. Production enforcement requires server-side authorization/transactions.
6. After Batch 3, run the consolidated full unit/regression, TypeScript, lint, production build, cross-client/recovery tests and single browser acceptance. Verify actual navigation, responsive dialogs, accessibility, hydration, cache invalidation and live ABC/XYZ preservation then.

**Batch 2 stops here. No live IQ provisioning, IQ Audit activation, D10, Batch 3 work, historical migration, storage reset, commit, push, merge or deploy was performed.**
