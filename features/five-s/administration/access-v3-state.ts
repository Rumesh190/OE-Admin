"use client";
import { readAdministrationPayload } from "@/lib/administration-storage";
import { useSyncExternalStore } from "react";
import type { AccessV3State } from "./access-v3-types";
export const ACCESS_V3_KEY = "ops-access-v3-administration-v1";
export const EMPTY_ACCESS_V3: AccessV3State = { version: 1, auditorGrants: [], clients: [], clientMemberships: [], factoryMemberships: [], zoneAllocations: [], factoryAdmins: [], factoryRequests: [], events: [] };
let raw: string | null | undefined;
let state = EMPTY_ACCESS_V3;
const listeners = new Set<() => void>();
export function getAccessV3State(): AccessV3State {
    if (typeof window === "undefined")
        return EMPTY_ACCESS_V3;
    const value = readAdministrationPayload(ACCESS_V3_KEY);
    if (raw !== value) {
        const parsed = value ? JSON.parse(value) as AccessV3State : EMPTY_ACCESS_V3;
        if (parsed.version !== 1 || [parsed.clients, parsed.clientMemberships, parsed.factoryMemberships, parsed.zoneAllocations, parsed.factoryAdmins, parsed.events].some(items => !Array.isArray(items)))
            throw new Error("Administration data is invalid. Preserve the original browser payload and restore a valid backup before retrying.");
        if (parsed.auditorGrants !== undefined && !Array.isArray(parsed.auditorGrants)) throw new Error("Invalid Auditor authorization payload. Preserve browser storage.");
        if (parsed.factoryRequests !== undefined && !Array.isArray(parsed.factoryRequests)) throw new Error("Invalid factory request payload. Preserve browser storage.");
        state = { ...parsed, auditorGrants: parsed.auditorGrants ?? [], factoryRequests: parsed.factoryRequests ?? [] };
        raw = value;
    }
    return state;
}
export function notifyAccessV3() { listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); const changed = () => listener(); window.addEventListener?.("storage", changed); return () => { listeners.delete(listener); window.removeEventListener?.("storage", changed); }; }
export function useAccessV3State() { return useSyncExternalStore(subscribe, getAccessV3State, () => EMPTY_ACCESS_V3); }
