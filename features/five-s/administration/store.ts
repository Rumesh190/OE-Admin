"use client";
import { ADMINISTRATION_JOURNAL_KEY, readAdministrationPayload } from "@/lib/administration-storage";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { useMemo, useSyncExternalStore } from "react";
import { safeSetStorage } from "@/lib/browser-storage";
import { getOutstandingUserImprovements } from "../continuous-improvement/store";
import { getActions } from "@/lib/actions/action-store";
import { getOrganizationZone, getOrganizationZones, ORGANIZATION_MEMBER_SEEDS, ORGANIZATION_PLANT_SEEDS, ORGANIZATION_ZONE_SEEDS, saveOrganizationZone } from "@/lib/organization-store";
import { hasPermission, permissionsForRoles } from "./permissions";
import type { AdminRole, AdminUser, AdminUserInput } from "./types";

const KEY="five-s-administration-users-v1",STAMP="2026-09-02T00:00:00.000Z";
function email(name:string){return `${name.toLowerCase().replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"")}@egmore.example`}
function seeds():AdminUser[]{const map=new Map<string,AdminUser>();const plant=ORGANIZATION_PLANT_SEEDS[0].name;const add=(id:string,name:string,roles:AdminRole[],zone:string,responsibility:"Leader"|"Member")=>map.set(id,{id,employeeId:id.replace("USR-","EMP-"),name,email:email(name),plant,status:"Active",roles,zoneMemberships:[{zone,responsibility}],permissions:permissionsForRoles(roles),updatedAt:STAMP});for(const zone of ORGANIZATION_ZONE_SEEDS)add(zone.leaderId,zone.leaderName,zone.leaderId==="USR-LAKSHMAN"?["Admin","Auditor","Zone Leader"]:["Zone Leader"],zone.name,"Leader");for(const member of ORGANIZATION_MEMBER_SEEDS){const zone=ORGANIZATION_ZONE_SEEDS.find((item)=>item.id===member.zoneId)!;add(member.id,member.name,["Zone Member"],zone.name,"Member")}map.set("USR-OPS-SUPER-ADMIN",{id:"USR-OPS-SUPER-ADMIN",employeeId:"EMP-OPS-SUPER-ADMIN",name:"Metric Mind",email:"super.admin@ops.example",plant:"All organizations",status:"Active",roles:["Admin"],zoneMemberships:[],permissions:permissionsForRoles(["Admin"]),updatedAt:STAMP});return [...map.values()]}
export const ADMIN_USER_SEEDS=seeds(); let users=ADMIN_USER_SEEDS,loaded=false;const listeners=new Set<()=>void>();
function load(){if(loaded||typeof window==="undefined")return;loaded=true;try{const saved=readAdministrationPayload(KEY);if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed))users=parsed}}catch{}}
function emit(){if(typeof window==="undefined")return false;const result=safeSetStorage(KEY,users);if(!result.success)return false;listeners.forEach(listener=>listener());return true}
function subscribe(listener:()=>void){load();listeners.add(listener);return()=>listeners.delete(listener)}function snapshot(){load();return users}
export function useAdminUsers(includeScopedProfiles = false){const current=useSyncExternalStore(subscribe,snapshot,()=>ADMIN_USER_SEEDS);return useMemo(()=>includeScopedProfiles?current:current.filter(user=>user.accessModel!=="v3"),[current,includeScopedProfiles])}
export function getAdminUsers(){load();return users}
/** Fresh canonical directory for identity-sensitive writes; never repair malformed persisted data. */
export function getCanonicalAdminUsers(): AdminUser[] {
  const raw = readAdministrationPayload(KEY);
  const people: AdminUser[] = raw === null ? getAdminUsers() : JSON.parse(raw);
  if (!Array.isArray(people) || people.some(p => !p || typeof p.id !== "string" || typeof p.name !== "string" || typeof p.email !== "string" || typeof p.employeeId !== "string" || !["Active", "Inactive"].includes(p.status)) || new Set(people.map(p => p.id)).size !== people.length) throw new Error("Canonical identity data requires review. Preserve the existing directory.");
  return people;
}
export function getAdminUser(userId:string){load();return users.find(user=>user.id===userId)}
function requireManager(actorId:string){if(typeof window!=="undefined"&&window.localStorage.getItem(ADMINISTRATION_JOURNAL_KEY))throw new Error("Recover the interrupted administration change before editing users.");const actor=getAuthenticatedDemoActor(actorId)?.user;if(actor?.status!=="Active"||!hasPermission(actor,"administration.manage_users"))throw new Error("Administration access is required.");return actor!}
/** Legacy profile creation is retired. New factory users use the scoped three-role command. */
export function createAdminUser(input:AdminUserInput,actorId:string):AdminUser|null { requireManager(actorId); void input; throw new Error("New factory users require an explicit Factory Admin assignment. Use scoped Add User; legacy role/permission payloads cannot create people."); }

export function updateAdminUser(id:string,input:AdminUserInput,actorId:string){const actor=requireManager(actorId);load();const current=users.find(user=>user.id===id);if(!current)throw new Error("User not found.");if(current.accessModel==="v3"||input.accessModel)throw new Error("Use scoped administration for v3 profiles.");if(input.status==="Inactive")requireTransferredOwnership(id);if(!input.name.trim())throw new Error("Full name is required.");if(!input.email.trim())throw new Error("User email is required.");if(!input.roles.length)throw new Error("Select a Role.");if(id===actor.id&&(!input.roles.includes("Admin")||!input.permissions.includes("administration.manage_users")||input.status!=="Active"))throw new Error("You cannot remove your own Administration access or deactivate your account.");const ledZone=getOrganizationZones().find((zone)=>zone.leaderId===id);if(ledZone&&(input.status!=="Active"||!input.roles.includes("Zone Leader")||!input.zoneMemberships.some((membership)=>membership.zone===ledZone.name&&membership.responsibility==="Leader")))throw new Error("Change this user's Zone Leader responsibility from Organization > Zones first.");if(users.some(user=>user.id!==id&&user.employeeId.toLowerCase()===input.employeeId.trim().toLowerCase()))throw new Error("Employee ID already exists.");if(users.some(user=>user.id!==id&&user.email.toLowerCase()===input.email.trim().toLowerCase()))throw new Error("Email already exists.");const previous=users;users=users.map(user=>user.id===id?{...user,...input,employeeId:input.employeeId.trim(),name:input.name.trim(),email:input.email.trim(),updatedAt:new Date().toISOString()}:user);if(!emit()){users=previous;return null}return users.find(user=>user.id===id)}
export function setAdminUserActive(id:string,active:boolean,actorId:string){const actor=requireManager(actorId);if(getAdminUser(id)?.accessModel==="v3")throw new Error("Use scoped administration for v3 profiles.");if(id===actor.id&&!active)throw new Error("You cannot deactivate your own Admin account.");if(!active&&getOrganizationZones().some((zone)=>zone.leaderId===id))throw new Error("Reassign this user's Zone Leader responsibility before deactivating the account.");load();if(!getAdminUser(id))throw new Error("User not found.");if(!active)requireTransferredOwnership(id);const previous=users;users=users.map(user=>user.id===id?{...user,status:active?"Active":"Inactive",updatedAt:new Date().toISOString()}:user);if(!emit()){users=previous;return false}return true}

export function setUserZoneMembership(userId:string,zoneName:string|undefined,actorId:string){requireManager(actorId);load();const user=getAdminUser(userId);if(!user)throw new Error("User not found.");if(user.accessModel==="v3")throw new Error("Use scoped administration for v3 profiles.");if(zoneName&&!getOrganizationZone(zoneName))throw new Error("Select a valid Zone.");const ledZone=getOrganizationZones().find((zone)=>zone.leaderId===userId);if(ledZone&&zoneName!==ledZone.name)throw new Error("Change the Zone Leader before moving this user.");const previous=users;users=users.map((item)=>item.id===userId?{...item,zoneMemberships:zoneName?[{zone:zoneName,responsibility:"Member"}]:[],updatedAt:new Date().toISOString()}:item);if(!emit()){users=previous;return false}return true}

export function renameUserPlantAssignments(previousName:string,nextName:string,actorId:string){requireManager(actorId);load();if(previousName===nextName)return true;const previous=users;users=users.map((user)=>user.plant===previousName?{...user,plant:nextName,updatedAt:new Date().toISOString()}:user);if(!emit()){users=previous;return false}return true}

export function assignZoneLeader(zoneId:string,userId:string,actorId:string){requireManager(actorId);load();const zone=getOrganizationZone(zoneId);const nextLeader=getAdminUser(userId);if(!zone)throw new Error("Zone not found.");if(nextLeader?.accessModel==="v3")throw new Error("Use scoped administration for v3 profiles.");if(!nextLeader||nextLeader.status!=="Active")throw new Error("Zone Leader must be an active user.");const otherLeadership=getOrganizationZones().find((item)=>item.id!==zoneId&&item.leaderId===userId);if(otherLeadership)throw new Error(`${nextLeader.name} is already the leader of ${otherLeadership.name}.`);const previousLeaderId=zone.leaderId;const nextUsers=users.map((user)=>{
  if(user.id===userId){const roles=user.roles.includes("Zone Leader")?user.roles:[...user.roles,"Zone Leader" as const];return{...user,plant:ORGANIZATION_PLANT_SEEDS.find((plant)=>plant.id===zone.plantId)?.name??user.plant,roles,permissions:permissionsForRoles(roles),zoneMemberships:[{zone:zone.name,responsibility:"Leader" as const}],updatedAt:new Date().toISOString()}}
  if(user.id===previousLeaderId){const leadsAnother=getOrganizationZones().some((item)=>item.id!==zone.id&&item.leaderId===user.id);const roles=leadsAnother?user.roles:user.roles.filter((role)=>role!=="Zone Leader");return{...user,roles,permissions:permissionsForRoles(roles),zoneMemberships:user.zoneMemberships.map((membership)=>membership.zone===zone.name?{...membership,responsibility:"Member" as const}:membership),updatedAt:new Date().toISOString()}}
  return user;
});const previous=users;users=nextUsers;if(!emit()){users=previous;return false}const saved=saveOrganizationZone({...zone,leaderId:nextLeader.id,leaderName:nextLeader.name});if(!saved){users=previous;emit();return false}return true}

/** Read canonical ownership at mutation time; retain completed and historical records. */
export function getOutstandingUserActions(userId: string) {
  const user = getAdminUser(userId);
  return getActions().filter(action => action.status !== "Completed" && (action.responsiblePersonId ? action.responsiblePersonId === userId : Boolean(user && action.assignedTo === user.name)));
}

function requireTransferredOwnership(userId: string) {
  if (getOutstandingUserActions(userId).length) throw new Error("Transfer outstanding Actions before deactivating this user.");
  if (getOutstandingUserImprovements(userId).length) throw new Error("Transfer outstanding CI ownership before deactivating this user.");
}

/** Refresh only from the existing canonical storage, after an administration transaction. */
export function refreshAdminDirectory() { loaded=false; load(); listeners.forEach(listener=>listener()); }
