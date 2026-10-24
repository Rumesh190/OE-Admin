"use client";
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { deletedRecordHref, useRecordDeletions } from "@/lib/records/record-tombstones";
export default function OpsRecordLink({ children, ...props }: ComponentProps<typeof NextLink>) {
  useRecordDeletions();
  const deleted = typeof props.href === "string" ? deletedRecordHref(props.href) : undefined;
  if (deleted) return <span className={props.className} title={`Deleted record ${deleted.id}`}>{children}<span className="ml-1 text-xs text-muted-foreground">{deleted.module === "action" ? "Action deleted" : "Source deleted"}</span></span>;
  return <NextLink {...props}>{children}</NextLink>;
}
