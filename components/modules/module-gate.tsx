"use client";

import { usePathname } from "next/navigation";
import { narrowAuditTaskHref } from "@/lib/actions/action-v4-policy";
import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { getAccessCapability, type AccessCapabilityId } from "@/lib/modules";
import { useVisibleModuleAccess } from "@/lib/navigation/visible-module-access";

export function ModuleGate({ id, children }: { id: AccessCapabilityId; children: ReactNode }) {
  const access = useVisibleModuleAccess();
  const pathname = usePathname();
  const taskDetail = id === "actions" && narrowAuditTaskHref(pathname);
  const moduleConfig = getAccessCapability(id);

  if (!taskDetail && !access[id]) {
    return (
      <PageContainer>
        <FiveSPageHeader
          eyebrow="OPS Workspace"
          title="Module unavailable"
          description={`${moduleConfig.label} is not available for the selected identity and factory.`}
        />
        <section className="grid min-h-[280px] place-items-center rounded-xl border border-border/75 bg-card px-6 text-center">
          <div>
            <span className="mx-auto grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
              <LockKeyhole className="size-5" />
            </span>
            <p className="mt-4 text-sm font-medium text-foreground">Review this profile's role and the factory's module access.</p>
          </div>
        </section>
      </PageContainer>
    );
  }

  return children;
}
