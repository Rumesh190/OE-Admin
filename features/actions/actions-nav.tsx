"use client";
import { usePathname } from "next/navigation";
import { OpsTabBar } from "@/components/ops/ops-tabs";
import { ACTION_CENTER_TABS, canViewTeamActions } from "./action-center-data";
import { useCurrentUser } from "@/lib/current-user";
import { useAdminUsers } from "@/features/five-s/administration/store";

export function ActionsNav() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const admin = useAdminUsers().find(item => item.id === user.id);
  const tabs = ACTION_CENTER_TABS.filter(tab => tab.id !== "team-actions" || canViewTeamActions(admin)).map(tab => ({ ...tab, href: `/actions?tab=${tab.id}` }));
  return <OpsTabBar label="Actions sections" tabs={[...tabs, { id: "settings", label: "Settings", href: "/actions/settings" }]} active={pathname.startsWith("/actions/settings") ? "settings" : "all"} />;
}
