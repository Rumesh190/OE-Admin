# OPS v4 Native Role Switching Implementation

**Status: COMPLETE — UNTESTED**

Implementation is complete in source. Per the delivery constraint, no automated test, browser automation, TypeScript check, lint, or build command was run.

## Implemented behavior

- The existing top-right account dropdown is the only demo identity switcher.
- In development, an uninitialized browser shows **Initialize role demo**. After initialization, the menu shows exactly the eight approved personas and **Reset demo data**.
- Identity changes use the existing current-user and access-context stores, persist through refresh, select the persona's authorized platform/client/factory context, and return to `/dashboard` so open forms and page-local state are discarded.
- The demo controls are omitted outside development builds.
- Metric Mind reuses `USR-OPS-SUPER-ADMIN`; no second platform administrator was created.
- The former standalone browser launcher was removed. No manual JSON import is required.
- Administration presentation now uses human names for primary factory, user, Department, Zone, and assignment rows. Zone Champion and Department Leader receive scoped structure views; other operational roles receive a concise personal-access view without mutation controls. Client and Factory administrators retain the existing canonical management commands.
- Gemba, Red Flag/Red Tag, Continuous Improvement, Visual Improvement, and Visual Management restrictions were not expanded.

## In-app demo data transaction

The initializer embeds a fixed dataset and writes through one selective, rollback-capable browser transaction. It rejects malformed existing payloads before writing. If a storage write fails, it restores the previous values. It never calls `localStorage.clear()`.

The following storage keys are updated:

1. `five-s-administration-users-v1`
2. `ops-organization-configuration-v1`
3. `standalone-5s-actions`
4. `manufacturing-qms-five-s-audits-v1`
5. `ops-access-v3-administration-v1`
6. `ops-access-v4-administration-v1`
7. `ops-organization-modules-v1`
8. `ops-final-role-demo-v1`

No storage key is cleared wholesale. Initialization/reset removes and replaces only:

- client-scoped records belonging to a client marked with `demoDataset.id = ops-iq-v4-demo-v1` and `disposable = true`;
- the stable target IQ demo client/factory/Zone/Department/assignment records;
- demo directory profiles with the fixed persona IDs or an `IQ-DEMO-` employee ID;
- the fixed namespaced Audit and Action records in the disposable client.

Unmarked clients, factories, people, memberships, Zones, Departments, Audits, Actions, entitlements, and unknown records remain in place.

## Records created or rebuilt

### Tenant structure

- Client: `ORG-7e3a7444-ab9b-4338-a09e-296a2ccfaf9a` — IQ Demo (fictional)
- Factory: `PLANT-cd757fcd-3d35-4348-aad0-015d603110e0` — IQ Demo Factory
- Zone: `ZONE-1832c6e1-d580-473b-a47d-8d3ccf9c1d4a` — Demo Zone A
- Zone: `ZONE-0cfa0bc0-1ca8-419a-a749-e44ebbf51a84` — Demo Zone B
- Department: `DEPT-1e2ec7e9-4033-4b4d-ab8a-51affa166cd5` — Demo Assembly
- Department: `DEPT-a91d717b-5a41-435d-a75d-bf674107037b` — Demo Maintenance

### Personas

1. `USR-OPS-SUPER-ADMIN` — Metric Mind — Platform Super Admin
2. `USR-dfedf917-bf54-4745-a868-e9ca7c4ccf5f` — IQ Manoj — Client Administrator
3. `USR-9748f8e7-e264-4b0a-a446-467e059edbc2` — IQ Factory Admin — Factory Administrator
4. `USR-9b987ed0-c265-4890-a870-18b2acae72ea` — IQ Zone Champion — Zone Champion
5. `USR-488a5352-0368-4a18-a381-d2e2d79219f7` — IQ Zone Leader — Zone Leader
6. `USR-48d3aa53-7c9b-4913-afc3-eff17dc88b20` — IQ Department Leader — Department Leader
7. `USR-c4ce0db8-dedd-430c-a459-f5f4862c254a` — IQ Department Member — Department Member
8. `USR-87c14bbb-1d7c-4e9d-aaa0-cc179105af4d` — IQ Standard User — Standard User

### Operational records

- `AUD-IQ-DEMO-001` — scoped in-progress Audit
- `AUD-IQ-DEMO-002` — scoped in-progress Audit
- `ACT-IQ-DEMO-001` — assigned corrective Action

The associated v3 client/factory memberships, factory administrator assignment, Zone allocations, Auditor authorization, v4 independent role assignments, module entitlements, and administration history are rebuilt with stable IDs.

## Manual acceptance pending

The requested consolidated manual pass remains pending: initialize from the account menu, refresh each persona, review sidebar/settings/administration scope, verify Audit and Action visibility and allowed operations, confirm restricted module behavior, and use reset to verify idempotent selective replacement. No automated or browser acceptance was run in this implementation batch.
