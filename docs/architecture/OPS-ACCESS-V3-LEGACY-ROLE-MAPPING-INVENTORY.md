# OPS Access v3 — legacy role mapping inventory

Date: 21 October 2026. No individual role mapping is approved or applied.

## Inventory scope and privacy

This inventory uses the current repository-seeded canonical directory and source stores, read in an isolated in-memory browser-storage context. It includes stable user IDs, legacy role/permission combinations, canonical plant/Zone references and source-reference counts. It contains no names, email addresses, signatures, evidence or free-text operational content. It is not an export of a real user’s browser storage. Persisted custom legacy users in another browser must be inventoried in that authorized local context before any later mapping.

A reference count below counts exact ID/name fields recursively in the source snapshot, not distinct operational records. Historical activity/reviewer references are included, so counts can exceed record counts. Legacy name references are matched internally but names are omitted from this report. No data was changed to calculate the inventory.

## Mapping rules

- Stable `AdminUser.id` remains the person identity. Plant and Zone IDs remain unchanged.
- Legacy Admin, Auditor, Reviewer and Viewer labels confer no new v3 Client Admin or Factory Admin assignment.
- Existing seeded demo operational roles and historical owner/reviewer references remain intact.
- Proposed base roles are proposals only, including apparently direct Zone Leader/Zone Member matches.
- Auditor is not converted to a grant in Phase 1. No grant, expiry or revocation model is implemented.
- The existing platform identity remains the explicit platform identity. Its current legacy Admin/configuration support exceptions are inventoried below, not converted to factory authority.
- Explicit administration assignments made later through the new confirmed UI are attributed events. They do not rewrite the person’s legacy role array or constitute a blanket role migration.

## Existing stable identities and references

A / C / Au / R / G / V mean Actions / CI / Audit / Red Tag / Gemba / Visual Management. Permission profiles are expanded in the next section.

| Stable user ID | Existing roles | Permissions | Plant | Existing Zone responsibility | Reference counts A/C/Au/R/G/V | Proposed target | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `USR-LAKSHMAN` | Admin, Auditor, Zone Leader | P01 | PLANT-EGM | ZONE-A: Leader | 59/6/5/3/29/28 | Operational Zone Leader membership in confirmed factory/Zone; separate review of Admin/Auditor powers | Required; unresolved |
| `USR-RUMESH` | Zone Leader | P02 | PLANT-EGM | ZONE-B: Leader | 52/56/2/0/22/20 | Operational Zone Leader membership in confirmed factory/Zone; separate review of Admin/Auditor powers | Required; unresolved |
| `USR-MANOJ-GURU` | Zone Leader | P02 | PLANT-EGM | ZONE-C: Leader | 5/0/2/0/0/8 | Operational Zone Leader membership in confirmed factory/Zone; separate review of Admin/Auditor powers | Required; unresolved |
| `USR-ANAND` | Zone Leader | P02 | PLANT-EGM | ZONE-D: Leader | 2/0/0/0/0/6 | Operational Zone Leader membership in confirmed factory/Zone; separate review of Admin/Auditor powers | Required; unresolved |
| `USR-RITIKA` | Zone Member | P03 | PLANT-EGM | ZONE-A: Member | 5/12/0/0/3/18 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-JAMES` | Zone Member | P03 | PLANT-EGM | ZONE-A: Member | 0/4/0/0/3/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-VASANTH` | Zone Member | P03 | PLANT-EGM | ZONE-A: Member | 0/0/0/0/0/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-GURUMURTHI` | Zone Member | P03 | PLANT-EGM | ZONE-A: Member | 0/0/0/0/0/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-VENKATESAN` | Zone Member | P03 | PLANT-EGM | ZONE-A: Member | 0/0/0/0/0/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-SIVA-KUMAR` | Zone Member | P03 | PLANT-EGM | ZONE-B: Member | 34/138/0/0/3/20 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-SUBURAMIANI` | Zone Member | P03 | PLANT-EGM | ZONE-B: Member | 0/0/0/0/3/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-RAJ-KUMAR` | Zone Member | P03 | PLANT-EGM | ZONE-B: Member | 2/0/0/0/3/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-RAMAN` | Zone Member | P03 | PLANT-EGM | ZONE-B: Member | 5/10/0/0/0/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-ZEROME` | Zone Member | P03 | PLANT-EGM | ZONE-B: Member | 0/0/0/0/0/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-MADAVAN` | Zone Member | P03 | PLANT-EGM | ZONE-C: Member | 0/0/0/0/0/10 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-NASAR` | Zone Member | P03 | PLANT-EGM | ZONE-C: Member | 0/0/0/0/2/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-PANDIYAN` | Zone Member | P03 | PLANT-EGM | ZONE-C: Member | 0/0/0/0/0/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-MAHIYAS` | Zone Member | P03 | PLANT-EGM | ZONE-C: Member | 0/0/0/0/0/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-AKILA` | Zone Member | P03 | PLANT-EGM | ZONE-C: Member | 0/0/0/0/0/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-MEENA` | Zone Member | P03 | PLANT-EGM | ZONE-D: Member | 6/0/0/0/3/6 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-SURIYA` | Zone Member | P03 | PLANT-EGM | ZONE-D: Member | 0/0/0/0/0/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-RAHUL` | Zone Member | P03 | PLANT-EGM | ZONE-D: Member | 0/0/0/0/0/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-VIJAY` | Zone Member | P03 | PLANT-EGM | ZONE-D: Member | 0/0/0/0/3/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-MOHAMMED` | Zone Member | P03 | PLANT-EGM | ZONE-D: Member | 0/0/0/0/0/0 | Operational Zone Member membership in confirmed factory/Zone | Required; unresolved |
| `USR-OPS-SUPER-ADMIN` | Admin | P01 | platform | None | 0/0/0/0/0/0 | Retain explicit platform identity; no client/factory assignment | No new mapping; existing platform identity retained |

## Existing permission profiles

### P01

`dashboard.view`, `audits.view`, `audits.create`, `audits.execute`, `audits.complete`, `actions.view`, `actions.create`, `actions.assign`, `actions.work`, `actions.review`, `actions.close`, `reports.view`, `reports.export`, `ci.view`, `ci.create`, `ci.review`, `ci.implement`, `ci.complete`, `red_tag.view`, `red_tag.create`, `red_tag.manage`, `red_tag.print`, `administration.view`, `administration.manage_users`, `administration.manage_roles`, `administration.manage_configuration`

### P02

`dashboard.view`, `audits.view`, `actions.view`, `actions.assign`, `reports.view`, `ci.view`, `ci.review`, `red_tag.view`, `red_tag.manage`, `red_tag.print`

### P03

`dashboard.view`, `audits.view`, `actions.view`, `actions.work`, `ci.view`, `ci.create`, `ci.implement`, `ci.complete`, `red_tag.view`, `red_tag.create`

## Other supported persisted legacy combinations

The directory type permits multiple roles and explicit customized permission arrays. These may exist in browser-local data even though they are absent from the repository seed. They cannot be safely inferred from seeded examples.

| Legacy role/combination | Current consumers | Proposed treatment | Approval required |
| --- | --- | --- | --- |
| Admin alone or combined | Administration, settings, source workflows, Action management and deletion | Inventory actual plant, permissions and work. Explicit admin assignments only, no automatic Client Admin/FA grant | Yes |
| Auditor, with/without Zone Leader | Audit create/complete, Gemba authority, Action creation/review, report export | Preserve existing behavior. Review later eligibility/scope under D04/D07. No auditor authorization created | Yes |
| Reviewer, possibly combined | Action review/closure, CI review and broad CI view | Preserve pending reviews and previous decisions. Do not map CI authority until D05 | Yes |
| Viewer | Compatibility view permissions, CI broad view; not a v3 Standard User role | Preserve view-only data. Proposed Standard User needs explicit membership/Zone mapping, not a string rename | Yes |
| Zone Leader / Zone Member with custom permissions | Operational helpers plus stored permission array | Inventory exact permissions, all allocations, leadership and ownership. No preset recomputation during mapping | Yes |
| Platform Admin support exceptions | Tenant entitlements, legacy user administration/configuration, organization-scoped Audit questions | Retain existing exceptions and restrict all new factory mutations to explicit authorities. No generic operational platform override added | No additional exception approved |

## Ownership and reviewer reference inventory

The following representative source paths identify the field relationships without including personal or record content. Array offsets refer to the inspected canonical seed snapshot. Each person’s total reference counts above include all matches; up to eight paths per module are shown here for traceability.

| Stable user ID | Module | Representative field paths |
| --- | --- | --- |
| `USR-LAKSHMAN` | Actions | `[0].zoneLeaderId`, `[0].zoneLeaderName`, `[0].createdByUserId`, `[0].createdByName`, `[0].auditor`, `[0].activityHistory[0].actorId`, `[0].activityHistory[0].actorName`, `[3].createdByUserId` |
| `USR-LAKSHMAN` | CI | `[6].zoneLeaderId`, `[6].zoneLeaderName`, `[6].timeline[2].actorId`, `[6].timeline[2].actorName`, `[6].reviewedById`, `[6].reviewedByName` |
| `USR-LAKSHMAN` | Audit | `[0].auditor`, `[1].auditor`, `[2].auditor`, `[3].auditor`, `[10].auditor` |
| `USR-LAKSHMAN` | RedTag | `[0].createdById`, `[0].createdByName`, `[0].history[0].actor` |
| `USR-LAKSHMAN` | Gemba | `.walks[0].leadId`, `.walks[0].leadName`, `.walks[0].activity[0].userId`, `.walks[0].activity[0].userName`, `.walks[0].activity[1].userId`, `.walks[0].activity[1].userName`, `.walks[0].activity[2].userId`, `.walks[0].activity[2].userName` |
| `USR-LAKSHMAN` | VM | `.boards[0].owner.id`, `.boards[0].owner.name`, `.boards[0].members[0].id`, `.boards[0].members[0].name`, `.boards[4].members[1].id`, `.boards[4].members[1].name`, `.boards[5].members[1].id`, `.boards[5].members[1].name` |
| `USR-RUMESH` | Actions | `[1].zoneLeaderId`, `[1].zoneLeaderName`, `[1].auditor`, `[2].zoneLeaderId`, `[2].zoneLeaderName`, `[2].auditor`, `[2].reviewedBy`, `[2].activityHistory[1].actorId` |
| `USR-RUMESH` | CI | `[0].zoneLeaderId`, `[0].zoneLeaderName`, `[0].timeline[2].actorId`, `[0].timeline[2].actorName`, `[0].reviewerId`, `[0].reviewerName`, `[1].zoneLeaderId`, `[1].zoneLeaderName` |
| `USR-RUMESH` | Audit | `[4].auditor`, `[5].auditor` |
| `USR-RUMESH` | Gemba | `.walks[2].leadId`, `.walks[2].leadName`, `.walks[2].activity[0].userId`, `.walks[2].activity[0].userName`, `.walks[2].activity[1].userId`, `.walks[2].activity[1].userName`, `.walks[2].activity[2].userId`, `.walks[2].activity[2].userName` |
| `USR-RUMESH` | VM | `.boards[2].owner.id`, `.boards[2].owner.name`, `.boards[2].members[0].id`, `.boards[2].members[0].name`, `.boards[4].owner.id`, `.boards[4].owner.name`, `.boards[4].members[0].id`, `.boards[4].members[0].name` |
| `USR-MANOJ-GURU` | Actions | `[13].assignedTo`, `[13].responsiblePersonName`, `[18].assignedTo`, `[18].responsiblePersonName`, `[18].completedByName` |
| `USR-MANOJ-GURU` | Audit | `[6].auditor`, `[7].auditor` |
| `USR-MANOJ-GURU` | VM | `.boards[0].members[3].id`, `.boards[0].members[3].name`, `.boards[3].members[1].id`, `.boards[3].members[1].name`, `.meetings[1].participants[3].id`, `.meetings[1].participants[3].name`, `.meetings[3].participants[3].id`, `.meetings[3].participants[3].name` |
| `USR-ANAND` | Actions | `[6].zoneLeaderId`, `[6].zoneLeaderName` |
| `USR-ANAND` | VM | `.boards[1].members[2].id`, `.boards[1].members[2].name`, `.boards[3].members[2].id`, `.boards[3].members[2].name`, `.meetings[0].participants[2].id`, `.meetings[0].participants[2].name` |
| `USR-RITIKA` | Actions | `[4].assignedTo`, `[4].responsiblePersonId`, `[4].responsiblePersonName`, `[4].activityHistory[1].actorId`, `[4].activityHistory[1].actorName` |
| `USR-RITIKA` | CI | `[6].proposedById`, `[6].proposedByName`, `[6].ownerId`, `[6].ownerName`, `[6].memberIds[0]`, `[6].memberNames[0]`, `[6].participants[0].id`, `[6].participants[0].name` |
| `USR-RITIKA` | Gemba | `.walks[0].participants[0].id`, `.walks[0].participants[0].name`, `.observations[4].peopleInvolved[0]` |
| `USR-RITIKA` | VM | `.boards[0].members[1].id`, `.boards[0].members[1].name`, `.boards[3].owner.id`, `.boards[3].owner.name`, `.boards[3].members[0].id`, `.boards[3].members[0].name`, `.boards[4].members[2].id`, `.boards[4].members[2].name` |
| `USR-JAMES` | CI | `[6].memberIds[1]`, `[6].memberNames[1]`, `[6].participants[1].id`, `[6].participants[1].name` |
| `USR-JAMES` | Gemba | `.walks[0].participants[1].id`, `.walks[0].participants[1].name`, `.observations[5].peopleInvolved[0]` |
| `USR-SIVA-KUMAR` | Actions | `[0].assignedTo`, `[0].responsiblePersonId`, `[0].responsiblePersonName`, `[1].assignedTo`, `[1].responsiblePersonId`, `[1].responsiblePersonName`, `[1].createdByUserId`, `[1].createdByName` |
| `USR-SIVA-KUMAR` | CI | `[0].proposedById`, `[0].proposedByName`, `[0].ownerId`, `[0].ownerName`, `[0].memberIds[0]`, `[0].memberNames[0]`, `[0].participants[0].id`, `[0].participants[0].name` |
| `USR-SIVA-KUMAR` | Gemba | `.walks[2].participants[0].id`, `.walks[2].participants[0].name`, `.observations[0].peopleInvolved[0]` |
| `USR-SIVA-KUMAR` | VM | `.boards[0].members[2].id`, `.boards[0].members[2].name`, `.boards[2].members[1].id`, `.boards[2].members[1].name`, `.boards[4].members[3].id`, `.boards[4].members[3].name`, `.meetings[1].participants[2].id`, `.meetings[1].participants[2].name` |
| `USR-SUBURAMIANI` | Gemba | `.walks[2].participants[2].id`, `.walks[2].participants[2].name`, `.observations[2].peopleInvolved[0]` |
| `USR-RAJ-KUMAR` | Actions | `[8].responsiblePersonId`, `[8].responsiblePersonName` |
| `USR-RAJ-KUMAR` | Gemba | `.walks[2].participants[1].id`, `.walks[2].participants[1].name`, `.observations[1].peopleInvolved[0]` |
| `USR-RAMAN` | Actions | `[2].assignedTo`, `[2].responsiblePersonId`, `[2].responsiblePersonName`, `[2].completedByUserId`, `[2].completedByName` |
| `USR-RAMAN` | CI | `[0].memberIds[1]`, `[0].memberNames[1]`, `[0].participants[1].id`, `[0].participants[1].name`, `[2].afterEvidence[0].uploadedBy`, `[2].evidence[0].uploadedBy`, `[9].memberIds[1]`, `[9].memberNames[1]` |
| `USR-MADAVAN` | VM | `.boards[1].owner.id`, `.boards[1].owner.name`, `.boards[1].members[0].id`, `.boards[1].members[0].name`, `.meetings[0].lead.id`, `.meetings[0].lead.name`, `.meetings[0].participants[0].id`, `.meetings[0].participants[0].name` |
| `USR-NASAR` | Gemba | `.walks[1].participants[0].id`, `.walks[1].participants[0].name` |
| `USR-MEENA` | Actions | `[6].assignedTo`, `[6].responsiblePersonId`, `[6].responsiblePersonName`, `[6].completedByUserId`, `[6].completedByName`, `[6].evidence[0].uploadedBy` |
| `USR-MEENA` | Gemba | `.walks[3].participants[0].id`, `.walks[3].participants[0].name`, `.observations[6].peopleInvolved[0]` |
| `USR-MEENA` | VM | `.boards[1].members[1].id`, `.boards[1].members[1].name`, `.boards[2].members[2].id`, `.boards[2].members[2].name`, `.meetings[0].participants[1].id`, `.meetings[0].participants[1].name` |
| `USR-VIJAY` | Gemba | `.walks[3].participants[1].id`, `.walks[3].participants[1].name`, `.observations[7].peopleInvolved[0]` |

## Source model field coverage

- Actions: responsible/created-by/reviewer IDs and names, assignee/auditor compatibility fields, activity/review/reassignment/submission histories. Canonical source: `lib/actions/action-store.ts` and `features/five-s/types/my-actions.ts`.
- CI: proposer, owner, members/participants, Zone Leader/reviewer IDs and names, timelines/approval/completion events.
- Audit: current assigned auditor name, signature user metadata, question-linked Actions and historical snapshots. Existing Audit auditor identity is still partly name-based.
- Red Tag: creator, receiving Zone Leader/reviewer, responsible person, disposition and verification metadata, linked Actions.
- Gemba: lead, participants, observer, walk activity, horizontal deployment recipients/history and source links.
- Visual Management: board owner/members, meeting lead/participants, topics, KPI reviews and historical activity/source metadata.
- Deleted sources and Actions: tombstones and retained canonical raw records remain in browser storage. The default seed inventory has no deletion history. A later browser-local inventory must include raw retained archives, not just active listing projections.

## Phase 1 compatibility boundary

The new `access-v3-state.ts` starts with no memberships or assignments. `access-v3-store.ts` has no automatic legacy-role migration. Missing organization ownership on existing Plant records resolves only through the explicit existing demo-organization compatibility association. This association grants no person authority.

Existing legacy profile maintenance remains available and creates no v3 assignments. Legacy person creation is retired: `createAdminUser` rejects new legacy role/permission payloads. Tests needing pre-existing Auditor/Reviewer/Admin fixtures now seed existing persisted identities directly, retaining their authorization and workflow assertions. The legacy Add User UI is removed; new factory Add User uses the exact three-role allow-list. The old commands reject scoped-profile edits and do not provide a way to inject legacy privileges into newly created v3 profiles. Legacy directory UI hooks exclude scoped profiles, preserving client privacy. These compatibility commands remain frontend/demo behavior and are not a production security boundary.

## Existing platform support/operational exceptions preserved

These are confirmed code-level pre-existing allowances, not new v3 authority and not newly broadened to new client factories. They require later policy review where the relevant decision is unresolved.

| Surface | Existing exception / boundary | Source |
| --- | --- | --- |
| Tenant entitlements | Authenticated platform identity edits client subscriptions | `lib/module-entitlements.ts` |
| Audit questions/configuration | Explicit platform support for organization-scoped configuration | `features/settings/audit-configuration-permissions.ts` |
| Legacy profile maintenance | Seeded platform identity retains legacy Admin permissions for existing profiles; new legacy creation is retired | `features/five-s/administration/store.ts` |
| Gemba | Platform view allowance exists; walk mutation/conduct deny the platform identity | `features/gemba/gemba-access.ts` |
| Red Tag | Existing Admin plus All-organizations plant scope can pass creation/manage checks in the configured demo scope; receiving-leader evaluation is still a separate restriction | `features/five-s/red-tag/access.ts`, `store.ts` |
| Audit | Existing create/start/draft command gaps and Admin/All-organizations completion path remain; no new scheduling/execution policy is introduced | `lib/five-s/audit-store.ts` |
| Visual Management | Existing Admin/All-organizations branch allows board operation; platform view allowance exists | `features/visual-management/visual-management-access.ts` |
| Actions | Existing Admin/all-organizations visibility and some Admin edit/review predicates remain; canonical creation/start and operational deletion have their explicit platform denials | `features/actions/action-center-data.ts`, `lib/actions/action-store.ts`, `action-creation-access.ts`, `lib/records/record-deletion.ts` |
| CI | Existing explicit platform denial remains | `features/five-s/continuous-improvement/access.ts` |

No generic platform override was added to any operational module. Retiring or narrowing the pre-existing exceptions is outside Phase 1 and must follow the relevant approved policy and regressions.

## Mapping approval checklist

- [ ] Inventory actual persisted custom legacy users in the authorized browser/client context.
- [ ] Verify canonical client/plant/Zone IDs, including duplicate display names.
- [ ] Record the person’s actual legacy roles AND customized permissions.
- [ ] Review all outstanding/historical owners, reviewers, signatures and source relationships, including deletion archives.
- [ ] Approve each person’s factory base roles, Zone allocations and any distinct administrative assignment.
- [ ] Leave Client Admin, Factory Admin and auditor grants absent unless separately and explicitly authorized.
- [ ] Resolve D03–D08/D10 before changing affected workflows.
- [ ] Test compatibility on a preserved payload and verify IDs/history/evidence unchanged.

No legacy user has been converted or promoted by this task. Operational role mapping remains unresolved and must not be inferred from this inventory.
