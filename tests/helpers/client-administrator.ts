/** Read the administrator provisioned atomically by the canonical client command. */
export async function provisionedClientAdministrator(organizationId: string) {
  const { getAccessV3State } = await import("@/features/five-s/administration/access-v3-state");
  const { getAdminUser } = await import("@/features/five-s/administration/store");
  const memberships = getAccessV3State().clientMemberships.filter(m => m.organizationId === organizationId && m.clientAdmin && m.status === "Active");
  if (memberships.length !== 1) throw new Error("Expected exactly one automatically provisioned Client Admin");
  const person = getAdminUser(memberships[0].userId);
  if (!person) throw new Error("Provisioned Client Admin identity is missing");
  return person;
}

/** Explicit pre-existing ABC compatibility fixture; never used by application code. */
export async function seedLegacyClientAdministrator() {
  const { getAccessV3State, ACCESS_V3_KEY, notifyAccessV3 } = await import("@/features/five-s/administration/access-v3-state");
  const { getAdminUsers, refreshAdminDirectory } = await import("@/features/five-s/administration/store");
  const state = structuredClone(getAccessV3State());
  const person = { ...getAdminUsers()[0], id: "USR-TEST-LEGACY-CA", name: "Legacy Client Administrator", email: "legacy-ca@test.invalid", employeeId: "LEGACY-CA", roles: [], permissions: [], zoneMemberships: [] };
  window.localStorage.setItem("five-s-administration-users-v1", JSON.stringify([...getAdminUsers(), person]));
  state.clientMemberships.push({ id: "CM-TEST-LEGACY-CA", userId: person.id, organizationId: "abc-manufacturing", clientAdmin: true, status: "Active", assignedBy: "USR-OPS-SUPER-ADMIN", assignedAt: "2026-01-01", updatedAt: "2026-01-01" });
  window.localStorage.setItem(ACCESS_V3_KEY, JSON.stringify(state));
  refreshAdminDirectory(); notifyAccessV3();
  return person;
}
