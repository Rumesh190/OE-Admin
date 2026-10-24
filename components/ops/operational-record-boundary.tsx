"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { deletedRecordHref, useRecordDeletions } from "@/lib/records/record-tombstones";
import { OpsEmptyState } from "./ops-empty-state";
export function OperationalRecordBoundary({ children }: { children: ReactNode }) {
  useRecordDeletions();
  const path = usePathname();
  const url = useUrlState();
  const deleted = deletedRecordHref(url.path || path);
  if (deleted) return <OpsEmptyState title="Record deleted" description={`Record ${deleted.id} is no longer active. Linked Actions and stored history have been retained. A historical report snapshot is not available from this route.`} />;
  return children;
}
