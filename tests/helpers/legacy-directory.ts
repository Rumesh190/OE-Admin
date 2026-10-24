import type { AdminUser, AdminUserInput } from "@/features/five-s/administration/types";
/** Existing persisted legacy identity fixture, not a new-user authorization operation. */
export function seedLegacyDirectoryPerson(store: typeof import("@/features/five-s/administration/store"), input: AdminUserInput): AdminUser {
  const person: AdminUser = { ...input, id: `USR-LEGACY-FIXTURE-${input.employeeId}`, updatedAt: "2026-09-02T00:00:00.000Z" };
  window.localStorage.setItem("five-s-administration-users-v1", JSON.stringify([person, ...store.getAdminUsers().filter(user => user.id !== person.id)]));
  store.refreshAdminDirectory();
  return person;
}
