"use client";

import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { SettingsAccessDenied, useSettingsAccess } from "./settings-access";

export default function SettingsModuleAccessPage() {
  const access = useSettingsAccess();
  if (!access.isSuperAdmin) return <PageContainer><FiveSPageHeader eyebrow="" title="Factory Module Access" description="Metric Mind configures modules independently for each factory."/><SettingsAccessDenied area="platform factory module access"/></PageContainer>;
  return <PageContainer><FiveSPageHeader eyebrow="Settings" title="Factory Module Access" description="Client-level module switches have been retired. Select a client and manage the intended factory."/><Button nativeButton={false} render={<Link href="/super-admin/organizations"/>}>Open Clients & subscriptions</Button></PageContainer>;
}
