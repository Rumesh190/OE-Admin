import Link from "next/link";
import { ActiveAccessLabel } from "./active-access-label";
import { ClipboardCheck } from "lucide-react";
import { BreadcrumbNav } from "@/components/navigation/breadcrumb-nav";
import { MobileNavDrawer } from "@/components/navigation/mobile-nav-drawer";
import { NotificationBell } from "@/components/navigation/notification-bell";
import { UserMenu } from "@/components/navigation/user-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AccessContextSelector } from "./access-context-selector";

/** Light contextual header; all product navigation lives in the sidebar. */
function Header() {
  return <header className="sticky top-0 z-30 flex h-(--app-header-height) shrink-0 items-center gap-3 border-b border-border/80 bg-white/95 px-3 text-slate-900 backdrop-blur-sm supports-backdrop-filter:bg-white/85 dark:border-white/10 dark:bg-[#20252d]/95 dark:text-foreground dark:shadow-[0_1px_0_rgb(255_255_255/0.025)] sm:px-5 lg:px-6">
    <div className="lg:hidden"><MobileNavDrawer /></div>
    <Link href="/dashboard" className="flex min-w-0 items-center gap-2 rounded-lg lg:hidden" aria-label="OE Dashboard"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-accent)] text-[var(--brand-accent-foreground)]"><ClipboardCheck className="size-[18px]" /></span><span className="font-heading text-sm font-semibold">OE</span></Link>
    <div className="hidden min-w-0 sm:block"><BreadcrumbNav /></div>
    <div className="ml-auto flex items-center gap-1.5"><ActiveAccessLabel /><AccessContextSelector /><ThemeToggle /><NotificationBell /><UserMenu /></div>
  </header>;
}

export { Header };
