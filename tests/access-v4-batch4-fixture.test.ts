/** Reuse the established Batch 3 synthetic setup; never import this into the application. */
import { afterEach, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { setup } from "./access-v4-batch3.test";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("exports the existing synthetic Audit tenant into an opt-in isolated UAT fixture", async () => {
  const s = await setup();
  const audit = s.createAudit();
  expect(s.state.getAccessV3State().clients.some(c => c.name === "IQ")).toBe(false);
  expect(s.policy.readCanonicalActions()).toEqual([]);
  expect(s.auditPolicy.canExecuteScopedAudit(audit)).toBe(true);
  // Prevent unrelated legacy reset initializers in the disposable browser context.
  s.values.set("ops-red-tag-original-reset-v1", "done");
  const output = process.env.OPS_V4_UAT_FIXTURE_PATH;
  if (output) {
    if (!output.startsWith("/tmp/") && !output.startsWith("/private/tmp/")) throw new Error("UAT fixture export is restricted to temporary storage");
    writeFileSync(output, JSON.stringify({ version: 1, storage: Object.fromEntries(s.values), clientId: s.client.id, factoryId: s.factory.id, departmentId: s.dept.id, zoneId: s.za.id, auditId: audit.id, identities: { clientAdmin: s.ca.id, factoryAdmin: "USR-LAKSHMAN", owner: s.owner.id, verifier: s.reviewer.id, coordinator: s.coordinator.id } }, null, 2));
  }
});

it("wires v4 Undo Start through the canonical lifecycle with revision protection", async () => {
  const s = await setup(); const { action } = await s.task(); s.select(s.owner.id);
  await s.actionStore.executeV4ActionTransition(action.id, s.actionExpected(action.id), { operation: "start", actionType: "corrective" });
  const old = s.actionExpected(action.id);
  const undone = await s.actionStore.executeV4ActionTransition(action.id, old, { operation: "undo", observation: "Retained draft", correctiveActionCategory: "", costSaving: 0 });
  expect(undone?.status).toBe("Assigned"); expect(undone?.resolutionObservation).toBe("Retained draft"); expect(undone?.actionType).toBeUndefined();
  expect(undone?.activityHistory?.map(e => e.type)).toEqual(["created", "started", "start_undone"]);
  expect(undone?.v4?.workCapacity).toEqual(action.v4?.workCapacity);
  await expect(s.actionStore.executeV4ActionTransition(action.id, old, { operation: "start", actionType: "corrective" })).rejects.toThrow(/revision/);
});

it("denies legacy demo reset in an empty foreign context without writing ABC records", async () => {
  const s = await setup(); const before = [...s.values];
  expect(() => s.auditStore.resetFiveSAudits()).toThrow(/foreign factory/);
  expect([...s.values]).toEqual(before);
});
