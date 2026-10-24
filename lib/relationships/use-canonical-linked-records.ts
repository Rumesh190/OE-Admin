'use client';
import { readDeletionActions, getRecordTombstone } from '@/lib/records/record-tombstones';
import { useActionStore } from '@/lib/actions/action-store';
import { getRoleVisibleActions } from '@/features/actions/action-center-data';
import { useCurrentUser } from '@/lib/current-user';
import { useAdminUsers } from '@/features/five-s/administration/store';
import { hasPermission } from '@/features/five-s/administration/permissions';
import { useModuleEntitlements, DEMO_ORGANIZATION } from '@/lib/module-entitlements';
import { useOrganizationConfiguration } from '@/lib/organization-store';
import { useRedTags } from '@/features/five-s/red-tag/store';
import { canAccessRedTagZone } from '@/features/five-s/red-tag/access';
import { useImprovements } from '@/features/five-s/continuous-improvement/store';
import { canViewImprovement } from '@/features/five-s/continuous-improvement/access';
import { useGembaStore } from '@/features/gemba/gemba-store';
import { canViewGembaWalk } from '@/features/gemba/gemba-access';
import { useFiveSAuditStore } from '@/lib/five-s/audit-store';
import { useVisualImprovements } from '@/features/visual-improvement/visual-improvement-store';
import { canViewVisualImprovement } from '@/features/visual-improvement/visual-improvement-access';
import { useVisualManagementStore } from '@/features/visual-management/visual-management-store';
import { canViewVisualManagementBoard, canViewVisualManagementMeeting } from '@/features/visual-management/visual-management-access';
import { useRelationships } from './relationship-store';
import { canonicalRelationshipEdges, canonicalSummary, recordInOrganizationScope, resolveLinkedRecordEntries, type CanonicalRecordSummary } from './canonical-records';
import type { OpsRecordRef } from './types';

/** Existing browser-demo access checks only. No new authorization or relationship persistence. */
export function useCanonicalLinkedRecords(current:OpsRecordRef) {
  const actions=useActionStore(), redTags=useRedTags(), improvements=useImprovements(), gemba=useGembaStore();
  const audits=useFiveSAuditStore(), visualImprovements=useVisualImprovements(), vm=useVisualManagementStore();
  const relationships=useRelationships(), actor=useCurrentUser(), users=useAdminUsers(), access=useModuleEntitlements();
  useOrganizationConfiguration();
  const admin=users.find(u=>u.id===actor.id);
  const catalog:CanonicalRecordSummary[]=[];
  function add(ref:OpsRecordRef,title:string,status:string,href?:string) {const item=canonicalSummary(ref,title,status,href);if(item)catalog.push(item);}
  const scoped=(item:{plant?:string;organizationId?:string})=>admin?.status==='Active'&&recordInOrganizationScope(item,DEMO_ORGANIZATION.id,admin.plant);
  if(access.actions) for(const a of getRoleVisibleActions(actions,actor,admin)) if(scoped(a)) add({module:'action',recordId:a.id},a.title,a.status);
  if(access.redTag) for(const t of redTags) if(scoped(t)&&canAccessRedTagZone(admin,t.plant,t.zone)) add({module:'redTag',recordId:t.id},t.itemName,t.status);
  if(access.continuousImprovement) for(const i of improvements) if(scoped(i)&&canViewImprovement(admin,actor,i)) add({module:'continuousImprovement',recordId:i.id},i.title,i.status);
  if(access.visualImprovement) for(const i of visualImprovements) if(scoped(i)&&canViewVisualImprovement(admin,actor,i)) add({module:'visualImprovement',recordId:i.id},i.title,i.status);
  if(access.gemba) for(const w of gemba.walks) if(scoped(w)&&canViewGembaWalk(w,actor,admin?.roles)) {
    add({module:'gemba',recordId:w.id},w.purpose,w.status);
    for(const o of gemba.observations.filter(o=>o.gembaId===w.id)) add({module:'gemba',recordId:w.id,childId:o.id},o.title,o.type);
  }
  if(access.audit&&admin&&hasPermission(admin,'audits.view')) for(const a of audits) if(scoped(a)&&(admin.roles.includes('Admin')||admin.roles.includes('Auditor')||a.area===actor.primaryZone)) { add({module:'audit',recordId:a.id},a.title,a.status); for(const section of a.sections??[]) for(const q of section.questions??[]) add({module:'audit',recordId:a.id,childId:q.id},q.question,q.status); }
  if(access.visualManagement) {
    for(const b of vm.boards) if(scoped(b)&&canViewVisualManagementBoard(b,actor,admin?.roles)) add({module:'visualManagement',recordId:b.id},b.name,b.status);
    for(const m of vm.meetings) if(scoped(m)&&canViewVisualManagementMeeting(m,vm.boards,actor,admin?.roles)) add({module:'visualManagement',recordId:m.boardId,childId:m.id},m.boardName??vm.boards.find(b=>b.id===m.boardId)?.name??m.id,m.status,`/visual-management/meetings/${encodeURIComponent(m.id)}`);
  }
  // Exclude foreign-organization/plant canonical rows before deriving edges, not just before rendering titles.
  const scopedWalks=gemba.walks.filter(scoped), walkIds=new Set(scopedWalks.map(w=>w.id));
  const edges=canonicalRelationshipEdges({actions:[...actions, ...readDeletionActions().filter(action => getRecordTombstone("action", action.id))].filter(scoped),redTags:redTags.filter(scoped),improvements:improvements.filter(scoped),audits:audits.filter(scoped),visualImprovements:visualImprovements.filter(scoped),gemba:{walks:scopedWalks,observations:gemba.observations.filter(o=>walkIds.has(o.gembaId))},vm:{...vm,boards:vm.boards.filter(scoped),meetings:vm.meetings.filter(scoped)},relationships:relationships.filter(r=>!r.metadata?.organizationId||r.metadata.organizationId===DEMO_ORGANIZATION.id)});
  return resolveLinkedRecordEntries(current,edges,catalog);
}
