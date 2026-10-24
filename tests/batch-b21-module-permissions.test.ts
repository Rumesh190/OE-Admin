import { seedLegacyDirectoryPerson } from "./helpers/legacy-directory";
import { authenticateDemoFixture } from "./helpers/demo-session";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_USERS } from "@/lib/current-user";
const admin = DEMO_USERS.auditor;
const leader = DEMO_USERS.leader;
const member = DEMO_USERS.responsible;
beforeEach(() => {
  vi.resetModules(); const values = new Map<string, string>();
  const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  vi.stubGlobal("window", { localStorage }); authenticateDemoFixture(); vi.stubGlobal("localStorage", localStorage);
});
afterEach(() => vi.unstubAllGlobals());

describe("B2.1 Gemba command authorization", () => {
  it("protects observations, source links and IndexedDB references from unauthorized edits", async () => {
    const s = await import("@/features/gemba/gemba-store");
    const walk = s.createGembaWalk({ plant: "Egmore Plant", zone: "Zone A", leadId: admin.id, leadName: admin.name, participants: [], purpose: "Permission check", scheduledDate: "2026-10-16" }, admin, true)!;
    const input = { type: "Positive" as const, title: "Organized storage", description: "Clear labels", location: "Office", peopleInvolved: [], evidence: [{ id: "PHOTO-REF", name: "Original photo", storageKey: "gemba-original-photo", uploadedBy: admin.name, uploadedAt: "2026-10-16T10:00:00Z" }] };
    const observation = s.saveGembaObservation(walk.id, input, admin)!;
    expect(s.saveGembaObservation(walk.id, { ...input, title: "Unauthorized" }, member, observation.id)).toBeNull();
    expect(s.linkGembaAction(walk.id, observation.id, "ACTION-UNAUTHORIZED", leader)).toBe(false);
    expect(s.getGembaObservations(walk.id)[0]).toEqual(observation);
    expect(s.completeGembaWalk(walk.id, admin)).toBe(true);
    expect(s.saveGembaObservation(walk.id, input, admin, observation.id)).toBeNull();
  });
  it("rejects cross-plant creation and inactive or missing actors", async () => {
    const { canMutateGembaWalk } = await import("@/features/gemba/gemba-access");
    expect(canMutateGembaWalk({ plant: "Other Plant" }, admin)).toBe(false);
    expect(canMutateGembaWalk({ plant: "Egmore Plant" }, undefined)).toBe(false);
    expect(canMutateGembaWalk({ plant: "Egmore Plant" }, { id: "UNKNOWN" })).toBe(false);
  });
});
describe("B2.1 Visual Management command authorization", () => {
  it("rejects omitted and cross-zone actors before meeting mutations and freezes completed snapshots", async () => {
    const s = await import("@/features/visual-management/visual-management-store");
    expect(s.startVisualManagementMeeting("VM-ZA-T1", leader)).toBeNull();
    const meeting = s.startVisualManagementMeeting("VM-ZA-T1", admin)!;
    expect(s.addMeetingGuest(meeting.id, "Unauthorized")).toBeNull();
    expect(s.addMeetingGuest(meeting.id, "Cross-zone", undefined, leader)).toBeNull();
    expect(s.addMeetingGuest(meeting.id, "Authorized", undefined, admin)).not.toBeNull();
    const completed = s.completeVisualManagementMeeting(meeting.id, admin)!;
    expect(s.addMeetingGuest(meeting.id, "Too late", undefined, admin)).toBeNull();
    expect(s.completeVisualManagementMeeting(meeting.id, admin)).toEqual(completed);
    expect(s.getVisualManagementMeeting(meeting.id)).toEqual(completed);
  });
  it("denies configuration and KPI assignment without an active configuration authority", async () => {
    const s = await import("@/features/visual-management/visual-management-configuration-store");
    const board = s.getVisualManagementConfiguration().boards[0];
    expect(s.setVisualManagementBoardStatus(board.id, "Inactive")).toBe(false);
    expect(s.setVisualManagementBoardStatus(board.id, "Inactive", leader)).toBe(false);
    expect(s.getVisualManagementConfiguration().boards[0]).toEqual(board);
    expect(s.setVisualManagementBoardStatus(board.id, "Inactive", admin)).toBe(true);
    const k = await import("@/features/visual-management/kpi-execution-store");
    expect(k.submitKpiActual({ boardId: "VM-ZA-T1", kpiId: "anything", value: 1, reportingPeriod: { type: "daily", key: "2026-10-16", label: "Today" }, reportedByUserId: leader.id }).success).toBe(false);
  });
});

 describe("B2.1 inactive directory identity", () => {
  it("rejects a known inactive administrator across all three modules", async () => {
    const users = await import("@/features/five-s/administration/store");
    const original = users.getAdminUser(admin.id)!;
    const inactive = seedLegacyDirectoryPerson(users, { ...original, employeeId: "B21-INACTIVE", email: "b21-inactive@example.test", name: "Inactive fixture", status: "Inactive" });
    const gemba = await import("@/features/gemba/gemba-access");
    const vm = await import("@/features/visual-management/visual-management-store");

    expect(gemba.canMutateGembaWalk({ plant: "Egmore Plant" }, inactive)).toBe(false);
    expect(vm.startVisualManagementMeeting("VM-ZA-T1", inactive)).toBeNull();

    const configuration = await import("@/features/visual-management/visual-management-access");
    expect(configuration.canManageVisualManagementConfiguration(inactive)).toBe(false);
  });
});
