"use client";

import { useUrlState } from "@/lib/navigation/use-url-state";
import { usePathname } from "next/navigation";
import { OpsTabBar } from "@/components/ops/ops-tabs";

const RED_TAG_TABS = [
  { id: "overview", label: "Overview", href: "/5s/red/overview" },
  { id: "red-tag", label: "All", href: "/5s/red" },
  { id: "under-review", label: "Under Review", href: "/5s/red?tab=under-review" },
  { id: "awaiting-closure", label: "Awaiting Closure", href: "/5s/red/awaiting-closure" },
  { id: "closed", label: "Closed", href: "/5s/red/closed" },
  { id: "settings", label: "Settings", href: "/5s/red/settings" },
];

export function RedTagNav({ counts }: { counts?: Record<string, number> } = {}) {
  const url = useUrlState();
  const pathname = usePathname();
  const active = pathname.startsWith("/5s/red/settings") ? "settings" : pathname.startsWith("/5s/red/overview") ? "overview" : pathname.startsWith("/5s/red/awaiting-closure") ? "awaiting-closure" : pathname.startsWith("/5s/red/closed") ? "closed" : url.params.get("tab") === "under-review" ? "under-review" : "red-tag";
  return <OpsTabBar label="Red Tag sections" onChange={id => url.update({ tab: id === "under-review" ? "under-review" : undefined, status: undefined }, "push")} tabs={RED_TAG_TABS.map(tab => ({ ...tab, count: counts?.[tab.id], href: (() => { if (counts && pathname === "/5s/red" && ["red-tag", "under-review"].includes(tab.id)) return undefined; if (!counts || tab.id === "overview" || tab.id === "settings") return tab.href; const [path, query] = tab.href.split("?"); const params = new URLSearchParams(query); for (const key of ["search", "section", "reason", "person", "date"]) { const value = url.params.get(key); if (value) params.set(key, value); } return path + (params.size ? `?${params}` : ""); })() }))} active={active} />;
}
