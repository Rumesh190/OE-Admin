/* eslint-disable @typescript-eslint/no-require-imports -- Offline canonical TypeScript command loader; not a checker or test runner. */
/* Builds a NEW fictional dataset in memory. Never reads a browser, backup or existing client. */
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const output = path.resolve(process.argv[2] ?? "/tmp/ops-final-demo.json");
if (!output.startsWith("/tmp/") || !output.endsWith(".json")) throw new Error("Write the isolated dataset to a /tmp/*.json file.");
const ts = require("typescript"), resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) { return resolve.call(this, name.startsWith("@/") ? path.join(root, name.slice(2)) : name, ...args); };
for (const ext of [".ts", ".tsx"]) Module._extensions[ext] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, f);
// Stable UUID namespace for this disposable fixture only. Canonical prefix/allocation commands remain in use.
const uuid = name => { const h = crypto.createHash("sha256").update(`ops-final-role-demo-v1:${name}`).digest("hex"); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
let sequence = 0, nextPerson;
Object.defineProperty(global, "crypto", { configurable: true, value: { randomUUID: () => { const name = nextPerson ?? `allocation-${++sequence}`; nextPerson = undefined; return uuid(name); } } });
const values = new Map();
const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
global.window = { localStorage: storage, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
global.localStorage = storage;
Object.defineProperty(global, "navigator", { configurable: true, value: { userAgent: "OPS isolated dataset construction", platform: "Node", locks: { request: async (_name, options, callback) => (typeof options === "function" ? options : callback)() } } });
// Empty unmigrated collections prevent existing first-load fixtures from appearing in this new demo.
for (const source of ["features/five-s/continuous-improvement/store.ts", "features/visual-improvement/visual-improvement-store.ts"]) {
  const text = fs.readFileSync(path.join(root, source), "utf8");
  const constant = key => { const match = text.match(new RegExp(`const ${key} = "([^"\\n]+)"`)); if (!match) throw new Error(`Cannot locate ${key} in ${source}`); return match[1]; };
  storage.setItem(constant("STORAGE_KEY"), "[]");
  storage.setItem(constant("FIXTURE_VERSION_KEY"), constant("FIXTURE_VERSION"));
}
storage.setItem("ops-red-tag-original-reset-v1", "done");
storage.setItem("ops-gemba-v1", JSON.stringify({ walks: [], observations: [] }));
storage.setItem("ops-visual-management-v1", JSON.stringify({ boards: [], meetings: [], topics: [], decisions: [], escalations: [] }));
const get = p => require(path.join(root, p));
(async () => {
  const directory = get("features/five-s/administration/store.ts");
  const platform = { ...directory.ADMIN_USER_SEEDS.find(p => p.id === "USR-OPS-SUPER-ADMIN"), name: "Metric Mind" };
  // Bootstrap the canonical person directory, not an authority record. CA will explicitly appoint this person FA.
  const factoryAdmin = { id: `USR-${uuid("factory-admin")}`, name: "IQ Factory Admin", email: "factory.admin@iq-demo.invalid", employeeId: "IQ-DEMO-FA", status: "Active", roles: [], permissions: [], plant: "", zoneMemberships: [], accessModel: "v3", updatedAt: new Date().toISOString() };
  storage.setItem("five-s-administration-users-v1", JSON.stringify([platform, factoryAdmin]));
  directory.refreshAdminDirectory();
  storage.setItem("ops-organization-configuration-v1", JSON.stringify({ plants: [], zones: [], members: [] }));
  for (const k of ["standalone-5s-actions", "manufacturing-qms-five-s-audits-v1", "five-s-red-tags-v1", "standalone-5s-notifications"]) storage.setItem(k, "[]");
  storage.setItem("5s-auth-session", JSON.stringify({ authenticated: true, username: "admin", version: 1 }));
  const current = get("lib/current-user.ts"), context = get("features/five-s/administration/access-v4-context.ts");
  const v3 = get("features/five-s/administration/access-v3-store.ts"), v3state = get("features/five-s/administration/access-v3-state.ts");
  const v4 = get("features/five-s/administration/access-v4-store.ts"), v4state = get("features/five-s/administration/access-v4-state.ts");
  let client, factory;
  function select(personId, kind = "factory") {
    if (personId === platform.id) current.setDemoRole("superAdmin"); else current.setAdministrationDemoIdentity(personId);
    context.selectAccessContext({ version: 1, personId, selectionId: "candidate", kind, ...(kind !== "platform" ? { organizationId: client.id } : {}), ...(kind === "factory" ? { plantId: factory.id } : {}) });
  }
  const expected = () => ({ selectionId: context.getActiveAccessContext().selectionId, revision: v4state.getAccessV4State().revision });
  select(platform.id, "platform");
  client = v3.saveClientProfile({ name: "IQ Demo (fictional)", industry: "Fictional manufacturing demonstration" });
  nextPerson = "client-admin";
  const ca = v3.assignClientAdministrator(client.id, { person: { name: "IQ Manoj", email: "manoj@iq-demo.invalid", employeeId: "IQ-DEMO-CA" } });
  select(ca.id, "client");
  factory = v3.saveFactory(client.id, { name: "IQ Demo Factory", code: "IQDEMO", location: "Chennai (fictional demo)", description: "Disposable isolated demonstration; no production client association" });
  select(platform.id, "platform");
  await v4.attachPersonToClient({ personId: factoryAdmin.id, confirmedPersonId: factoryAdmin.id, organizationId: client.id, reason: "Product-owner-authorized isolated fictional demo onboarding", expectedV3Payload: storage.getItem(v3state.ACCESS_V3_KEY), expectedDirectoryPayload: storage.getItem("five-s-administration-users-v1"), identityConfirmation: { email: factoryAdmin.email, employeeId: factoryAdmin.employeeId } }, expected());
  select(ca.id, "client"); v3.assignFactoryAdministrator(client.id, factory.id, factoryAdmin.id);
  select(factoryAdmin.id);
  const zones = {};
  const onboarding = get("features/five-s/administration/iq-onboarding-store.ts"), onboardingPlan = get("features/five-s/administration/iq-onboarding.ts");
  for (const code of ["A", "B"]) zones[code] = await onboarding.createV4FactoryZone({ organizationId: client.id, plantId: factory.id }, { name: `Demo Zone ${code}`, code: `D${code}`, codeConfirmed: true }, onboardingPlan.captureOnboardingExpectation());
  const scope = { organizationId: client.id, plantId: factory.id }, departments = {};
  for (const [zone, code, name] of [["A", "ASM", "Demo Assembly"], ["B", "MNT", "Demo Maintenance"]]) departments[zone] = await v4.saveDepartment({ ...scope, zoneId: zones[zone].id }, { name, code, status: "Active" }, expected());
  const people = {};
  for (const [key, name, zone] of [["champion", "IQ Zone Champion", null], ["leader", "IQ Zone Leader", "B"], ["departmentLeader", "IQ Department Leader", "A"], ["member", "IQ Department Member", "A"], ["standard", "IQ Standard User", "A"]]) {
    nextPerson = key;
    people[key] = v3.saveFactoryUser(client.id, factory.id, { person: { name, email: `${key.toLowerCase()}@iq-demo.invalid`, employeeId: `IQ-DEMO-${key.toUpperCase()}` }, baseRole: "Standard User", zoneIds: zone ? [zones[zone].id] : [] });
  }
  const assignments = {};
  for (const [key, role, zone, department] of [["champion", "Zone Champion"], ["leader", "Zone Leader", "B"], ["departmentLeader", "Department Leader", "A", "A"], ["member", "Department Member", "A", "A"]]) assignments[key] = await v4.assignV4Role({ ...scope, ...(zone ? { zoneId: zones[zone].id } : {}), ...(department ? { departmentId: departments[department].id } : {}) }, role, people[key].id, expected());
  v3.saveAuditorAuthorization(client.id, factory.id, people.leader.id, [zones.A.id]);
  // Explicit fixture-only activation, in this fresh in-memory map. No real IQ exists in this input.
  const state = structuredClone(v3state.getAccessV3State()); const at = new Date().toISOString();
  state.clients = state.clients.map(c => c.id === client.id ? { ...c, operationalState: "Active", demoDataset: { id: "ops-iq-v4-demo-v1", disposable: true, generatedAt: at, authorizedBy: "product-owner" } } : c);
  state.events.push({ id: `ADM-${global.crypto.randomUUID()}`, actorId: platform.id, organizationId: client.id, operation: "demo.generated", targetId: client.id, at, after: { isolated: true, fictional: true, productionActivation: false } });
  storage.setItem(v3state.ACCESS_V3_KEY, JSON.stringify(state));
  const modules = get("lib/modules.ts");
  storage.setItem("ops-organization-modules-v1", JSON.stringify({ [client.id]: Object.fromEntries(Object.keys(modules.DEFAULT_MODULE_ENTITLEMENTS).map(k => [k, ["audit", "actions", "reports"].includes(k)])) }));
  const auditStore = get("lib/five-s/audit-store.ts"), records = get("lib/records/module-records.ts"), d10 = get("lib/actions/audit-corrective-actions.ts");
  const due = new Date(); due.setDate(due.getDate() + 14); const dueDate = due.toISOString().slice(0,10);
  const audits = [];
  for (const zone of ["A", "B"]) {
    select(factoryAdmin.id);
    const audit = await records.withBusinessRecordCreation(() => auditStore.createFiveSAudit({ ...scope, zoneId: zones[zone].id, departmentId: departments[zone].id, assignedAuditorId: zone === "A" ? people.leader.id : factoryAdmin.id, title: `Demo Zone ${zone}`, plant: factory.name, department: departments[zone].name, area: zones[zone].name, auditor: zone === "A" ? people.leader.name : factoryAdmin.name, dueDate, scheduledDate: dueDate, scheduledTime: "09:00", sections: [{ category: "Sort", description: "Fictional demo checklist", score: 0, maxScore: 2, questions: [{ id: `Q-${global.crypto.randomUUID()}`, departmentId: departments[zone].id, category: "Sort", question: "Remove unused fixtures from the marked work area", questionSource: "custom", responseType: "Compliance", requireEvidenceOnNonCompliance: false, mandatory: true, score: null, maxScore: 2, status: "Not Started", actionRequired: false }] }] }, { startNow: zone === "B", expectedContextSelectionId: context.getActiveAccessContext().selectionId }));
    audits.push(audit.id);
  }
  select(people.leader.id);
  let audit = auditStore.getFiveSAuditById(audits[0]);
  auditStore.startScheduledFiveSAudit(audit.id, new Date(), { selectionId: context.getActiveAccessContext().selectionId, revision: audit.revision });
  audit = auditStore.getFiveSAuditById(audit.id);
  auditStore.updateFiveSAudit(audit.id, { sections: audit.sections.map(s => ({ ...s, questions: s.questions.map(q => ({ ...q, score: 0, complianceResponse: 0, status: "Fail", observation: "Fictional demonstration finding: unused fixtures in the marked work area.", actionRequired: true })) })) }, current.getCurrentDemoUser(), { selectionId: context.getActiveAccessContext().selectionId, revision: audit.revision });
  audit = auditStore.getFiveSAuditById(audit.id);
  const action = await d10.createAuditQuestionCorrectiveAction(audit.id, audit.sections[0].questions[0].id, { title: "Remove unused demo fixtures", description: "Fictional demo: restore the marked Assembly work area", assignmentId: assignments.member.id, dueDate, priority: "Medium" }, { selectionId: context.getActiveAccessContext().selectionId, auditRevision: audit.revision, administrationRevision: v4state.getAccessV4State().revision });
  select(factoryAdmin.id);
  await d10.selectAuditActionVerifier(action.id, people.departmentLeader.id, "", { selectionId: context.getActiveAccessContext().selectionId, revision: action.v4.revision });
  const names = [[platform, "Platform Super Admin"], [ca, "Client Administrator"], [factoryAdmin, "Factory Administrator"], [people.champion, "Zone Champion"], [people.leader, "Zone Leader"], [people.departmentLeader, "Department Leader"], [people.member, "Department Member"], [people.standard, "Standard User"]];
  storage.setItem("ops-final-role-demo-v1", JSON.stringify({ version: 1, isolated: true, ...scope, personas: names.map(([p, role]) => ({ personId: p.id, name: p.name, role })) }));
  // Start the walkthrough as Metric Mind. Switching is available to every demo persona.
  select(platform.id, "platform");
  const result = { version: 1, dataset: "ops-final-role-demo-v1", fictional: true, generatedAt: at, storage: Object.fromEntries(values), created: { client: client.id, factory: factory.id, zones: Object.fromEntries(Object.entries(zones).map(([k,v]) => [k,v.id])), departments: Object.fromEntries(Object.entries(departments).map(([k,v]) => [k,v.id])), personas: names.map(([p,role]) => ({ id:p.id, name:p.name, role })), audits, actions: [action.id] }, removed: [] };
  fs.writeFileSync(output, JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(`Prepared fictional isolated dataset: ${output}. No browser or existing storage was accessed.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
