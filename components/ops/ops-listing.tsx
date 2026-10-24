import type { ComponentProps, ReactNode } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Presentation only: modules retain authorization, filters, columns and row actions. */
export function OpsListingLayout({ className, ...props }: ComponentProps<typeof PageContainer>) {
  return <PageContainer {...props} className={cn("min-w-0 max-w-none", OPS_LISTING_TABLE, className)} />;
}

/** Shared table treatment, scoped to listings so overview visualizations stay intact. */
export const OPS_LISTING_TABLE = "min-w-0 [&_table]:text-sm [&_thead]:bg-muted/20 [&_th]:h-11 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_td]:px-4 [&_td]:py-3 [&_tbody_tr]:border-b [&_tbody_tr]:border-border/60 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/25 [&_tbody_tr:last-child]:border-0";

export function OpsListingToolbar({ children, onClear, active = false }: { children: ReactNode; onClear?: () => void; active?: boolean }) {
  return <section aria-label="Listing filters" className="grid min-w-0 gap-3 rounded-xl border bg-card p-3"><div className="flex min-w-0 flex-wrap items-end gap-2 [&>*]:min-w-0 [&>*]:max-w-full [&>label]:flex-1">{children}{active && onClear && <Button type="button" variant="ghost" onClick={onClear}>Clear Filters</Button>}</div></section>;
}
