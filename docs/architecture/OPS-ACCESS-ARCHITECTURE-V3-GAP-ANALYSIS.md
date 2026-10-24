# OPS Access Architecture v3 — gap analysis

Date: 21 October 2026. Status: audit complete, implementation not authorized.

## 1. Executive summary

OPS has reusable browser-local foundations: a canonical user directory, configurable plants and Zones, module registration and organization entitlements, source-specific permission helpers, shared Action creation and lifecycle, cross-module Linked Records, and Admin-only operational deletion. Keep these systems and their existing IDs. Rebuilding Action Center would add risk without addressing the access-model gaps.

The v3 administration hierarchy is **not implemented**. There is no Client Admin role, Factory Admin assignment entity, Standard User role, factory membership model, or scoped auditor grant/history. The current Admin combines organization configuration and operational authority. Auditor is a separate role with extra operational permissions. These differences require explicit model and policy changes, rather than label substitutions.

Frontend authorization is uneven. Session-bound commands exist for Action creation/start, Red Tag creation and deletion, but several source/configuration commands accept a known directory ID or have only UI access checks. Current organization separation is selective: entitlements and some Audit configuration support organization IDs, while the normal shell, directory and operational stores largely belong to the fixed demo organization. This is not a production tenant isolation boundary.

Highest risks are accidental promotion through Add User, losing historical ownership during membership changes, widening Gemba access by granting walk-management authority, replacing CI's approval policy incorrectly, and letting an auditor grant confer unrelated privileges. Phase 1 must begin only after review of the decisions in section 8.

## 2. Scope, source precedence and method

**Proposed requirement source:** `/Users/rumesh-9634/Downloads/MetricMind_Operational_Excellence_Access_Architecture_v3.pptx`, nine slides. SHA-256: `9f0998ae7019c5cf7bc6086d16c1861f21052e1bf6260a34a94c170d9aecadcf`.

All nine slide XML texts, including permission-table rows, were extracted and reviewed. This was content inspection, not a PowerPoint visual/layout review. Slides are referenced as S1–S9 below. S2/S5 define the hierarchy and factory Add User rule. S3 defines settings and administration. S4 defines the module matrix. S5 defines auditor grant/revoke attribution. S6 defines shared Actions and directory. S7 defines Gemba/CI. S8 defines screens, command/API enforcement and logs. S9 provides acceptance requirements. The pasted brief adds preservation requirements, including cross-Zone Red Tags, Admin-only deletion, existing Action Type work and source completion dependencies.

Repository behavior is the source for the **current** state. The presentation defines the **target**, subject to reconciliation of approved workflow rules. No assumption that an exposed UI control represents a complete feature was used.

**Confirmed** means directly supported by inspected implementation or an executed existing test. **Likely** marks consequences inferred from those findings. **Not verified** marks runtime or business behavior not established here. Gap labels are Already implemented, Partially implemented, Missing, Conflicting and Needs business clarification. “Already implemented” always means within the current browser-demo scope unless explicitly qualified.

Only the two requested Markdown reports are created. Production code, test definitions, stored data, permissions, workflows and the presentation are unchanged. Existing uncommitted listing/deletion/Action work is part of this audit baseline.

### Source evidence catalog

Line anchors refer to the inspected working tree, including existing local work. Some source files are compact, so one line contains several related functions.

| Evidence | Responsibility | Repository reference |
| --- | --- | --- |
| E01 | Client catalog | [lib/organizations.ts:1](../../lib/organizations.ts#L1) |
| E02 | Platform UI | [features/super-admin/super-admin.tsx:41](../../features/super-admin/super-admin.tsx#L41) |
| E03 | Platform route guard | [components/super-admin/super-admin-guard.tsx:9](../../components/super-admin/super-admin-guard.tsx#L9) |
| E04 | Entitlement commands | [lib/module-entitlements.ts:72](../../lib/module-entitlements.ts#L72) |
| E05 | Plant and Zone model/store | [lib/organization-store.ts:9](../../lib/organization-store.ts#L9) |
| E06 | Directory model | [features/five-s/administration/types.ts:1](../../features/five-s/administration/types.ts#L1) |
| E07 | Directory commands | [features/five-s/administration/store.ts:21](../../features/five-s/administration/store.ts#L21) |
| E08 | Factory user editor | [features/five-s/administration/users-page.tsx:135](../../features/five-s/administration/users-page.tsx#L135) |
| E09 | Role presets | [features/five-s/administration/permissions.ts:5](../../features/five-s/administration/permissions.ts#L5) |
| E10 | Demo identities | [lib/current-user.ts:17](../../lib/current-user.ts#L17) |
| E11 | Authenticated demo actor | [lib/demo-session.ts:16](../../lib/demo-session.ts#L16) |
| E12 | Settings access | [features/settings/settings-access.tsx:17](../../features/settings/settings-access.tsx#L17) |
| E13 | Audit configuration policy | [features/settings/audit-configuration-permissions.ts:13](../../features/settings/audit-configuration-permissions.ts#L13) |
| E14 | Red Tag policy | [features/five-s/red-tag/access.ts:9](../../features/five-s/red-tag/access.ts#L9) |
| E15 | Gemba policy | [features/gemba/gemba-access.ts:11](../../features/gemba/gemba-access.ts#L11) |
| E16 | CI policy | [features/five-s/continuous-improvement/access.ts:16](../../features/five-s/continuous-improvement/access.ts#L16) |
| E17 | CI commands | [features/five-s/continuous-improvement/store.ts:242](../../features/five-s/continuous-improvement/store.ts#L242) |
| E18 | Audit create/start/draft | [lib/five-s/audit-store.ts:312](../../lib/five-s/audit-store.ts#L312) |
| E19 | Audit completion policy | [lib/five-s/audit-store.ts:603](../../lib/five-s/audit-store.ts#L603) |
| E20 | VM policy | [features/visual-management/visual-management-access.ts:46](../../features/visual-management/visual-management-access.ts#L46) |
| E21 | Canonical Action model | [features/five-s/types/my-actions.ts:1](../../features/five-s/types/my-actions.ts#L1) |
| E22 | Action creation authorization | [lib/actions/action-creation-access.ts:12](../../lib/actions/action-creation-access.ts#L12) |
| E23 | Action commands and lifecycle | [lib/actions/action-store.ts:373](../../lib/actions/action-store.ts#L373) |
| E24 | Shared creation and assignees | [features/actions/create-linked-action-dialog.tsx:68](../../features/actions/create-linked-action-dialog.tsx#L68) |
| E25 | Action visibility | [features/actions/action-center-data.ts:56](../../features/actions/action-center-data.ts#L56) |
| E26 | Canonical linked records | [lib/relationships/use-canonical-linked-records.ts:26](../../lib/relationships/use-canonical-linked-records.ts#L26) |
| E27 | Deletion command | [lib/records/record-deletion.ts:12](../../lib/records/record-deletion.ts#L12) |
| E28 | Deletion archive | [lib/records/record-tombstones.ts:12](../../lib/records/record-tombstones.ts#L12) |
| E29 | Unprotected organization writes | [lib/organization-store.ts:131](../../lib/organization-store.ts#L131) |
| E30 | Action settings writes | [lib/actions/action-configuration-store.ts:180](../../lib/actions/action-configuration-store.ts#L180) |
| E31 | Protected custom questions | [features/settings/custom-audit-questions/store.ts:122](../../features/settings/custom-audit-questions/store.ts#L122) |
| E32 | Zone directory projection | [lib/five-s/configuration.ts:64](../../lib/five-s/configuration.ts#L64) |
| E33 | Audit create UI | [features/five-s/components/FiveSAuditCreate.tsx:140](../../features/five-s/components/FiveSAuditCreate.tsx#L140) |
| E34 | Plant/Zone settings UI | [features/settings/organization-settings-pages.tsx:34](../../features/settings/organization-settings-pages.tsx#L34) |
| E35 | Audit listing entry | [features/five-s/audit-list-page.tsx:131](../../features/five-s/audit-list-page.tsx#L131) |
| E36 | Module route gate | [components/modules/module-gate.tsx:10](../../components/modules/module-gate.tsx#L10) |
| E37 | VM configuration writes | [features/visual-management/visual-management-configuration-store.ts:135](../../features/visual-management/visual-management-configuration-store.ts#L135) |
| E38 | Gemba observation command | [features/gemba/gemba-store.ts:410](../../features/gemba/gemba-store.ts#L410) |
| E39 | Red Tag navigation | [features/five-s/red-tag/red-tag-nav.tsx:7](../../features/five-s/red-tag/red-tag-nav.tsx#L7) |

## 3. Current architecture map

| Responsibility | Actual source of truth | Confirmed current behavior |
| --- | --- | --- |
| Platform client catalog | E01/E02 | Two static organization entries. Plant/user figures are catalog numbers, not authoritative directory aggregates. Overview and module settings exist. Users/Configuration tabs are disabled labels. No tenant creation/status mutation command was found. |
| Platform identity | E03/E10/E11 | Fixed platform demo persona, boolean route guard. Entitlement mutation separately requires the authenticated active platform identity. A UI guard alone does not resolve an active session. |
| Organization entitlements | E04/E36 and `lib/modules.ts` | Per-organization enable/disable persistence. Ordinary shell uses `DEMO_ORGANIZATION`, not selected tenant membership. Entitlement is not a user role or factory grant. |
| Physical sites | E05/E29/E34 | `OrganizationPlant` has stable ID, name, code, manager, status. `OrganizationZone.plantId` associates Zones to a plant. Neither type embeds organization ID. Plant manager is metadata, not a Factory Admin authority grant. |
| User directory | E06/E07/E08 | `AdminUser.id`, employee ID and email uniqueness, roles array, permissions array, one plant string, Zone memberships using names. Add/edit/activate/deactivate and leadership allocation exist. No factory membership history or Client Admin assignment. |
| Current actor | E10/E11 and `components/auth/auth-provider.tsx` | Browser-local login flag plus one of four selectable demo identities. New directory users do not automatically become independently authenticated login accounts. `useCurrentUser` overlays directory/profile fields; not every command uses the stronger session resolver. |
| Base roles/capabilities | E09 | Admin, Auditor, Zone Leader, Zone Member, Reviewer and compatibility Viewer. Permissions stored on user; role presets derive UI defaults, while store commands can accept explicit permission arrays. No single v3 scope/policy authority. |
| Operational access | E14–E20/E38 | Separate module helpers and lifecycle checks. Some check session and scope, others directory ID, primary Zone or supplied identity fields. |
| Action service | E21–E25 | One `MyAction` model/store and Action Center, shared linked creation, source module/record/child references, owners/reviewers, evidence, history, lifecycle and Immediate/Corrective Action Type. |
| Relationships | E26 and `lib/relationships/canonical-records.ts` | Canonical derived plus persisted edges, scoped catalogs and source routing. Name-based scopes and fixed demo tenant assumptions remain. |
| Operational deletion | E27/E28 | Current authenticated non-platform Admin, same plant and module access. Tombstone with source metadata, retained Actions, no cascade, persistent deleted-source references. |
| Historical identity safeguards | E07/E21/E23 | Outstanding Action/CI transfer before user deactivation, historical ID/name snapshots and Action reassignment history. These are not a complete administration audit log. |

### Entity mapping: no automatic equivalence

- **Client/tenant:** the closest existing entity is `Organization`. It is a static platform catalog plus selected organization-specific configuration, not a fully provisioned tenant with a membership directory.
- **Factory/site:** `OrganizationPlant` is the closest physical-site model. Proposed reuse requires an organization association and explicit admin assignments. Do not create a second independent Factory entity unless business confirms a factory differs from a plant.
- **Plant:** currently one physical site record, referenced by ID in Zones but often by name in users and operational records. The catalog's “3 plants” for ABC does not mean three configured plant records exist: the configuration seed contains Egmore only.
- **Zone:** stable configuration ID with parent `plantId`, leader and department. User memberships and many operational scopes use Zone names, which are unsafe as globally unique keys across factories.
- **Plant manager:** a descriptive `managerId` relationship. It does not currently confer Admin or Factory Admin permissions.
- **Factory Admin / Zone Champion:** target authority. Existing Admin is a migration candidate, not a verified equivalent. Existing Zone Leader is not this role.

## 4. Target hierarchy and role/module matrix

S2/S5 require platform Super Admin to manage clients, Client Admin to create sites and assign Factory Admin, and Factory Admin to manage factory users, Zones, auditor grants and settings. Only Factory Admin sees factory Add User. Its permitted base-role choices are Zone Leader, Zone Member and Standard User. Factory Admin assignment must use a separate Client Admin operation and reject forbidden escalation at the command boundary.

In the table, FA means scoped Factory Admin, ZL Zone Leader, ZM Zone Member, SU Standard User. Target Yes still requires active membership, tenant/factory/Zone scope and enabled modules. “Current” refers to existing roles, not an already completed v3 mapping.

| Capability / slide | FA target | ZL target | ZM target | SU target | Confirmed current behavior | Classification |
| --- | --- | --- | --- | --- | --- | --- |
| Factory Add User, S2/S5 | Yes | No | No | No | Admin/configured manager and platform persona can manage users. Add User includes Admin, Auditor, Reviewer. | Conflicting |
| Assign Factory Admin, S2/S9 | No, Client Admin only | No | No | No | No Client Admin or assignment command. Ordinary Admin can create another Admin. | Missing / conflicting |
| Settings and Zones, S3 | Assigned factories | No | No | No | Permission-based settings gates, platform exceptions, mixed store enforcement, some visible placeholder Settings tabs. | Partially implemented |
| Red Tag raise, S4 | Yes, existing leadership restriction applies | Yes except own leadership Zones | Yes | Yes | Admin/member/leader creation exists with canonical target-leader evaluation. Viewer cannot raise. SU missing. | Partially implemented |
| Red Tag view, S4 | Scoped | Scoped | Scoped | Scoped | Active plant/Zone access checks; Admin broader. Viewer has view preset. No v3 factory membership. | Partially implemented |
| Gemba observation, S4/S7 | Yes | Yes | Yes | Yes | `saveGembaObservation` requires walk mutation authority, currently Admin/Auditor only. | Conflicting |
| CI initiate, S4/S7 | Yes | Yes | Yes | No | Admin and Zone Member presets can create. Zone Leader lacks `ci.create`. Viewer lacks creation. | Conflicting |
| CI approve, S4/S7 | If assigned/authorized | Designated Zone Leader | No | No | New CI stores zone-leader reviewer ID, but helper accepts any same-primary-Zone user with `ci.review`, including Reviewer; Admin blanket approval. | Conflicting |
| Audit schedule, S4 | Yes | No by default | No | No | Admin and Auditor presets include creation; create/schedule/start commands lack a canonical authenticated scheduling authority check. | Conflicting |
| Audit execute, S4/S5 | Yes / assign auditor | Scoped auditor grant only | No default | No default | Auditor base role and name-based assigned-auditor completion. Draft/start paths do not uniformly enforce this policy. | Conflicting |
| VM view, S4 | Scoped | Scoped | Scoped | Scoped | Board access for Admin/Auditor, owner/members or same primary Zone. No SU identity or multi-factory scope. | Partially implemented |
| VM update, S4 | Yes | Yes in scope | Yes in scope | No | Admin, board owner, actual Zone leader and board members can operate. No explicit view-only base role exclusion for owners/members. | Partially implemented / conflicting |
| Action assignee, S4/S6 | Eligible | Eligible | Eligible | Eligible | Shared directory, but zone-member projection/creator/Audit-leader exceptions constrain options, and Viewer lacks work permission. | Partially implemented |
| Action create/manage, S4/S6 | Authorized source | Gemba/source rules | Gemba/source rules | Allowed source workflow | Shared source checks exist; Gemba restriction blocks target access, and grants are not normalized. Do not grant universal manual creation. | Partially implemented |
| Delete, brief | Undecided | No current right | No current right | No current right | Admin-only deletion exists. v3 omits Delete. | Needs business clarification |

S7's CI diagram names ZL/ZM initiators; S4 also explicitly permits FA. These are complementary, not a reason to remove FA creation. “All roles view VM” is interpreted with scope, not cross-client access. Auditing authority must not grant settings, user management or unrelated CI approval (S7).

## 5. Directory and data-model assessment

**Confirmed reusable parts:** stable `USR-*` identity IDs, employee ID/email duplicate checks, active state, ID-based ownership with retained names, user-backed Zone/board selection and deactivation protection. Preserve IDs and all historical references. Do not create another Action-assignee directory.

**Confirmed limitations:** `AdminUser.plant` is one name, memberships contain Zone names without factory IDs, and `useCurrentUser.primaryZone` uses the first membership. The editor writes one selected Zone and `setUserZoneMembership` replaces the membership list. `assignZoneLeader` forbids leading another Zone and replaces the incoming leader's memberships. These paths cannot safely represent multiple factories/Zones without modification. Administration commands do not enforce a target factory/client boundary: `requireManager` checks the active authenticated manager permission, then creation/update operates on the common directory.

### Smallest compatible target model (proposal only)

Retain a stable person/user ID. Add normalized **client membership**, **factory membership/base role**, **Zone allocation**, **Factory Admin assignment**, **auditor grant**, and **administration event** records. Prefer typed collections within existing directory/organization architecture over a second identity store. Exact placement is a Phase 1 design decision, not a new store commitment.

| Proposed concept | Minimal information | Compatibility requirement |
| --- | --- | --- |
| Person/profile | Existing user ID, profile, identifiers, active state | One person identity, never regenerate IDs to assign a second factory. Decide cross-client identity privacy before exposing a global directory. |
| Client membership | userId, organizationId, status, Client Admin authority | Separate membership from person status. Deactivation in one client must not silently deactivate all clients. |
| Factory membership | userId, organizationId, plantId, base operational role, status | One active role per factory is the recommended starting point, pending D01. Preserve compatibility reads for legacy plant names during later implementation. |
| Zone allocation | userId, organizationId, plantId, zoneId, responsibility/status | Multiple allocations without overwriting others. Resolve canonical IDs and scope before treating matching names as equal. |
| Factory Admin assignment | client/factory/user, assignedBy, timestamps/revocation | Client Admin command only, no factory Add User escalation. Manager metadata stays separate. |
| Auditor authorization | userId, organizationId, plantId, allowed zoneIds or explicit factory scope, grant/revoke actor and time, active state | Only an eligible Zone Leader, no new user or base role. Never infer grants merely from a role label. |
| Administration event | immutable event ID, actor, target, scope, before/after or change summary, timestamp, reason where required | Capture assignment, creation, roles, grants/revocations, settings changes; retain domain CI/Action histories. Browser log is not tamper-resistant. |

Do not mass-convert `roles: [Admin, Auditor, Zone Leader]` to one target base role. The seeded combined persona needs independently approved admin assignment, operational role and auditor grants. Keep compatibility until every consumer is updated. Rename operations must not rewrite historical actor/owner snapshots. No conversion or migration ran in this audit.

## 6. Auditor authorization assessment

Current Auditor is both an `AdminRole` and a Zone responsibility. Multiple roles can represent a Zone Leader plus Auditor, but neither form records who granted/revoked a scoped authorization. The Auditor preset includes Audit creation, Action creation/review/close and Reports export, and Gemba helpers treat it as walk authority. Merely introducing an `isAuditor` boolean would preserve the same coupling and omit scope/history.

Proposed effective permission: resolve active authenticated subject, active client/factory membership, Zone Leader eligibility and an active grant covering the requested factory/Zone at command time. Keep scheduling separate from execution. FA execution/assignment follows S4, scoped to assigned factories. A revocation must stop new execution writes according to the approved in-flight policy, preserve completed Audit signatures/history and avoid silently reassigning records. D04 must settle in-progress work, expiry and factory-wide versus Zone grants.

Auditor grants must not add role-preset permissions for settings, user administration, CI review, manual Actions or Gemba walk management. Those capabilities remain governed by the base role/source workflow. Existing Auditor-backed Action reviewer references require an explicit compatibility policy to avoid stranding pending review packages.

## 7. Common Action Plan assessment

**Already implemented within the demo:** E21–E26 provide one canonical `MyAction`/store, source module and record references, child references for Audit/Gemba, owners/reviewers, due dates/priority, statuses, finding/progress/resolution evidence, submissions, review/rework/closure, reverse links and Linked Records. Immediate/Corrective choice belongs to Start Action; creation rejects caller-supplied execution type/lifecycle metadata. Keep this behavior and the existing statuses.

**Modify incrementally:** shared assignee eligibility must admit every eligible target base role in scope and validate the same rules in the creation/reassignment commands. `getFiveSZoneConfiguration().members` excludes Leader responsibility. The shared dialog adds an Audit leader and eligible current actor, so it is not a general all-role selector. Creation additionally requires owner Zone membership, while reassignment uses Zone members. A Standard User assignee must receive permitted execution capability without gaining manual Action creation or VM update rights.

**Scope gaps:** canonical creation checks authenticated actor, demo organization, plant, Zone, owner and source entitlement. Action start uses a session-bound worker check. Other operations, such as due-date changes and some review/reassignment predicates, resolve a directory user from the supplied ID without equivalent current-session validation. Action visibility has primary-Zone/name fallbacks and no general multi-factory membership policy. These protections cannot be described as uniform yet.

Preserve owner/reviewer IDs, name snapshots, independent reviewer requirements, submission revisions, activity, original due dates/overrides and source references. If a user loses eligibility, require an explicit ownership transfer or approved historical read policy; do not fabricate completion. Deletion remains a tombstone operation, retaining linked Actions and unresolved source requirements.

## 8. Conflicts and business decisions

| Decision | What must be resolved | Recommended starting position, not approval |
| --- | --- | --- |
| D01 | Does factory equal existing plant? Can one person hold different base roles in different factories and lead multiple Zones? Is person identity shared across client tenants? | Reuse Plant as site, scope roles per factory, use one stable person ID with isolated memberships. Do not expose another client's profile. |
| D02 | How do current Admin, Reviewer, Auditor and Viewer map to v3? Can Client Admin perform factory operations without factory assignment? | Explicit mapping inventory. No automatic broad inheritance. Reviewer cannot keep CI approval simply because it has `ci.review`. |
| D03 | Should Factory Admin inherit current Admin-only operational Delete? Does Client Admin/platform support get deletion or read override? | Factory-scoped FA deletion is a candidate only. Keep existing command unchanged until approved; retain no-cascade/tombstone behavior. |
| D04 | Auditor grant scope, expiry, revocation during active Audit, and treatment of legacy Auditor reviewers/creators? | Effective scoped grants with retained history; no default unrelated authority. Approve transition handling before revocation enforcement. |
| D05 | How is FA specifically assigned/authorized for CI approval, and what happens when the designated Zone Leader changes? Are existing Reviewer approvals grandfathered? | Explicit record approval assignment or scoped delegation, no blanket FA approval. Preserve prior decisions and comments. |
| D06 | Which Zones are “permitted” for cross-Zone Red Tag raising and standard-user view? | Keep the existing own-leadership-Zone denial for every canonical leadership allocation, including combined Admin/leader users, and receiving leader evaluation. The general Yes matrix does not override this rule. |
| D07 | Does existing Audit own-Zone exclusion apply to FA execution and scoped auditor grants? Can scheduling choose an auditor independently? | Keep current cross-Zone audit UI restriction until resolved. Current create UI fixes auditor to current user's name; target scheduling/assignment needs deliberate change. |
| D08 | Does “all can raise Gemba observations” allow writing observations to someone else's walk, or require a designated scoped entry point? | Separate observation contribution from scheduling, starting and managing walks. No universal walk-admin grant. |
| D09 | Should platform Super Admin retain current organization Audit-question/configuration and user-management support powers? | Separate platform administration from factory business operations. S3 restricts factory settings; existing tests explicitly permit platform configuration. Retain current behavior until support policy is approved. |
| D10 | May Actions be assigned anywhere in a factory or only within the source Zone, and who independently reviews FA/ZL/SU-owned Actions? | Explicit eligible membership and reviewer policy. Never broaden manual creation or allow self-review as a side effect. |
| D11 | Are module entitlements tenant-wide only, with factory settings below them, or may a factory disable a tenant-enabled module? | Keep organization subscription entitlements platform-owned; add factory configuration only where required. FA “full access” must not enable unlicensed modules. |

CI approval conflicts are real: current creation records a Zone Leader reviewer but predicates use permission plus primary Zone or blanket Admin. Gemba all-role contribution conflicts with current Admin/Auditor-only write access. Current Audit creation and completion are different authorization surfaces. Existing cross-Zone Red Tag, Action Type and terminal-source dependencies are constraints to retain, not gaps to remove.

## 9. Detailed requirement gap matrix

Dependencies use decisions D01–D11 and phases P1–P5 in the companion plan. Tests T01–T15 are defined in section 11. Risk describes the consequence of a careless change, not exploitability of a production service.

| ID | v3 requirement | Implementation / evidence | Current behavior | Gap | Proposed change | Dependencies | Risk | Required tests | Business clarification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H01 | S1/S2 Super Admin creates/manages tenants | E01–E04 | Static catalog, module edits only | Partially implemented | Add deliberate tenant commands/UI and status with preserved IDs; no competing catalog | P1, D09 | High: wrong-client config | T01,T02 | Tenant lifecycle and support policy |
| H02 | S2 Client Admin creates factories/sites | E05/E29/E34 | Plant settings edit seeded sites, no Client Admin | Missing | Reuse plant entity with organization key and Client Admin-bound site creation | D01,P1 | High: orphan/mis-scoped sites | T01,T03 | Factory/plant mapping |
| H03 | S2/S5 Client Admin exclusively assigns FA | E06–E09 | Generic Admin creation/role editing | Missing / conflicting | Dedicated scoped assignment/revocation command and UI | D01,D02,P1 | Critical: privilege escalation | T01,T04 | Existing Admin mapping |
| H04 | S2/S5 only FA adds factory users | E07/E08/E12 | Admin permission/platform exception | Conflicting | Factory-scoped command, target-scope validation and visibility | P1/P2,D09 | High: cross-factory management | T04 | Platform support exception |
| H05 | S5 Add User only ZL/ZM/SU | E06/E08 | Admin/Auditor/Reviewer checkboxes, no SU | Conflicting | Factory Add User allow-list enforced in command, separate admin assignment | H03,D02 | Critical: self-promotion | T04 | Legacy roles compatibility |
| H06 | S3 FA manages Zones/allocations | E05/E07/E29/E34 | Admin UI; raw saveZone has no actor authorization | Partially implemented | Session/factory-scoped Zone commands, canonical IDs, allocation history | P1/P2,D01 | High: overwrite memberships | T03,T04 | Multi-Zone leadership |
| U01 | S5/S6 one user/person | E06/E07/E21 | Stable IDs and uniqueness within local directory | Partially implemented | Retain IDs; add memberships, no duplicate assignee profiles | P1,D01 | High: history split | T03,T10 | Cross-client identity policy |
| U02 | S5/S9 factory/Zone assignments | E06/E08/E10/E32 | One plant, name-based Zones, first Zone primary | Missing for target | Scoped membership records with IDs; update all primary-Zone consumers | P1/P2 | Critical: cross-site leakage | T03,T15 | Role variation by factory |
| U03 | S5 active user and historical identity | E07/E21/E23 | Active status, outstanding transfer guards, history snapshots | Partially implemented | Membership status separate from person status; preserve snapshots | P1/P4 | High: stranded owners | T03,T10,T12 | Scope revocation with open work |
| A01 | S4/S5 Auditor additional to ZL | E06/E09/E19 | Base role and Zone responsibility | Conflicting | Scoped grant model, no additional user/base role | P1/P2,D02 | High: implicit privilege spread | T05,T06 | Legacy Auditor mapping |
| A02 | S5 grant/revoke scope/history | E07/E08 | Role edit + updatedAt, no authorization event chain | Missing | Grant/revoke commands, factory/Zone scope, timestamps and attribution | A01,D04 | High: lost authority history | T05,T14 | Active-Audit revocation |
| A03 | S7 grant adds no unrelated powers | E09/E15/E22/E25 | Auditor includes Gemba/Action/review/report authority | Conflicting | Base capabilities independent of grant, preserve assigned-work transition | A01,D02,D04 | High: access loss/escalation | T05,T10 | Legacy review completion |
| M01 | S3 factory module settings only FA | E12/E13/E29–E31/E37/E39 | UI gates mixed, raw organization/Action settings writes lack authorization, platform Audit exceptions | Partially implemented / conflicting | Common scoped settings policy in navigation and every mutation; retain placeholders as nonfeatures | P2/P3,D09,D11 | Critical: UI-only enforcement | T06 | Platform settings support |
| M02 | S4 all four can raise Red Tags | E14 | Admin/ZL/ZM supported, Viewer no create | Partially implemented | Add scoped SU creation through existing command and receiving-leader checks | P2/P3,D06 | High: own-Zone bypass | T07,T08 | Scope of permitted Zones |
| M03 | S4 Red Tag view scoped | E14/E26 | Active same-plant membership/Admin broad access | Partially implemented | Canonical tenant/factory/Zone access, no name-only matches | P2/P3,D06 | High: record disclosure | T07,T15 | View scope |
| M04 | S4/S7 all four raise Gemba observation | E15/E38 | Writes require Admin/Auditor walk authority | Conflicting | Separate scoped observation contribution from walk management | P2/P3,D08 | High: accidental walk control | T08,T09 | Existing walk contribution model |
| M05 | S4/S7 FA/ZL/ZM initiate CI; no SU | E09/E16/E17 | ZL lacks ci.create; Admin/ZM allowed | Conflicting | Update base-role initiation policy and command session scope | P2/P3,D02 | Medium: denied/unauthorized proposals | T09 | Existing custom grants |
| M06 | S4/S7 designated ZL approves; FA only assigned | E16/E17 | Reviewer/same primary Zone/blanket Admin can approve | Conflicting | Explicit reviewer/delegation policy for proposal and completion review | P2/P3,D05 | High: incorrect approval authority | T09,T12 | Delegation and reassignment |
| M07 | S4 FA schedules; ZL not by default | E09/E18/E33/E35 | Auditor creation preset; store create/start lack authenticated schedule check | Conflicting | Separate schedule and execute policies, independent auditor selection | P2/P3,D07 | High: unauthorized Audits | T05,T11 | Own-Zone and auditor assignment |
| M08 | S4/S5 ZL execution only authorized | E18/E19/E33 | Completion requires Admin or named Auditor; draft/start not uniformly guarded | Conflicting | Grant validation at every execution mutation, independent scheduling check | A01/A02,P3 | Critical: unauthorized writes | T05,T11 | Revoked in-progress work |
| M09 | S4 all view VM | E20/E26 | Owner/member/primary-Zone/Admin/Auditor rules | Partially implemented | Use scoped membership view policy for all target categories | P2/P3 | High: board/meeting leakage | T13,T15 | Assigned-zone scope |
| M10 | S4 FA/ZL/ZM update, SU view-only | E20/E37 | Owner/member can update without SU role exclusion; caller-ID authority | Conflicting | Role plus board scope plus session, separate view/update/settings | P2/P3 | High: view-only user mutation | T06,T13 | Role exceptions require approval |
| C01 | S6 common Action service | E21–E24/E26 | Canonical shared model, store, sources and lifecycle | Already implemented | Reuse; adapt access only, retain Type/lifecycle/evidence | P4 | High if rewritten | T10,T12 | None for reuse |
| C02 | S4/S6 any eligible base role assignee | E22/E24/E32 | Members plus Audit leader/current actor exceptions; Viewer cannot work | Partially implemented | Shared eligibility policy for creation/reassignment and pickers | P2/P4,D10 | High: impossible assignments | T10,T12 | Factory versus source-Zone eligibility |
| C03 | S6 source/workflow controls Action creation/manage | E22/E23/E38 | Strong creation/start, mixed later command identity checks | Partially implemented | Uniform session/scope boundary around existing transitions | P2/P4,D10 | Critical: impersonated mutation | T01,T10,T12 | Review delegation |
| C04 | S6/S9 client/factory scope on Actions | E22/E25/E26 | Fixed demo tenant, plant/Zone strings, primary-Zone views | Partially implemented | Explicit scope IDs and shared membership resolver, compatibility reads | P1/P2/P4 | Critical: leakage/history lockout | T03,T10,T15 | Historical access after role change |
| L01 | Brief preserves cross-Zone Red Tag rule | E14 | Canonical own-leadership-Zone deny and target-leader evaluation | Already implemented | Retain on every new role/entry point, especially combined FA/ZL | D06,P3 | High: workflow regression | T07,T08 | No silent override |
| L02 | Brief Admin-only Delete; retain Actions | E27/E28 | Session-bound Admin/plant/module checks, tombstones, no cascade | Already implemented; target unclear | Preserve behavior until FA mapping approved; then scope policy only | D03,P4 | Critical: cascade/escalation | T12 | FA/Client Admin/platform rights |
| L03 | Brief preserve Action Type/source dependencies | E21/E23/E17 | Immediate/Corrective start, review/rework, unresolved linked Action guards | Already implemented | No new statuses or completion bypass from access changes | P3/P4 | High: false completion | T10,T12 | No new workflow decision implied |
| S01 | S8/S9 backend authenticated scope enforcement | E11/E36, current API inventory | Browser-local identity/storage; AI routes are not tenant authorization | Missing for production | Separate backend authentication, membership enforcement on reads/writes/files, tenant isolation and logs | Backend program after frontend policy approval | Critical for release | T15 + future API tests | Identity provider and production architecture |
| S02 | S5/S8 full administration/closure audit log | E07/E17/E21/E28 | Domain events/deletion metadata; no unified admin audit log | Partially implemented | Attributed browser events now in plan; immutable server audit later | P1/P2/P5,backend | High: untraceable privileges | T14 | Retention and event access |

## 10. Security boundaries and production needs

| Layer | Confirmed current state | Immediate planned change | Production requirement |
| --- | --- | --- | --- |
| A: UI | Module gates, Admin/settings visibility, role-based pages and row menus | Use effective scoped policies to hide forbidden controls and deny direct routes, preserving SSR loading behavior | UI remains a usability layer |
| B: Frontend command/store | Strong on selected commands; missing or caller-ID checks elsewhere | Authenticate current actor, resolve canonical target scope, verify memberships/grants/entitlements at command time before IDs, writes, files, events or links | Browser owners can edit storage; no claim of secure enforcement |
| C: Backend | No canonical tenant business persistence/auth service found. Existing API routes support Gemba voice and VM KPI analysis, not this hierarchy | No backend implementation or endpoint invention in this audit/initial UI plan | Authenticated person identity, server-side membership checks on every read/write/export/evidence access, tenant-bound DB queries, scoped files, revocation/session handling, transactions and tamper-resistant authorization logs |

Confirmed read/write examples: E35 reads the active Audit store directly into its listing without a role/factory visibility projection at that entry point. E18 scheduled-start and draft-save paths do not resolve the current authenticated actor. E17 CI creation resolves the supplied user ID and permission but does not independently require the current authenticated session or active creator status at that command boundary. E29 plant/Zone saves validate fields but not administration authority; E30 Action settings saves validate configuration rather than actor authority. These are concrete frontend gaps, even where corresponding pages have access controls. They are static code findings, not claims of a newly executed browser exploit.

A storage key containing an organization ID is not sufficient isolation. Production must derive client/factory context from authenticated memberships and the canonical target, reject caller scope escalation, and test identical display names across tenants. Full backend work remains a separately approved program; frontend phases cannot satisfy S9's server-side acceptance criterion by themselves.

## 11. Existing regression protection and required additions

The existing full unit suite was executed unchanged during this audit: **131 files, 1,285 tests passed** (`npx vitest run`, 21 October 2026). This validates the current baseline, including current policies that intentionally conflict with v3. It does not prove the target model. No Playwright, lint, TypeScript or build run was performed for this documentation-only audit. Earlier implementation results in QA reports are historical, not newly executed audit checks.

| Test ID | Existing tests inspected / located | What they protect | Required additions or controlled changes |
| --- | --- | --- | --- |
| T01 | `tests/p0-authorization-gaps.test.ts`, `tests/custom-audit-question-authorization.test.ts`, `e2e/p0-critical.spec.ts` | Unknown actor, ordinary-user entitlements/Action creation denial, configuration identity and organization checks, direct-route guards | Current-session impersonation tests for every new command, no stale grants, inactive subject and forged scopes; preserve platform cases until D09 approved |
| T02 | `tests/module-entitlements.characterization.test.ts`, `tests/settings-administration.characterization.test.ts` | Separate organization entitlements/persistence and settings behavior | Client lifecycle + Client Admin boundaries, factory cannot enable tenant-disabled capability |
| T03 | `tests/administration.characterization.test.ts`, `tests/organization-settings.characterization.test.ts`, `tests/fix01-ci-deactivation.test.ts` | Stable identity, duplicate employee/email checks, active status/ownership transfer, organization config | One person/multiple factories/Zones, no duplicate identity, per-membership revocation, duplicate Zone names, stable history |
| T04 | Administration tests, `tests/settings-administration.characterization.test.ts` | Existing Admin editing and permissions | Factory Add User allow-list in UI/command; FA cannot assign FA, ZL/ZM/SU denied; existing test allowing generic Admin creation needs approved policy-specific fixture/expectation update, not blanket removal |
| T05 | `tests/audit-scheduling.characterization.test.ts`, `tests/audit-configured-execution.test.ts` | Audit scheduling states, timing, snapshots and configured execution | Grant/revoke/scope history, FA scheduling vs execution, ZL with/without grant, other roles denied; no settings/CI/Action privileges inherited |
| T06 | `tests/audit-settings-reference-access.test.ts`, `tests/custom-audit-question-authorization.test.ts`, `tests/batch-b21-module-permissions.test.ts`, `tests/visual-management-settings.characterization.test.ts` | Settings UI, targeted mutation checks and inactive config authorities | All settings routes/commands across modules: no caller-role/ID bypass, factory scope, placeholder visibility, no platform regression without decision |
| T07 | `tests/red-tag-cross-zone-authorization.test.ts`, `e2e/red-tag-cross-zone.spec.ts` | Own leadership Zones including multiple assignments, aliases, current session, target leader, plant/org/module failures | SU positive scoped case, combined FA/ZL still cannot raise own Zone, multi-factory identical names, receiver reassignment |
| T08 | `tests/gemba-red-tag-phase5a.characterization.test.ts`, `tests/gemba-ci-phase5b.characterization.test.ts`, `e2e/cross-module-integration.spec.ts` | Gemba source prefills, canonical target IDs, relationships and failure preservation | Each new base role reaches only permitted workflow; rejected scope leaves no ID, asset, source link or Action side effects |
| T09 | `tests/continuous-improvement.characterization.test.ts`, `tests/continuous-improvement-owner.characterization.test.ts`, `tests/batch-c-ci-operational-relationships.characterization.test.ts` | CI lifecycle, proposal creation, approval/hold, owners and source links | Existing test explicitly blocks ZL without ci.create: update only after approved policy. Add designated ZL/assigned FA approval, wrong reviewer/SU denial, historical decisions retained |
| T10 | `tests/action-plan-creation.test.ts`, `tests/action-integration-hardening.test.ts`, `tests/fix02-action-content-authorization.test.ts`, `tests/action-store.characterization.test.ts`, `tests/action-center.characterization.test.ts` | Shared source creation, owner/reviewer independence, rollback, restricted generic edits and Action views | Every target role as eligible owner, all entry points and reassignment, factory scope, inactive/revoked membership, spoofed actor review/due-date writes |
| T11 | `tests/audit-independent-action-closure.test.ts`, `tests/audit-evidence-quota.test.ts`, `tests/audit-configurable-scoring.test.ts`, `tests/standard-audit-checklist.test.ts` | Audit closure, evidence, scoring/checklist snapshots | Auth on schedule/start/edit/draft/question/signature/completion, scoped grants; keep timing/scoring/evidence assertions unchanged |
| T12 | `tests/action-plan-execution-types.test.ts`, `tests/action-start-undo.test.ts`, `e2e/action-plan-execution-types.spec.ts`, `tests/admin-record-deletion.test.ts`, `e2e/admin-record-deletion.spec.ts`, `e2e/admin-listing-deletion.spec.ts` | Start-time type, cancellation/undo/review/rework, source preservation, retained evidence, no-cascade deletion and unresolved completion | Approved FA deletion mapping only; existing type and lifecycle assertions retained. Test revoked worker/reviewer with in-progress work |
| T13 | `tests/batch-b21-module-permissions.test.ts`, `tests/visual-management.characterization.test.ts`, `tests/visual-management-meeting-attendance.test.ts`, `tests/visual-management-settings.characterization.test.ts` | Cross-zone/omitted actor rejection, board/meeting scope, active membership and snapshot protection | SU reads but cannot write even if board owner/member, FA/ZL/ZM allowed only in scope, directory/current-session consistency |
| T14 | Existing CI timeline, Action history and deletion tests | Domain actor/time attribution and retained histories | Admin assignment/user creation/roles/grants/revocations/settings events with actual actor, before/after, scope, timestamp, no event on denied/failed write |
| T15 | `tests/cross-module-integration.test.ts`, `e2e/cross-module-integration.spec.ts`, organization-specific custom-question tests | Scoped Linked Records, missing/denied records, selected foreign-organization/plant cases | Full client/factory read/write/export/file matrix with same-named Zones, cross-tenant IDs, hidden linked titles and support roles. Existing coverage is selective, not complete tenant isolation |

Some listed tests use source inspection/characterization rather than exercising browser commands. Add real command assertions and Chromium journeys for the target; do not mistake those characterizations for backend security tests. No existing test was modified during this audit.

## 12. Risks and manual review checklist

Critical implementation risks: privilege escalation via generic role/permission arrays; overwriting other factory memberships; name collisions; adding scope to only UI; identity mismatch across cached demo hooks and commands; invalidating historical owners/reviewers; losing deleted-source metadata; and treating role revocation as record deletion. Existing fixtures normalize or append seed records, so future compatibility work must preserve raw historical collections and ID reservations.

- [ ] Approve D01–D11 or record explicit deferred behavior.
- [ ] Review the target/current role matrix, especially CI, Gemba and auditor powers.
- [ ] Confirm that the platform catalog's site/user counts are not evidence of working tenant provisioning.
- [ ] Confirm the current Admin inventory and proposed scope assignments before any migration design.
- [ ] Review the five-phase acceptance gates in the companion implementation plan.
- [ ] Require frontend direct-command tests alongside UI checks.
- [ ] Keep cross-Zone Red Tag receiving-leader evaluation, Action Type, signatures/evidence and source dependencies unchanged.
- [ ] Treat server authentication, authorization, isolation and immutable logs as a separate production release gate.

No production implementation, data migration, permission change, commit, push, merge or deployment occurred. Stop for review before Phase 1.
