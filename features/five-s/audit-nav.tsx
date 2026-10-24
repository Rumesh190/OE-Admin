"use client";

import { usePathname } from "next/navigation";
import { OpsTabBar } from "@/components/ops/ops-tabs";

const AUDIT_TABS = [
  { id: "audits", label: "All", href: "/audits" },
  ...["Draft", "Scheduled", "In Progress", "Review", "Completed"].map(stage => ({ id: stage, label: stage, href: `/audits?tab=${encodeURIComponent(stage)}` })),
  { id: "settings", label: "Settings", href: "/audits/settings" },
];

export function AuditNav() {
  const pathname = usePathname();
  const active = pathname.startsWith("/audits/settings") ? "settings" : "audits";
  return <OpsTabBar label="Audits sections" tabs={AUDIT_TABS} active={active} />;
}
