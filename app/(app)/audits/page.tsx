import { ModuleGate } from "@/components/modules/module-gate";
import FiveSAuditListPage from "@/features/five-s/audit-list-page";

export default async function Page({ searchParams }: { searchParams: Promise<{ audit?: string }> }) {
  const { audit } = await searchParams;
  return <ModuleGate id="audit"><FiveSAuditListPage key={audit ?? "listing"} initialAuditId={audit} /></ModuleGate>;
}
