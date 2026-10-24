"use client";

import { usePathname } from "next/navigation";
import { OpsTabBar } from "@/components/ops/ops-tabs";

const CI_TABS = [
  { id: "overview", label: "Overview", href: "/continuous-improvement" },
  { id: "improvements", label: "All", href: "/continuous-improvement?tab=improvements" },
  { id: "review", label: "Under Review", href: "/continuous-improvement?tab=review" },
  { id: "completed", label: "Completed", href: "/continuous-improvement?tab=completed" },
];

export function ContinuousImprovementNav() {
  const pathname = usePathname();
  const active = pathname.startsWith("/continuous-improvement/settings") ? "settings" : "overview";
  return <OpsTabBar label="Continual Improvement sections" tabs={CI_TABS} active={active} />;
}
