# IQ disposable demo — cleanup and rebuild

Completed against the existing Brave tab at `http://localhost:3000`. The tab now opens **http://localhost:3000/audits** as Lakshman in the IQ factory context. The UI explicitly labels IQ as generated disposable demo data. This is browser-local demo preparation, not production/client activation.

The product owner authorized scoped disposable-data cleanup and generation of missing demo profiles/allocations. Brave's Apple Events setting was enabled by the user before inspection. No global browser reset, source/workflow/model deletion, commit, push, merge or deployment occurred.

## Exact data removed

No whole storage key was cleared. The following rows were removed by scoped array rewrites:

| Key | Removed IDs |
| --- | --- |
| `manufacturing-qms-five-s-audits-v1` | `5S-EGM-ZB-001`, `5S-EGM-ZA-005`, `5S-EGM-ZA-004`, `5S-EGM-ZA-003`, `5S-EGM-ZB-005`, `5S-EGM-ZC-005`, `5S-EGM-ZD-006`, `5S-EGM-ZD-005`, `5S-EGM-ZA-006`, `5S-AUD-003`, `5S-AUD-004` |
| `standalone-5s-actions` | `ACT-ZA-001`, `ACT-ZB-001`, `ACT-ZD-101`, `ACT-ZA-102`, `ACT-ZD-102`, `ACT-ZC-102` |
| `standalone-5s-notifications` | `NOT-ACT-ZB-001-ASSIGN`, `NOT-ACT-ZA-001-ASSIGNED` |

The 11 Audits exactly matched repository fixtures. The six Actions exactly matched the canonical normalized fixture rows. Source references were traced; fixture Audits with retained/edited inbound Actions were excluded from removal. Notification removal was restricted to the two exact deleted-Action links. Reminder and escalation keys required no changes.

**No existing users, factories, Zones, Departments, memberships, role assignments, Auditor grants, signatures, evidence photos or IndexedDB assets were deleted.** No persisted v3/v4 administration/configuration payload existed in this browser before rebuilding. Shared existing people and the ABC defaults are still needed by retained/uncertain records; they were not removed merely because they also appear in demos.

Automatic Action/Audit fixture merging and fixture-version replacement were removed from existing-collection loading so cleanup does not silently resurrect or overwrite records. First-use samples and deliberate guarded demo reset remain existing functionality; persisted collections, including empty arrays, are now authoritative.

## Storage headroom repair, without evidence loss

Acceptance exposed insufficient room for the protected Action recovery journal. `five-s-red-tags-v1` contained approximately 4.82 million characters, including exact duplicate primary-photo data URLs.

For **RT-000008, RT-000006, RT-000005, RT-000004, RT-000003 and RT-000002**, only the redundant `imageUrl` field was removed where it was byte-identical to `identificationEvidence[0].url`. Every original photo byte, photo metadata, history and Red Tag record remains. The canonical Red Tag loader restores the same legacy primary-image alias in memory; persistence avoids storing that duplicate again. A distinct selected primary image is never compacted.

All 23 Red Tags remain. No images were compressed, replaced, moved to IndexedDB or deleted. This freed **790,490 characters**; combined cleanup/rebuild leaves **802,720 fewer OPS storage characters** than before. This provides the headroom needed for the existing journal rather than disabling its safeguards.

## Exact storage keys changed or created

- `five-s-administration-users-v1`: appended seven profiles; all 25 original profiles retained unchanged.
- `five-s-demo-role`: selected the existing Lakshman demo identity for handover.
- `five-s-red-tags-v1`: six redundant photo aliases compacted; all records/evidence retained.
- `manufacturing-qms-five-s-audits-v1`: removed 11 fixture rows; appended two IQ Audits.
- `standalone-5s-actions`: removed six fixture rows; appended three canonical IQ Actions.
- `standalone-5s-notifications`: removed the two obsolete fixture links above.
- `ops-access-v3-administration-v1`: created IQ administration/membership/grant/event data.
- `ops-access-v4-administration-v1`: created canonical Departments, independent roles and events.
- `ops-active-access-context-v1`: selected the exact IQ factory for Lakshman.
- `ops-organization-configuration-v1`: persisted existing default Egmore/ABC parents unchanged and added the independent IQ factory/Zones.
- `ops-organization-modules-v1`: added the IQ Audit-only demo entry; no existing tenant entry changed.
- `ops-record-sequence-v1:abc-manufacturing:actions`: existing global compatibility reservation counter advanced from 8 to 11.
- `ops-record-sequence-v1:abc-manufacturing:audit`: existing global compatibility reservation counter advanced from 2 to 4.

Counter key names are the existing global reservation namespace; the new business records explicitly belong to IQ. No counter was reset or decremented. Fixture markers, tombstones, unrelated stores and the authentication session were retained. Recovery-journal keys were not cleared as cleanup.

## New IQ configuration

- Client **IQ**: `ORG-ecd173de-cb08-49aa-8b1c-cd940ba5d5b7`.
- Factory **IQ Factory 1 / IQF / Chennai**: `PLANT-a7c73ffc-75de-4432-b706-042c95caa979`.
- Disposable marker: `ops-iq-v4-demo-v1`, product-owner-authorized generated data.
- Four independent Zones: **Zone A / ZA**, **Zone B / ZB**, **Zone C / ZC**, **Zone D / ZD**.
- Five Departments: **Assembly / ASM** and **Quality / QLT** in ZA; **Maintenance / MNT** in ZB; **Finishing / FIN** in ZC; **Logistics / LOG** in ZD.
- Eleven IQ Client memberships, nine Factory memberships, seven Zone allocations, two explicit FA assignments, nine independent v4 roles, one scoped Auditor grant, 31 v3 administration events and 18 v4 events.

Factory membership base roles are neutral Standard User affiliations; explicit v4 ZL/DL/DM/Champion assignments and explicit FA/Auditor facts govern the supported v4 powers. No broad legacy permission array was granted to a generated profile. Department Member/Leader roles are not injected into the three-role legacy base-role dropdown.

| Person | IQ responsibility | Zone / Department | Identity |
| --- | --- | --- | --- |
| OPS Super Admin / Metric Mind | Platform administration only | Platform | Existing, unchanged |
| Manoj Guru | Client Admin; no implicit FA | IQ client | New distinct approved IQ identity; ABC Manoj retained |
| Lakshman | Explicit Factory Admin / independent coordinator | IQ factory | Reused `USR-LAKSHMAN`; unrelated history retained |
| Meera Nair | Second explicit Factory Admin | IQ factory | New generated demo profile |
| Rumesh | Independent Zone Leader | ZA | Reused `USR-RUMESH` |
| Kavya Iyer | Independent Zone Leader plus explicit Auditor grant | Leads ZB; authorized audit Zones ZA/ZC/ZD | New generated demo profile; own ZB remains excluded |
| Priya Raman | Department Leader | ZA / Assembly and Quality | New generated demo profile |
| Neha Patel | Department Leader | ZD / Logistics | New generated demo profile |
| Suresh | Department Member | ZA / Assembly | New generated demo profile |
| Siva Kumar | Department Member | ZA / Quality | Reused `USR-SIVA-KUMAR` |
| Anand | Department Member | ZD / Logistics | Reused `USR-ANAND`; existing ABC Zone D leadership unchanged |
| Vikram Das | Zone Champion oversight | IQ factory | New generated demo profile; no implicit FA/Auditor authority |

Generated support profiles use reserved `@iq-demo.invalid` addresses and explicit `IQ-DEMO-*` employee IDs. Existing reused profile contacts were not changed. The distinct IQ Client Admin uses the previously approved IQ contact attributes. All generated canonical IDs, memberships, allocations, role/grant IDs and event IDs are listed in the accompanying [machine-readable manifest](OPS-IQ-DEMO-REBUILD-MANIFEST.json).

## New sample Audits and Actions

| Audit | Zone | Linked Action | Owner | Verifier | Coordinator | Prepared Action state |
| --- | --- | --- | --- | --- | --- | --- |
| `AUD-000003` | ZA / Assembly | `ACT-000009` — Remove unused assembly fixtures | Suresh | Priya Raman | Lakshman | Assigned |
| `AUD-000003` | ZA / Quality | `ACT-000010` — Restore inspection gauge labels | Siva Kumar | Priya Raman | Lakshman | In Progress, explicit Corrective Action type |
| `AUD-000004` | ZD / Logistics | `ACT-000011` — Mark safe material staging lanes | Anand | Neha Patel | Lakshman | Assigned |

Kavya is the assigned Auditor and actual demo finding/Action creator; she is distinct from each owner, verifier and coordinator. Audits are In Progress, not fabricated as signed/completed. The custom demo finding questions explicitly do not mandate a before-photo; standard Audit evidence rules remain unchanged. No synthetic completion proof was published into the live dataset.

General Actions and other IQ operational modules remain disabled. Audit-origin task detail is available through its existing narrow capability. Owners/reviewers cannot gain full Audit read access or Action Center by following a task link. FA-work verifier qualification, Department-less origins and incomplete dependency-index revocation/deactivation remain blocked.

The IQ demo is operationally Active with an explicit disposable marker and visible banner. An ordinary unmarked IQ client remains subject to staging and the existing production activation gate; production readiness/business acceptance is not inferred from demo facts. Production activation remains unavailable in the onboarding readiness controls.

## Provisioning and preservation evidence

The private preparation utility called existing protected canonical commands on a snapshot with explicit delegated demo-actor transitions: SA → CA → FA → granted Auditor → task owner/coordinator as required. It did not invent a second Action store, bypass a workflow transition in application code, or claim that those demo transitions represent independently authenticated real humans.

The live commit checked the original OPS read set and actual demo platform session, acquired existing business/admin Web Locks, and rewrote only affected keys. Shrinking writes preceded additions because the existing storage was near quota. The complete private backup and a rollback path were retained. This is scoped browser-local maintenance, not a backend transaction or a guarantee against browser/process crashes. No global clear or unsupported recovery-format marker was used.

Exact preservation comparisons after completion confirmed:

- **25 original profiles** unchanged, including existing contacts, global roles/status and history.
- **39 retained Actions** unchanged; six confirmed fixtures removed and three IQ Actions appended → **42 total**.
- **Four retained Audits** unchanged; 11 confirmed fixtures removed and two IQ Audits appended → **six total**.
- **All 23 Red Tags and all photo contents** unchanged after restoring the six redundant aliases for comparison.
- Notifications **172 → 170**; unrelated notification entries retained.
- No IndexedDB database/store/Blob deletion or real-client record deletion.

Private snapshots, prepared patch, exact fixture classification, alias compaction and acceptance logs are in **`/tmp/ops-iq-demo-backup`**, owner-restricted directory/file permissions. The original before-image remains available there; temporary storage is not a permanent backup service. No raw browser snapshot or evidence data was added to the repository.

## Consolidated acceptance cycle

No automated tests ran during initial inspection, command preparation or the live rebuild. After implementation/data creation, one consolidated acceptance phase ran the full unit suite, TypeScript, changed-file lint and three Chromium journeys in isolated contexts.

That phase initially exposed obsolete v3 fixture setup assumptions, an explicit notification-retry failure and the storage headroom issue. Repairs preserved the guards: legacy tests now use the existing v3 compatibility client, with their authority/own-Zone/history assertions retained; new independent-client behavior remains exercised by v4 suites. Explicit notification saves can retry a transient unknown storage failure without passive write flooding or overwriting unreadable payloads. Redundant photo aliases were compacted losslessly. Only then were affected acceptance checks repeated; the final full unit run passed.

Final outcomes:

- **143 unit files / 1,546 tests passed**.
- **TypeScript passed** with `npx tsc --noEmit --incremental false`.
- **Changed-file ESLint passed**.
- **Three distinct Chromium journeys passed**: two existing scoped administration/Audit/Action smoke journeys, plus rebuilt IQ owner evidence → independent review → closure/refresh, denied unrelated-owner access and exact record counts.
- The IQ browser journey used an isolated copy of the completed live snapshot. It did not complete the real Brave demo sample Actions or write its acceptance evidence into live storage.
- Final read-only Brave inspection showed `/audits`, the IQ disposable-demo banner, two IQ Audits and 32 total profiles.

The complete historical Playwright suite and a production build were not run. These results establish the supported local/demo workflow, not production authentication or server tenant isolation.

## How to use the live demo

1. Open **http://localhost:3000/audits** in the same Brave profile. It is already selected as Lakshman / IQ Factory 1. The two IQ Audits are listed under All.
2. Open **AUD-000003**, then **View Action** for Assembly or Quality. The canonical IDs are listed above.
3. To change a scoped person: **Account menu → OPS Super Admin → Account menu → exact person (Scoped OPS demo)**.
4. Open `/settings/administration`, select **Active context → IQ · IQ Factory 1**. For IQ Manoj Guru, choose **IQ · Client administration** instead. Existing ABC Manoj is a different identity.
5. As Suresh, open `/actions/ACT-000009`, explicitly select Action Type, start, add work/evidence, save and submit. As Priya Raman, use the same link to send back or verify/close. Lakshman is the independently recorded coordinator. General `/actions` remains denied in this Audit-only subscription.
6. Use `/settings/administration` to inspect the generated Departments, assignments, membership and Auditor Authorization. Do not treat the disposable flag as production approval.

No browser storage reset or test fixture import is needed for ordinary manual use of this rebuilt Brave demo. A separate browser/profile has separate local data.

## Source changes

- `lib/actions/action-store.ts`, `lib/five-s/audit-store.ts`: stop resurrecting/replacing samples in authoritative existing collections.
- `features/five-s/red-tag/store.ts`: lossless primary-photo alias storage compaction and in-memory restoration.
- `lib/organizations.ts`, `features/five-s/administration/iq-onboarding.ts`, `features/five-s/administration/iq-onboarding-panel.tsx`, `components/ops/access-context-boundary.tsx`: explicit disposable IQ metadata, accurate configuration state and visible demo label; no production activation operation.
- `lib/notifications/notification-store.ts`: acceptance repair for explicit retry after transient write failures; malformed-read protection retained.
- `scripts/ops-iq-demo-prepare.cjs`: private-snapshot preparation using canonical commands; does not itself commit live browser storage.
- `tests/demo-cleanup-persistence.test.ts`: prevent fixture resurrection and prove lossless alias handling.
- `tests/access-v3-phase2.test.ts`: characterize the existing legacy client branch without obsolete new-client/staging assumptions; original permission/history assertions retained.
- `e2e/iq-demo-acceptance.spec.ts`: opt-in isolated acceptance of the actual rebuilt IQ snapshot.
- This report, `OPS-IQ-DEMO-REBUILD-MANIFEST.json`, and the updated initial cleanup status document.

**Completed for supported IQ demo workflows. No commit, push, merge or deployment.**
