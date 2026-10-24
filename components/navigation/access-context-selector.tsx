"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, ChevronRight, Factory, Search, Shield } from "lucide-react";
import {
  authorizedContextOptions,
  selectAccessContext,
  useAccessContext,
  type AccessContext,
} from "@/features/five-s/administration/access-v4-context";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { useOrganizationConfiguration, getAllOrganizationConfiguration } from "@/lib/organization-store";
import { getOrganizations, useOrganizations } from "@/lib/organizations";
import { useCurrentUser } from "@/lib/current-user";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function id(context: AccessContext) {
  return `${context.kind}:${context.organizationId ?? ""}:${context.plantId ?? ""}`;
}

function currentLabel(context: AccessContext | null) {
  if (!context) return { primary: "Select context", secondary: "Client or factory" };
  if (context.kind === "platform") return { primary: "Platform Administration", secondary: "Metric Mind" };
  const client = getOrganizations().find((item) => item.id === context.organizationId)?.name ?? "Client";
  if (context.kind === "client") return { primary: client, secondary: "Client administration" };
  const factory = getAllOrganizationConfiguration().plants.find((item) => item.id === context.plantId)?.name ?? "Factory";
  return { primary: factory, secondary: client };
}

export function AccessContextSelector() {
  const current = useCurrentUser();
  const router = useRouter();
  const { context, ready } = useAccessContext();
  const access = useAccessV3State();
  useOrganizations();
  useOrganizationConfiguration();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  if (!ready) return null;

  const isClientAdmin = access.clientMemberships.some(
    (membership) => membership.userId === current.id && membership.status === "Active" && membership.clientAdmin,
  );
  if (!current.isSuperAdmin && !isClientAdmin) return null;

  const options = authorizedContextOptions();
  const platform = options.find((option) => option.kind === "platform");
  const organizations = getOrganizations().filter((organization) => organization.status === "Active");
  const plants = getAllOrganizationConfiguration().plants;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const clients = organizations.flatMap((organization) => {
    const clientContext = options.find(
      (option) => option.kind === "client" && option.organizationId === organization.id,
    );
    const factories = options
      .filter((option): option is Extract<AccessContext, { kind: "factory" }> =>
        option.kind === "factory" && option.organizationId === organization.id,
      )
      .map((factoryContext) => ({
        context: factoryContext,
        name: plants.find((plant) => plant.id === factoryContext.plantId)?.name ?? "Factory",
      }));
    if (!clientContext && factories.length === 0) return [];

    const clientMatches = organization.name.toLocaleLowerCase().includes(normalizedQuery);
    const matchingFactories = factories.filter((factory) =>
      factory.name.toLocaleLowerCase().includes(normalizedQuery),
    );
    if (normalizedQuery && !clientMatches && matchingFactories.length === 0) return [];

    return [{
      context: clientContext,
      factories,
      matchingFactories,
      name: organization.name,
      searchRevealsFactories: Boolean(normalizedQuery && matchingFactories.length),
    }];
  });
  const selection = currentLabel(context);
  const selectedId = context ? id(context) : "";

  function choose(selected: AccessContext) {
    selectAccessContext(selected);
    setOpen(false);
    setQuery("");
    setExpandedClients(new Set());
    if (selected.kind === "platform") router.replace("/super-admin/organizations");
    else if (selected.kind === "client") router.replace(current.isSuperAdmin ? `/super-admin/organizations/${selected.organizationId}` : "/dashboard");
    else router.replace("/dashboard");
  }

  function toggleClient(organizationId: string) {
    setExpandedClients((previous) => {
      const next = new Set(previous);
      if (next.has(organizationId)) next.delete(organizationId);
      else next.add(organizationId);
      return next;
    });
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setQuery("");
        setExpandedClients(new Set());
      }
    }}>
      <PopoverTrigger
        aria-label={`Active context: ${selection.primary}`}
        className="hidden h-10 w-64 items-center gap-2 rounded-lg border bg-background px-3 text-left shadow-xs outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 lg:flex"
      >
        <Building2 className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-4">{selection.primary}</span>
          <span className="block truncate text-[11px] leading-4 text-muted-foreground">{selection.secondary}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-2 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search clients and factories"
            autoFocus
            className="h-8 pl-8"
            placeholder="Search clients or factories"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {platform && (
          <button
            type="button"
            className={cn(
              "flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
              selectedId === id(platform) && "bg-muted font-medium",
            )}
            onClick={() => choose(platform)}
          >
            <Shield className="size-4 text-muted-foreground" />
            <span className="flex-1">Platform Administration</span>
            {selectedId === id(platform) && <Check className="size-4 text-primary" />}
          </button>
        )}

        {platform && <div className="h-px bg-border" />}

        <div className="max-h-72 overflow-y-auto">
          {clients.map((client) => {
            const organizationId = client.context?.organizationId ?? client.factories[0]?.context.organizationId ?? "";
            const expanded = expandedClients.has(organizationId) || client.searchRevealsFactories;
            const visibleFactories = normalizedQuery && client.searchRevealsFactories && !client.name.toLocaleLowerCase().includes(normalizedQuery)
              ? client.matchingFactories
              : client.factories;
            return (
              <div key={organizationId} className="py-0.5">
                <div className={cn("flex min-h-9 items-center rounded-md hover:bg-muted", client.context && selectedId === id(client.context) && "bg-muted font-medium")}>
                  {client.factories.length > 0 ? (
                    <button
                      type="button"
                      className="ml-1 flex size-7 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={`${expanded ? "Collapse" : "Expand"} ${client.name} factories`}
                      aria-expanded={expanded}
                      onClick={() => toggleClient(organizationId)}
                    >
                      {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                    </button>
                  ) : <span className="ml-1 size-7" />}
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 self-stretch pr-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
                    disabled={!client.context}
                    onClick={() => client.context && choose(client.context)}
                  >
                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{client.name}</span>
                    {client.context && selectedId === id(client.context) && <Check className="ml-auto size-4 shrink-0 text-primary" />}
                  </button>
                </div>

                {expanded && visibleFactories.length > 0 && (
                  <div className="ml-5 border-l pl-2">
                    {visibleFactories.map((factory) => (
                      <button
                        key={id(factory.context)}
                        type="button"
                        className={cn(
                          "flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                          selectedId === id(factory.context) && "bg-muted font-medium",
                        )}
                        onClick={() => choose(factory.context)}
                      >
                        <Factory className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{factory.name}</span>
                        {selectedId === id(factory.context) && <Check className="size-4 shrink-0 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {clients.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matching clients or factories.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
