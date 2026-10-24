import { deletedRecordRef } from "@/lib/records/record-tombstones";
import type { MyAction } from '@/features/five-s/types/my-actions';
import type { RedTag } from '@/features/five-s/red-tag/types';
import type { ContinuousImprovement } from '@/features/five-s/continuous-improvement/types';
import type { FiveSAudit } from '@/features/five-s/types/five-s';
import type { GembaState } from '@/features/gemba/types';
import type { VisualImprovement } from '@/features/visual-improvement/types';
import type { VisualManagementState } from '@/features/visual-management/types';
import { inferActionSourceModule } from '@/lib/actions/action-config';
import { resolveRecordRoute } from './route-resolver';
import { areRecordRefsEqual, getRecordRefKey } from './utils';
import type { OpsRecordRef, OpsRelationship, OpsRelationshipType } from './types';

export interface CanonicalRecordSummary {
  ref: OpsRecordRef;
  title: string;
  status: string;
  href: string;
  deleted?: boolean;
}
export interface LinkedRecordEntry { record: CanonicalRecordSummary; relationship: OpsRelationshipType; }
export interface IntegrationSnapshot {
  actions: MyAction[]; redTags: RedTag[]; improvements: ContinuousImprovement[];
  audits: FiveSAudit[]; gemba: GembaState; visualImprovements: readonly VisualImprovement[];
  vm: VisualManagementState; relationships: OpsRelationship[];
}
/** Metadata projection only. This graph is never persisted and never runs a lifecycle command. */
export function canonicalRelationshipEdges(s: IntegrationSnapshot): OpsRelationship[] {
  const edges = [...s.relationships];
  function edge(from: OpsRecordRef, to: OpsRecordRef, relationshipType: OpsRelationshipType) {
    if (!edges.some(e => (areRecordRefsEqual(e.from, from) && areRecordRefsEqual(e.to, to)) || (areRecordRefsEqual(e.from, to) && areRecordRefsEqual(e.to, from))))
      edges.push({id:`derived:${getRecordRefKey(from)}:${getRecordRefKey(to)}`,from,to,relationshipType,createdAt:''});
  }
  for (const o of s.gemba.observations) {
    const from: OpsRecordRef = {module:'gemba',recordId:o.gembaId,childId:o.id};
    if(o.actionId) edge(from,{module:'action',recordId:o.actionId},'action');
    if(o.redTagId) edge(from,{module:'redTag',recordId:o.redTagId},'red-tag');
    if(o.improvementId) edge(from,{module:'continuousImprovement',recordId:o.improvementId},'improvement');
  }
  for(const tag of s.redTags) for(const id of new Set([...(tag.actionIds??[]),...(tag.actionId?[tag.actionId]:[])])) edge({module:'redTag',recordId:tag.id},{module:'action',recordId:id},'action');
  for(const item of s.improvements) for(const id of item.actionIds??[]) edge({module:'continuousImprovement',recordId:item.id},{module:'action',recordId:id},'action');
  for(const item of s.visualImprovements) if(item.actionId) edge({module:'visualImprovement',recordId:item.id},{module:'action',recordId:item.actionId},'action');
  for(const audit of s.audits) for(const section of audit.sections??[]) for(const q of section.questions??[]) if(q.actionId) edge({module:'audit',recordId:audit.id},{module:'action',recordId:q.actionId},'action');
  for(const meeting of s.vm.meetings) {
    const from:OpsRecordRef={module:'visualManagement',recordId:meeting.boardId,childId:meeting.id};
    edge({module:'visualManagement',recordId:meeting.boardId},from,'created-from');
    for(const id of meeting.actionIds??[]) edge(from,{module:'action',recordId:id},'action');
    for(const id of meeting.continuousImprovementIds??[]) edge(from,{module:'continuousImprovement',recordId:id},'related');
    for(const id of meeting.gembaIds??[]) edge(from,{module:'gemba',recordId:id},'related');
  }
  for(const topic of s.vm.topics) {
    const meeting=s.vm.meetings.find(m=>m.id===topic.meetingId); if(!meeting)continue;
    const from:OpsRecordRef={module:'visualManagement',recordId:meeting.boardId,childId:meeting.id};
    if(topic.linkedActionId)edge(from,{module:'action',recordId:topic.linkedActionId},'action');
    if(topic.linkedCIId)edge(from,{module:'continuousImprovement',recordId:topic.linkedCIId},'related');
    if(topic.linkedGembaId)edge(from,{module:'gemba',recordId:topic.linkedGembaId},'related');
  }
  for(const action of s.actions) {
    const source=inferActionSourceModule(action);
    const id=source==='audit'?(action.auditId??action.sourceId??action.sourceTitle):(action.sourceId??action.auditId??action.sourceTitle);
    if(source==='manual'||!id) continue;
    let from:OpsRecordRef;
    if(source==='visualManagement') {
      const meeting=s.vm.meetings.find(m=>m.id===(action.visualManagementSource?.meetingId??id));
      const board=s.vm.boards.find(b=>b.id===(action.visualManagementSource?.boardId??id));
      if(!meeting&&!board) continue;
      from=meeting?{module:'visualManagement',recordId:meeting.boardId,childId:meeting.id}:{module:'visualManagement',recordId:board!.id};
    } else from={module:source==='redFlag'&&(s.redTags.some(t=>t.id===id)||deletedRecordRef({module:'redTag',recordId:id}))?'redTag':source,recordId:id,...(source==='gemba'&&action.sourceObservationId?{childId:action.sourceObservationId}:{})};
    edge(from,{module:'action',recordId:action.id},'action');
  }
  return edges;
}

/** Both endpoints must resolve in the caller's authorized canonical catalog. Deleted targets use an anonymous, non-navigable reference; never expose saved labels for denied/missing targets. */
export function resolveLinkedRecordEntries(current:OpsRecordRef, edges:readonly OpsRelationship[], catalog:readonly CanonicalRecordSummary[]) {
  if(!catalog.some(item=>areRecordRefsEqual(item.ref,current))) return {entries:[] as LinkedRecordEntry[],unavailable:false};
  const seen=new Set<string>(), entries:LinkedRecordEntry[]=[];
  let unavailable=false;
  for(const edge of edges) {
    const target=areRecordRefsEqual(edge.from,current)?edge.to:areRecordRefsEqual(edge.to,current)?edge.from:undefined;
    if(!target||areRecordRefsEqual(current,target)) continue;
    const key=getRecordRefKey(target); if(seen.has(key))continue; seen.add(key);
    const record=catalog.find(item=>areRecordRefsEqual(item.ref,target));
    if(record) entries.push({record,relationship:edge.relationshipType});
    else if (deletedRecordRef(target)) entries.push({ record: { ref: target, title: target.module === "action" ? "Action deleted" : "Source deleted", status: "Deleted", href: "", deleted: true }, relationship: edge.relationshipType });
    else unavailable=true;
  }
  return {entries,unavailable};
}
export function recordInOrganizationScope(record:{plant?:string;organizationId?:string}, organizationId:string, plant:string) {
  return (!record.organizationId||record.organizationId===organizationId) && Boolean(record.plant && (plant==='All organizations'||record.plant===plant));
}
export function canonicalSummary(ref:OpsRecordRef,title:string,status:string,href=resolveRecordRoute(ref)):CanonicalRecordSummary|undefined {
  return href?{ref,title,status,href}:undefined;
}
