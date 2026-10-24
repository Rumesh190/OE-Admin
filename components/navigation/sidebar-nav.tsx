"use client";

import { useCurrentUser } from "@/lib/current-user";
import { canOpenV4Administration } from "@/features/five-s/administration/access-v3-store";
import { LISTING_MAIN_ROUTES } from "@/lib/navigation/listing-defaults";
import { useUrlState } from "@/lib/navigation/use-url-state";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEnabledNavigationGroups, getNavigationGroup, isAccessCapabilityRouteActive } from "@/lib/modules";
import { useVisibleModuleAccess } from "@/lib/navigation/visible-module-access";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarNavProps { collapsed?: boolean; onNavigate?: () => void }

function activePath(pathname: string, href: string, aliases: readonly string[] = []) {
  return [href, ...aliases].some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function NavItem({ href, label, subtitle, icon: Icon, active, collapsed, onNavigate }: { href: string; label: string; subtitle?: string; icon: LucideIcon; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const url = useUrlState();
  const link = <Link href={href} onClick={event => {
    onNavigate?.();
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (LISTING_MAIN_ROUTES[href] && window.location.pathname === href && href !== "/visual-management") {
      event.preventDefault();
      const defaults: Record<string, string> = { "/gemba": "walks", "/continuous-improvement": "improvements", "/visual-improvement": "improvements", "/actions": "all", "/audits": "all", "/reports": "all" };
      url.update({ ...Object.fromEntries([...new URLSearchParams(window.location.search).keys()].map(key => [key, undefined])), tab: defaults[href] }, "push");
    }
  }} aria-current={active ? "page" : undefined} className={cn(
    "group relative flex items-center rounded-lg text-[13px] font-medium text-slate-300 outline-none transition-[background-color,color] duration-150 hover:bg-white/[0.055] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]",
    subtitle && !collapsed ? "min-h-11 py-1.5" : "h-10",
    collapsed ? "justify-center px-0" : "gap-3 px-3",
    active && "bg-[#1c2a40] text-white",
  )}>
    {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-[var(--brand-accent)]" aria-hidden />}
    <Icon className={cn("size-[17px] shrink-0 transition-colors", active ? "text-[var(--brand-accent-light)]" : "text-slate-400/80 group-hover:text-slate-200")} />
    {!collapsed && <span className="min-w-0 flex-1 leading-tight"><span className="block truncate">{label}</span>{subtitle && <span className={cn("mt-0.5 block truncate text-[10.5px] font-medium", active ? "text-[var(--brand-accent-light)] opacity-80" : "text-slate-500 group-hover:text-slate-400")}>{subtitle}</span>}</span>}
    {collapsed && <span className="sr-only">{label}</span>}
  </Link>;
  const tooltip = subtitle ? `${label} — ${subtitle}` : label;
  return collapsed ? <Tooltip><TooltipTrigger render={link} /><TooltipContent side="right">{tooltip}</TooltipContent></Tooltip> : link;
}

function Section({ label, collapsed, children }: { label: string; collapsed: boolean; children: ReactNode }) {
  return <section className="mt-4 first:mt-0">{!collapsed && <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400/70">{label}</h2>}<div className="flex flex-col gap-0.5">{children}</div></section>;
}

function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const identity = useCurrentUser();
  const clientAdministrator = identity.role === "Client Administrator";
  const permitted = useVisibleModuleAccess();
  const groups = clientAdministrator ? [] : getEnabledNavigationGroups(permitted);
  return <nav aria-label="Primary" className={collapsed ? "px-2" : "px-3"}>
    <Section label={getNavigationGroup("overview").label} collapsed={collapsed}><NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} active={pathname === "/dashboard" || pathname === "/5s"} collapsed={collapsed} onNavigate={onNavigate} /></Section>
    {groups.map((group) => <Section key={group.id} label={group.label} collapsed={collapsed}>{group.items.map((capability) => <NavItem key={capability.id} href={capability.route} label={capability.label} subtitle={capability.stageLabel} icon={capability.icon} active={isAccessCapabilityRouteActive(pathname, capability)} collapsed={collapsed} onNavigate={onNavigate} />)}</Section>)}
    {!clientAdministrator && <Section label={getNavigationGroup("system").label} collapsed={collapsed}>{identity.isSuperAdmin && <NavItem href="/super-admin/organizations" label="Clients & subscriptions" icon={Building2} active={activePath(pathname, "/super-admin")} collapsed={collapsed} onNavigate={onNavigate} />}<NavItem href="/settings" label="Settings" icon={Settings} active={activePath(pathname, "/settings")} collapsed={collapsed} onNavigate={onNavigate} />{canOpenV4Administration() && <NavItem href="/settings/administration" label="Administration" icon={Building2} active={activePath(pathname, "/settings/administration")} collapsed={collapsed} onNavigate={onNavigate} />}</Section>}
  </nav>;
}

function SuperAdminSidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  return <SidebarNav collapsed={collapsed} onNavigate={onNavigate}/>;
}

export { SidebarNav, SuperAdminSidebarNav };
