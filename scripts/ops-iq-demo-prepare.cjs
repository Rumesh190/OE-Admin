/* eslint-disable @typescript-eslint/no-require-imports -- This offline Node tool installs a CommonJS loader for existing canonical TypeScript commands. */
/* Authorized offline demo-data preparation. Uses canonical commands on a private storage snapshot.
 * Does not connect to a browser or write live data. The browser commit must compare raw before-images.
 * No test runner, role bypass in application code, or production activation operation is introduced. */
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const directory = process.argv[2];
if (!directory || !path.resolve(directory).startsWith("/tmp/")) throw new Error("Use the private temporary backup directory");
const before = JSON.parse(fs.readFileSync(path.join(directory, "local-storage-before.json")));
const cleanup = JSON.parse(fs.readFileSync(path.join(directory, "cleanup-plan.json")));
if (before.origin !== "http://localhost:3000" || before.storage["ops-access-v3-pending-transaction-v1"]) throw new Error("Unexpected origin or pending recovery");
const ts = require("typescript");
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) { return resolve.call(this, name.startsWith("@/") ? path.join(root, name.slice(2)) : name, ...args); };
for (const ext of [".ts", ".tsx"]) Module._extensions[ext] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, f);
const values = new Map(Object.entries(before.storage));
// Demo session/actors are explicit delegated preparation actors, never production authentication.
values.set("5s-auth-session", JSON.stringify({ authenticated: true, username: "admin", version: 1 }));
const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
global.window = { localStorage: storage, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
global.localStorage = storage;
Object.defineProperty(global, "navigator", { configurable: true, value: { userAgent: "OPS authorized offline preparation", platform: "Node", locks: { request: async (_name, options, callback) => (typeof options === "function" ? options : callback)() } } });
const get = p => require(path.join(root, p));
const removals = [];
for (const [key, ids] of [["manufacturing-qms-five-s-audits-v1", cleanup.auditIds], ["standalone-5s-actions", cleanup.actionIds]]) {
  const rows = JSON.parse(storage.getItem(key)); storage.setItem(key, JSON.stringify(rows.filter(r => !ids.includes(r.id)))); removals.push({ key, ids });
}
for (const key of ["ops-action-reminders-v1", "ops-action-escalations-v1", "standalone-5s-notifications"]) {
  const rows = JSON.parse(storage.getItem(key) ?? "[]");
  const drop = row => cleanup.actionIds.includes(row.actionId) || (row.href && cleanup.actionIds.some(id => row.href === `/actions/${id}` || row.href === `/5s/actions/${id}`));
  const removed = rows.filter(drop); if (removed.length) { storage.setItem(key, JSON.stringify(rows.filter(r => !drop(r)))); removals.push({ key, ids: removed.map(r => r.id) }); }
}
(async () => {
  const redTags = JSON.parse(storage.getItem("five-s-red-tags-v1") ?? "[]");
  const compactedTags = get("features/five-s/red-tag/store.ts").compactRedTagPhotoAliases(redTags);
  if (JSON.stringify(redTags) !== JSON.stringify(compactedTags)) storage.setItem("five-s-red-tags-v1", JSON.stringify(compactedTags));
  const current = get("lib/current-user.ts"); const context = get("features/five-s/administration/access-v4-context.ts");
  const v3 = get("features/five-s/administration/access-v3-store.ts"); const v3state = get("features/five-s/administration/access-v3-state.ts");
  const admin = get("features/five-s/administration/access-v4-store.ts"); const v4state = get("features/five-s/administration/access-v4-state.ts");
  const onboarding = get("features/five-s/administration/iq-onboarding-store.ts"); const plan = get("features/five-s/administration/iq-onboarding.ts");
  const directoryStore = get("features/five-s/administration/store.ts");
  let client, factory; const createdPeople = [];
  function select(id, kind = "factory") {
    if (id === "USR-OPS-SUPER-ADMIN") current.setDemoRole("superAdmin"); else if (id === "USR-LAKSHMAN") current.setDemoRole("auditor"); else current.setAdministrationDemoIdentity(id);
    context.selectAccessContext({ version: 1, personId: id, selectionId: "", kind, ...(kind !== "platform" ? { organizationId: client.id } : {}), ...(kind === "factory" ? { plantId: factory.id } : {}) });
  }
  const exp = () => ({ selectionId: context.getActiveAccessContext().selectionId, revision: v4state.getAccessV4State().revision });
  select("USR-OPS-SUPER-ADMIN", "platform");
  if (plan.canonicalIQClient()) throw new Error("An IQ client already exists. Resume requires a fresh reviewed plan, not duplicate provisioning.");
  client = await onboarding.createIQStagedClient(plan.captureOnboardingExpectation());
  const ca = await onboarding.setupIQClientAdministrator(client.id, plan.captureOnboardingExpectation()); createdPeople.push(ca);
  select(ca.id, "client"); factory = await onboarding.createIQFactory(client.id, plan.captureOnboardingExpectation());
  select("USR-OPS-SUPER-ADMIN", "platform");
  const lakshman = directoryStore.getCanonicalAdminUsers().find(p => p.id === "USR-LAKSHMAN");
  await onboarding.attachIQLakshman(client.id, { personId: lakshman.id, email: lakshman.email, employeeId: lakshman.employeeId, reason: "Product-owner-authorized IQ demo identity reuse; retain unrelated history" }, plan.captureOnboardingExpectation());
  select(ca.id, "client"); await onboarding.appointIQFactoryAdministrator(client.id, factory.id, lakshman.id, plan.captureOnboardingExpectation());
  select(lakshman.id); const zones = {};
  for (const [name, code] of [["Zone A", "ZA"], ["Zone B", "ZB"], ["Zone C", "ZC"], ["Zone D", "ZD"]]) zones[code] = await onboarding.createIQZone(client.id, factory.id, name, code, true, plan.captureOnboardingExpectation());
  const scope = { organizationId: client.id, plantId: factory.id }; const departments = {};
  for (const [code, name, zone] of [["ASM", "Assembly", "ZA"], ["QLT", "Quality", "ZA"], ["MNT", "Maintenance", "ZB"], ["FIN", "Finishing", "ZC"], ["LOG", "Logistics", "ZD"]]) departments[code] = await admin.saveDepartment({ ...scope, zoneId: zones[zone].id }, { code, name, status: "Active" }, exp());
  const reused = ["USR-RUMESH", "USR-SIVA-KUMAR", "USR-ANAND"];
  for (const id of reused) {
    select("USR-OPS-SUPER-ADMIN", "platform"); const p = directoryStore.getCanonicalAdminUsers().find(p => p.id === id); if (!p) throw new Error(`Missing canonical identity ${id}`);
    await admin.attachPersonToClient({ personId: id, confirmedPersonId: id, organizationId: client.id, reason: "Authorized IQ disposable demo attachment; preserve other client memberships and histories", expectedV3Payload: storage.getItem(v3state.ACCESS_V3_KEY), expectedDirectoryPayload: storage.getItem("five-s-administration-users-v1"), identityConfirmation: { email: p.email, employeeId: p.employeeId } }, exp());
  }
  select(lakshman.id);
  const people = {};
  for (const [key, name, existing, zone] of [["rumesh", "Rumesh", "USR-RUMESH", "ZA"], ["siva", "Siva Kumar", "USR-SIVA-KUMAR", "ZA"], ["anand", "Anand", "USR-ANAND", "ZD"], ["suresh", "Suresh", null, "ZA"], ["priya", "Priya Raman", null, "ZA"], ["kavya", "Kavya Iyer", null, "ZB"], ["meera", "Meera Nair", null, null], ["vikram", "Vikram Das", null, null], ["neha", "Neha Patel", null, "ZD"]]) {
    const input = { ...(existing ? { userId: existing } : { person: { name, email: `${key}@iq-demo.invalid`, employeeId: `IQ-DEMO-${key.toUpperCase()}` } }), baseRole: "Standard User", zoneIds: zone ? [zones[zone].id] : [] };
    people[key] = v3.saveFactoryUser(client.id, factory.id, input); if (!existing) createdPeople.push(people[key]);
  }
  select(ca.id, "client"); v3.assignFactoryAdministrator(client.id, factory.id, people.meera.id); select(lakshman.id);
  const assignments = {};
  for (const [key, role, zone, dept] of [["rumesh", "Zone Leader", "ZA"], ["kavya", "Zone Leader", "ZB"], ["priya", "Department Leader", "ZA", "ASM"], ["priya", "Department Leader", "ZA", "QLT"], ["neha", "Department Leader", "ZD", "LOG"], ["suresh", "Department Member", "ZA", "ASM"], ["siva", "Department Member", "ZA", "QLT"], ["anand", "Department Member", "ZD", "LOG"], ["vikram", "Zone Champion"]]) assignments[`${key}:${dept ?? role}`] = await admin.assignV4Role({ ...scope, ...(zone ? { zoneId: zones[zone].id } : {}), ...(dept ? { departmentId: departments[dept].id } : {}) }, role, people[key].id, exp());
  v3.saveAuditorAuthorization(client.id, factory.id, people.kavya.id, [zones.ZA.id, zones.ZC.id, zones.ZD.id]);
  // Explicitly disposable local demo only: existing production/staged clients and entitlements are untouched.
  const state = structuredClone(v3state.getAccessV3State()); const at = new Date().toISOString();
  state.clients = state.clients.map(c => c.id === client.id ? { ...c, operationalState: "Active", demoDataset: { id: "ops-iq-v4-demo-v1", disposable: true, generatedAt: at, authorizedBy: "product-owner" } } : c);
  state.events.push({ id: `ADM-${crypto.randomUUID()}`, actorId: "USR-OPS-SUPER-ADMIN", organizationId: client.id, operation: "demo.generated", targetId: client.id, at, after: { disposable: true, authorization: "Product owner authorized generated IQ demo configuration", productionActivation: false } });
  storage.setItem(v3state.ACCESS_V3_KEY, JSON.stringify(state));
  const modules = get("lib/modules.ts"); const access = JSON.parse(storage.getItem("ops-organization-modules-v1") ?? "{}");
  access[client.id] = Object.fromEntries(Object.keys(modules.DEFAULT_MODULE_ENTITLEMENTS).map(k => [k, k === "audit"])); storage.setItem("ops-organization-modules-v1", JSON.stringify(access));
  const auditStore = get("lib/five-s/audit-store.ts"); const actions = get("lib/actions/action-store.ts"); const d10 = get("lib/actions/audit-corrective-actions.ts");
  const sampleAudits = [], sampleActions = [];
  for (const [zone, entries] of [["ZA", [["ASM", "suresh", "priya", "Remove unused assembly fixtures"], ["QLT", "siva", "priya", "Restore inspection gauge labels"]]], ["ZD", [["LOG", "anand", "neha", "Mark safe material staging lanes"]]]]) {
    select(lakshman.id);
    const sections = [{ category: "Sort", description: "IQ generated demo findings", score: 0, maxScore: entries.length * 2, questions: entries.map(([dept, , , title]) => ({ id: `Q-${crypto.randomUUID()}`, departmentId: departments[dept].id, category: "Sort", question: title, questionSource: "custom", responseType: "Compliance", requireEvidenceOnNonCompliance: false, mandatory: true, score: null, maxScore: 2, status: "Not Started", actionRequired: false })) }];
    const audit = await get("lib/records/module-records.ts").withBusinessRecordCreation(() => auditStore.createFiveSAudit({ ...scope, zoneId: zones[zone].id, assignedAuditorId: people.kavya.id, title: "Generated", plant: factory.name, department: "", area: zones[zone].name, auditor: people.kavya.name, dueDate: "2026-12-31", scheduledDate: "2026-12-01", scheduledTime: "09:00", sections }, { startNow: false, expectedContextSelectionId: context.getActiveAccessContext().selectionId }));
    select(people.kavya.id); auditStore.startScheduledFiveSAudit(audit.id, new Date(), { selectionId: context.getActiveAccessContext().selectionId, revision: audit.revision });
    let latest = auditStore.getFiveSAuditById(audit.id);
    auditStore.updateFiveSAudit(audit.id, { sections: latest.sections.map(s => ({ ...s, questions: s.questions.map(q => ({ ...q, score: 0, complianceResponse: 0, status: "Fail", observation: `Demo: ${q.question}`, actionRequired: true })) })) }, current.getCurrentDemoUser(), { selectionId: context.getActiveAccessContext().selectionId, revision: latest.revision });
    for (let index = 0; index < entries.length; index++) {
      const [dept, owner, reviewer, title] = entries[index]; select(people.kavya.id); latest = auditStore.getFiveSAuditById(audit.id);
      const a = await d10.createAuditQuestionCorrectiveAction(audit.id, latest.sections[0].questions[index].id, { title, description: `Disposable IQ demo corrective work: ${title}`, assignmentId: assignments[`${owner}:${dept}`].id, dueDate: "2026-12-31", priority: "Medium" }, { selectionId: context.getActiveAccessContext().selectionId, auditRevision: latest.revision, administrationRevision: v4state.getAccessV4State().revision });
      select(lakshman.id); await d10.selectAuditActionVerifier(a.id, people[reviewer].id, "", { selectionId: context.getActiveAccessContext().selectionId, revision: a.v4.revision });
      if (owner === "siva") { select(people.siva.id); const row = actions.getActionById(a.id); await actions.executeV4ActionTransition(a.id, { selectionId: context.getActiveAccessContext().selectionId, revision: row.v4.revision }, { operation: "start", actionType: "corrective" }); }
      sampleActions.push(a.id);
    }
    sampleAudits.push(audit.id);
  }
  select(lakshman.id);
  const images = [...values].filter(([key, value]) => key !== "5s-auth-session" && before.storage[key] !== value).map(([key, after]) => ({ key, before: before.storage[key] ?? null, after }));
  for (const key of Object.keys(before.storage)) if (!values.has(key)) images.push({ key, before: before.storage[key], after: null });
  const result = { version: 1, origin: before.origin, generatedAt: new Date().toISOString(), images, removals, created: { clientId: client.id, factoryId: factory.id, people: createdPeople.map(p => ({ id: p.id, name: p.name })), reusedPeople: [lakshman.id, ...reused], zones: Object.fromEntries(Object.entries(zones).map(([k,v]) => [k,v.id])), departments: Object.fromEntries(Object.entries(departments).map(([k,v]) => [k,v.id])), assignments: Object.fromEntries(Object.entries(assignments).map(([k,v]) => [k,v.id])), auditIds: sampleAudits, actionIds: sampleActions }, finalStorage: Object.fromEntries([...values].filter(([k]) => k !== "5s-auth-session")) };
  fs.writeFileSync(path.join(directory, "prepared-rebuild.json"), JSON.stringify(result), { mode: 0o600 });
  console.log(JSON.stringify({ changedKeys: images.map(i => i.key), removed: removals.map(x => ({ key: x.key, count: x.ids.length })), created: result.created }, null, 2));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
