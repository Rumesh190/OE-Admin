"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganizations } from "@/lib/organizations";
export function AuditQuestionOrganization({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const organizations = useOrganizations();
  return <div className="mb-4 space-y-2"><p id="audit-question-organization-label" className="text-sm font-medium">Organization</p><Select value={value} onValueChange={id => { if (id) onChange(id); }}><SelectTrigger aria-labelledby="audit-question-organization-label" className="w-full sm:max-w-sm"><SelectValue /></SelectTrigger><SelectContent>{organizations.map(org => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}</SelectContent></Select></div>;
}
