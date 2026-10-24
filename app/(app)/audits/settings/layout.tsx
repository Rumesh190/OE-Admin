import { SettingsDetailBack } from "@/components/settings/settings-detail-back";
import { ModuleGate } from "@/components/modules/module-gate";

export default function AuditSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGate id="audit">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <SettingsDetailBack backHref="/audits/settings" label="Back to Audit Settings" />
        {children}
      </div>
    </ModuleGate>
  );
}
