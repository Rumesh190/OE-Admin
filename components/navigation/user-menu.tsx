"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, Check, Database, Factory, Languages, LogOut, Palette, RotateCcw, Search, Settings, Shield, Users } from "lucide-react"
import { useAccessContext } from "@/features/five-s/administration/access-v4-context"
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state"
import { useAccessV4State } from "@/features/five-s/administration/access-v4-state"
import { useAdminUsers } from "@/features/five-s/administration/store"
import { switchFinalDemoPersona, type DemoPersonaTarget } from "@/lib/demo/switch-final-persona"
import { getCanonicalProfileHierarchy, type CanonicalClientProfiles, type CanonicalFactoryProfiles, type CanonicalProfile } from "@/lib/demo/canonical-profiles"
import { getFinalDemoManifest } from "@/lib/demo/final-demo"
import { initializeNativeRoleDemo, resetNativeRoleDemo } from "@/lib/demo/native-demo-data"
import { useOrganizationConfiguration } from "@/lib/organization-store"
import { useOrganizations } from "@/lib/organizations"
import { useCurrentUser } from "@/lib/current-user"
import { LANGUAGE_OPTIONS } from "@/lib/i18n"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PreferencesDialog } from "@/components/preferences/preferences-dialog"
import { useI18n } from "@/components/preferences/use-i18n"
import { useAuth } from "@/components/auth/auth-provider"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function roleGroups(users: CanonicalProfile[]) {
  const groups = new Map<string, CanonicalProfile[]>()
  for (const user of users) groups.set(user.primaryRole, [...(groups.get(user.primaryRole) ?? []), user])
  return [...groups]
}

function profileText(profile: CanonicalProfile) {
  return `${profile.name} ${profile.primaryRole} ${profile.responsibilities.join(" ")}`.toLocaleLowerCase()
}

function filterHierarchy(clients: CanonicalClientProfiles[], query: string) {
  if (!query) return clients
  return clients.flatMap(client => {
    const clientMatch = client.name.toLocaleLowerCase().includes(query)
    const administrator = client.administrator && (clientMatch || profileText(client.administrator).includes(query)) ? client.administrator : null
    const factories = client.factories.flatMap(factory => {
      const factoryMatch = clientMatch || factory.name.toLocaleLowerCase().includes(query)
      const users = factory.users.filter(profile => factoryMatch || profileText(profile).includes(query))
      return factoryMatch || users.length ? [{ ...factory, users }] : []
    })
    return clientMatch || administrator || factories.length ? [{ ...client, administrator, factories }] : []
  })
}

/** Development-only canonical identity switcher plus the normal account controls. */
function UserMenu() {
  const router = useRouter()
  const [switchError, setSwitchError] = React.useState("")
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [demoPending, setDemoPending] = React.useState(false)
  const [profileSearch, setProfileSearch] = React.useState("")
  const [preferencesOpen, setPreferencesOpen] = React.useState(false)
  const { context, ready } = useAccessContext()
  useAccessV3State(); useAccessV4State(); useAdminUsers(true); useOrganizations(); useOrganizationConfiguration()
  const currentUser = useCurrentUser()
  const { language, setLanguage, t } = useI18n()
  const { logout, demoEnabled } = useAuth()
  const hierarchy = ready ? getCanonicalProfileHierarchy() : { platform: null, clients: [] }
  const query = profileSearch.trim().toLocaleLowerCase()
  const clients = filterHierarchy(hierarchy.clients, query)
  const platform = hierarchy.platform
  const platformVisible = Boolean(platform && (!query || profileText(platform).includes(query) || "metric mind".includes(query)))

  async function prepareDemo(reset = false) {
    setDemoPending(true); setSwitchError("")
    try { await (reset ? resetNativeRoleDemo() : initializeNativeRoleDemo()); setResetOpen(false); router.replace("/dashboard") }
    catch (error) { setSwitchError(error instanceof Error ? error.message : "Unable to prepare the role demo.") }
    finally { setDemoPending(false) }
  }

  function activeTarget(personId: string, target: DemoPersonaTarget) {
    if (currentUser.id !== personId || context?.kind !== target.kind) return false
    if (target.kind === "platform") return true
    if (context.kind === "platform" || context.organizationId !== target.organizationId) return false
    return target.kind === "client" || (context.kind === "factory" && context.plantId === target.plantId)
  }

  function chooseProfile(personId: string, target: DemoPersonaTarget) {
    try {
      switchFinalDemoPersona(personId, target)
      setSwitchError(""); setProfileSearch(""); setMenuOpen(false)
      router.replace("/dashboard")
    } catch (error) { setSwitchError(error instanceof Error ? error.message : "Unable to switch profile") }
  }

  function profileItem(profile: CanonicalProfile, target: DemoPersonaTarget, label = profile.name) {
    return <DropdownMenuItem key={`${profile.personId}:${target.kind}:${target.kind === "platform" ? "" : target.organizationId}:${target.kind === "factory" ? target.plantId : ""}`} disabled={demoPending} onClick={() => chooseProfile(profile.personId, target)}><Users/><span className="min-w-0 flex-1"><span className="block truncate">{label}</span><span className="block truncate text-xs text-muted-foreground">{profile.responsibilities.join(" · ")}</span></span>{activeTarget(profile.personId, target) && <Check className="text-primary"/>}</DropdownMenuItem>
  }

  function factoryMenu(factory: CanonicalFactoryProfiles, organizationId: string) {
    const target = { kind: "factory", organizationId, plantId: factory.id } as const
    return <DropdownMenuSub key={factory.id}><DropdownMenuSubTrigger><Factory/><span className="min-w-0 flex-1 truncate">{factory.name}</span>{context?.kind === "factory" && context.organizationId === organizationId && context.plantId === factory.id && <Check className="text-primary"/>}</DropdownMenuSubTrigger><DropdownMenuSubContent className="max-h-80 w-80 overflow-y-auto">
      {roleGroups(factory.users).map(([role, profiles]) => <React.Fragment key={role}><div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{role}</div>{profiles.map(profile => profileItem(profile, target))}</React.Fragment>)}
      {!factory.users.length && <p className="px-3 py-4 text-center text-sm text-muted-foreground">No factory users.</p>}
    </DropdownMenuSubContent></DropdownMenuSub>
  }

  function clientMenu(client: CanonicalClientProfiles) {
    const clientTarget = { kind: "client", organizationId: client.id } as const
    return <DropdownMenuSub key={client.id}><DropdownMenuSubTrigger><Building2/><span className="min-w-0 flex-1 truncate">{client.name}</span>{context?.kind !== "platform" && context?.organizationId === client.id && <Check className="text-primary"/>}</DropdownMenuSubTrigger><DropdownMenuSubContent className="max-h-80 w-80 overflow-y-auto">
      {client.administrator && profileItem(client.administrator, clientTarget)}
      {client.administrator && client.factories.length > 0 && <DropdownMenuSeparator/>}
      {client.factories.map(factory => factoryMenu(factory, client.id))}
      {!client.administrator && !client.factories.length && <p className="px-3 py-4 text-center text-sm text-muted-foreground">No authorized profiles.</p>}
    </DropdownMenuSubContent></DropdownMenuSub>
  }

  function searchResults(client: CanonicalClientProfiles) {
    const clientTarget = { kind: "client", organizationId: client.id } as const
    return <div key={client.id} className="border-b py-1 last:border-b-0"><div className="px-2 py-1 text-xs font-semibold">{client.name}</div>
      {client.administrator && profileItem(client.administrator, clientTarget)}
      {client.factories.map(factory => { const target = { kind: "factory", organizationId: client.id, plantId: factory.id } as const; return <div key={factory.id} className="py-1"><div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground"><Factory className="size-3.5"/>{factory.name}</div>{factory.users.map(profile => profileItem(profile, target))}</div> })}
    </div>
  }

  return <>
    <DropdownMenu open={menuOpen} onOpenChange={open => { setMenuOpen(open); if (!open) setProfileSearch("") }}>
      <DropdownMenuTrigger render={<button type="button" className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Account menu"/>}><Avatar>{currentUser.photo && <AvatarImage src={currentUser.photo} alt=""/>}<AvatarFallback>{currentUser.initials}</AvatarFallback></Avatar></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[85dvh] w-80 overflow-y-auto">
        <div className="flex flex-col gap-0.5 px-2 py-1.5"><span className="truncate text-sm font-medium text-foreground">{currentUser.name}</span><span className="truncate text-xs text-muted-foreground">{currentUser.role}</span></div>
        <DropdownMenuSeparator/>
        {demoEnabled && <><div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Switch profile</div>{switchError && <p role="alert" className="px-2 py-1 text-sm text-destructive">{switchError}</p>}<DropdownMenuGroup>
          {(hierarchy.platform || hierarchy.clients.length > 0) ? <><div className="relative mx-1 mb-1"><Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/><Input aria-label="Search profiles, clients, factories and roles" className="h-8 pl-7 text-xs" placeholder="Search profiles or factories" value={profileSearch} onChange={event => setProfileSearch(event.target.value)} onKeyDown={event => event.stopPropagation()}/></div>
            {platformVisible && platform && <DropdownMenuItem disabled={demoPending} onClick={() => chooseProfile(platform.personId, { kind: "platform" })}><Shield/><span className="min-w-0 flex-1"><span className="block">Metric Mind</span><span className="block text-xs text-muted-foreground">Platform Super Admin</span></span>{activeTarget(platform.personId, { kind: "platform" }) && <Check className="text-primary"/>}</DropdownMenuItem>}
            {platformVisible && clients.length > 0 && <DropdownMenuSeparator/>}
            {query ? clients.map(searchResults) : clients.map(clientMenu)}
            {!platformVisible && clients.length === 0 && <p className="px-2 py-5 text-center text-sm text-muted-foreground">No matching profiles.</p>}
          </> : <DropdownMenuItem disabled={demoPending} onClick={() => void prepareDemo()}><Database/><span className="min-w-0 flex-1"><span className="block">Initialize role demo</span><span className="block text-xs text-muted-foreground">Create canonical demo identities</span></span></DropdownMenuItem>}
          {!getFinalDemoManifest() && (hierarchy.platform || hierarchy.clients.length > 0) && <DropdownMenuItem disabled={demoPending} onClick={() => void prepareDemo()}><Database/><span>Initialize role demo</span></DropdownMenuItem>}
          {(hierarchy.platform || hierarchy.clients.length > 0) && <DropdownMenuItem disabled={demoPending} onClick={() => setResetOpen(true)}><RotateCcw/><span className="min-w-0 flex-1"><span className="block">Reset demo data</span><span className="block text-xs text-muted-foreground">Rebuild marked disposable records</span></span></DropdownMenuItem>}
        </DropdownMenuGroup><DropdownMenuSeparator/></>}
        <DropdownMenuGroup><DropdownMenuItem render={<Link href="/profile"/>}><Users/>{t("account.profile")}</DropdownMenuItem><DropdownMenuItem render={<Link href={currentUser.role === "Client Administrator" ? "/dashboard?view=administration" : "/settings"}/>}><Settings/>{currentUser.role === "Client Administrator" ? "Administration" : "Settings"}</DropdownMenuItem><DropdownMenuItem onClick={() => setPreferencesOpen(true)}><Palette/>{t("account.appearance")}</DropdownMenuItem></DropdownMenuGroup>
        <DropdownMenuSeparator/><div className="flex items-center gap-2 px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Languages className="size-3.5"/>{t("language")}</div><DropdownMenuGroup>{LANGUAGE_OPTIONS.map(option => <DropdownMenuItem key={option.code} onClick={() => setLanguage(option.code)}><span lang={option.code} className="min-w-0 flex-1">{option.name}</span>{language === option.code && <Check className="text-primary"/>}</DropdownMenuItem>)}</DropdownMenuGroup>
        <DropdownMenuSeparator/><DropdownMenuItem variant="destructive" onClick={logout}><LogOut/>{t("account.logout")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <PreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen}/>
    <AlertDialog open={resetOpen} onOpenChange={open => { if (!demoPending) setResetOpen(open) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset the role demo?</AlertDialogTitle><AlertDialogDescription>This replaces only records marked as disposable multi-client demo data. Other clients and records remain unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={demoPending}>Cancel</AlertDialogCancel><Button disabled={demoPending} onClick={() => void prepareDemo(true)}>{demoPending ? "Resetting…" : "Reset demo data"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>
}

export { UserMenu }
