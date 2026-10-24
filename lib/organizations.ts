"use client";
import { getAccessV3State, useAccessV3State } from "@/features/five-s/administration/access-v3-state";
export interface Organization {
  id: string;
  name: string;
  industry: string;
  plants: number;
  users: number;
  status: "Active" | "Inactive";
  lastUpdated: string;
  /** New clients remain non-operational until a separately approved activation. */
  operationalState?: "Staged" | "Active";
  /** Explicitly generated disposable demo data; never evidence of production approval. */
  demoDataset?: { id: "ops-iq-v4-demo-v1"; disposable: true; generatedAt: string; authorizedBy: "product-owner" };
}

export const ORGANIZATIONS: readonly Organization[] = [
  { id: "abc-manufacturing", name: "ABC Manufacturing", industry: "Manufacturing", plants: 1, users: 42, status: "Active", lastUpdated: "Today" },
] as const;

export const DEMO_ORGANIZATION = ORGANIZATIONS[0];

export function getOrganizations() { const updates = getAccessV3State().clients; return [...ORGANIZATIONS.filter(item => !updates.some(client => client.id === item.id)), ...updates]; }
export function useOrganizations() { useAccessV3State(); return getOrganizations(); }
