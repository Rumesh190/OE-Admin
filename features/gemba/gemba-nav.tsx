"use client";

import { usePathname } from "next/navigation";
import { OpsTabBar } from "@/components/ops/ops-tabs";

const GEMBA_TABS = [
  { id: "overview", label: "Overview", href: "/gemba" },
  { id: "walks", label: "All Walks", href: "/gemba?tab=walks" },
  { id: "observations", label: "All Observations", href: "/gemba?tab=observations" },
];

export function GembaNav() {
  const pathname = usePathname();
  const active = pathname.startsWith("/gemba/settings") ? "settings" : "overview";
  return <OpsTabBar label="Gemba sections" tabs={GEMBA_TABS} active={active} />;
}
