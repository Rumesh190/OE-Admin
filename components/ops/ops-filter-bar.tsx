"use client";
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export function OpsFilterBar({ primary, extra, expanded, onToggle, activeCount = 0, className, onClear, hasFilters = false }: { primary: React.ReactNode; extra?: React.ReactNode; expanded: boolean; onToggle: () => void; activeCount?: number; className?: string; onClear?: () => void; hasFilters?: boolean }) {
 return <div className="border-b bg-muted/15 p-3"><div className={cn('grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_auto]',className)}>{primary}<Button type="button" variant={expanded ? 'secondary' : 'outline'} aria-expanded={expanded} onClick={onToggle}><SlidersHorizontal className="size-4" />More filters{activeCount > 0 && <span className="rounded bg-primary px-1.5 text-xs text-primary-foreground">{activeCount}</span>}</Button></div>{hasFilters && onClear && <Button type="button" variant="ghost" className="mt-2" onClick={onClear}>Clear Filters</Button>}{expanded && <div className="mt-3 grid min-w-0 gap-2 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">{extra}</div>}</div>;
}
