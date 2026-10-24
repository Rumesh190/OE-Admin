import { authenticateDemoFixture } from "./helpers/demo-session";
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalRelationshipEdges, canonicalSummary, recordInOrganizationScope, resolveLinkedRecordEntries, type IntegrationSnapshot } from '@/lib/relationships/canonical-records';
import type { OpsRecordRef } from '@/lib/relationships/types';

let values:Map<string,string>;
beforeEach(()=>{vi.resetModules();values=new Map([['ops-red-tag-original-reset-v1','done']]);const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>values.delete(k)};vi.stubGlobal('navigator',{});vi.stubGlobal('window',{localStorage:storage}); authenticateDemoFixture();vi.stubGlobal('localStorage',storage);});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const rt:OpsRecordRef={module:'redTag',recordId:'RT-000001'},obs:OpsRecordRef={module:'gemba',recordId:'GW-000001',childId:'GW-000001-OBS-01'},act:OpsRecordRef={module:'action',recordId:'ACT-000001'};
async function snapshot():Promise<IntegrationSnapshot>{
 const {GEMBA_SEED_STATE}=await import('@/features/gemba/gemba-store');
 const {CONTINUOUS_IMPROVEMENT_SEED_RECORDS}=await import('@/features/five-s/continuous-improvement/store');
 return {actions:[],redTags:[],improvements:structuredClone([...CONTINUOUS_IMPROVEMENT_SEED_RECORDS]),audits:[],gemba:structuredClone(GEMBA_SEED_STATE),visualImprovements:[],vm:{boards:[],meetings:[],topics:[],decisions:[],escalations:[]},relationships:[]};
}
describe('canonical Linked Records projection',()=>{
 it('discovers direct historical Gemba relationships without migrating IDs or storing copies',async()=>{
  const s=await snapshot();const o=s.gemba.observations[0];o.redTagId='RT-EGM-ZB-007';
  const edge=canonicalRelationshipEdges(s).find(e=>e.from.childId===o.id&&e.to.module==='redTag')!;
  expect(edge.to.recordId).toBe('RT-EGM-ZB-007');expect(edge.from.recordId).toBe(o.gembaId);
  const source=canonicalSummary(edge.from,o.title,o.type)!,target=canonicalSummary(edge.to,'Original item','Under Review')!;
  expect(resolveLinkedRecordEntries(edge.to,[edge],[source,target]).entries[0].record.href).toContain(`?tab=observations#${o.id}`);
  expect(resolveLinkedRecordEntries(edge.from,[edge],[source,target]).entries[0].record.title).toBe('Original item');
 });
 it('deduplicates reciprocal metadata and canonical source edges while retaining multiple independent Actions',async()=>{
  const s=await snapshot();const tag={id:rt.recordId,actionIds:[act.recordId,'ACT-000002'],actionId:act.recordId} as IntegrationSnapshot['redTags'][number];s.redTags=[tag];
  const edges=canonicalRelationshipEdges(s);const records=[canonicalSummary(rt,'Item','Decision Made')!,canonicalSummary(act,'One','Rework Required')!,canonicalSummary({module:'action',recordId:'ACT-000002'},'Two','Completed')!];
  const duplicate={...edges.find(e=>e.from.module==='redTag')!,id:'legacy-reciprocal',from:act,to:rt};
  const result=resolveLinkedRecordEntries(rt,[...edges,duplicate],records);
  expect(result.entries.map(e=>e.record.status)).toEqual(['Rework Required','Completed']);expect(result.entries).toHaveLength(2);
  expect(resolveLinkedRecordEntries(act,edges,records).entries[0].record.ref).toEqual(rt);
 });
 it('does not expose saved titles, IDs or links for missing/inaccessible targets',()=>{
  const edges=[{id:'rel',from:obs,to:rt,relationshipType:'red-tag' as const,createdAt:'2026-01-01',metadata:{title:'Private title'}}];
  const result=resolveLinkedRecordEntries(obs,edges,[canonicalSummary(obs,'Allowed source','Issue')!]);
  expect(result).toEqual({entries:[],unavailable:true});expect(JSON.stringify(result)).not.toContain('Private title');
  expect(resolveLinkedRecordEntries(obs,edges,[])).toEqual({entries:[],unavailable:false});
 });
 it('uses explicit organization and plant scope without parsing Zone or organization from IDs',()=>{
  expect(recordInOrganizationScope({plant:'Egmore Plant',organizationId:'xyz-components'},'abc-manufacturing','Egmore Plant')).toBe(false);
  expect(recordInOrganizationScope({plant:'Other Plant'},'abc-manufacturing','Egmore Plant')).toBe(false);
  expect(recordInOrganizationScope({plant:'Egmore Plant'},'abc-manufacturing','Egmore Plant')).toBe(true);
 });
 it('preserves the authoritative legacy Audit ID when an Action also carries a historical display source',async()=>{
  const s=await snapshot(),{MY_ACTIONS}=await import('@/features/five-s/data/my-actions-data');
  s.actions=[{...structuredClone(MY_ACTIONS[0]),id:'ACT-AUD-OLD',source:'5S Audit',sourceModule:'audit',sourceId:'Legacy display title',auditId:'AUDIT-OLD-42'}];
  expect(canonicalRelationshipEdges(s).find(e=>e.to.recordId==='ACT-AUD-OLD')?.from).toEqual({module:'audit',recordId:'AUDIT-OLD-42'});
 });
 it('routes sequential VM meetings by canonical identity rather than interpreting a VM ID as a board',async()=>{
  const s=await snapshot();s.vm.meetings=[{id:'VM-000002',boardId:'VM-000001',actionIds:[],continuousImprovementIds:[],gembaIds:[]} as unknown as IntegrationSnapshot['vm']['meetings'][number]];
  const edge=canonicalRelationshipEdges(s).find(e=>e.from.module==='visualManagement'&&e.to.childId==='VM-000002')!;expect(edge.to).toEqual({module:'visualManagement',recordId:'VM-000001',childId:'VM-000002'});
  expect(canonicalSummary(edge.to,'Meeting','Completed','/visual-management/meetings/VM-000002')!.href).toBe('/visual-management/meetings/VM-000002');
 });
});

async function setup(type:'Issue'|'Opportunity') {
 const g=await import('@/features/gemba/gemba-store'),identity=await import('@/lib/current-user');const actor=identity.getCurrentDemoUser();
 const directory=await import('@/features/five-s/administration/store');const creator=directory.getAdminUser(actor.id)!;creator.roles=['Admin','Auditor'];
 const org=await import('@/lib/organization-store');const reviewer=directory.getAdminUser('USR-RUMESH')!;reviewer.zoneMemberships.push({zone:'Zone A',responsibility:'Leader'});org.getOrganizationZone('Zone A')!.leaderId=reviewer.id;
 const observation=g.saveGembaObservation('GEM-2026-015',{type,title:'Synthetic source',description:'Source description',location:'Office',peopleInvolved:[],evidence:type==='Issue'?[{id:'EV-1',name:'before.png',url:'/demo-5s/not-good-example.png',uploadedAt:'2026-01-01',uploadedBy:actor.name}]:[]},actor)!;
 expect(observation).toBeTruthy();return {g,actor,observation,commands:await import('@/lib/gemba/gemba-integration')};
}
describe('real Gemba creation and durable links',()=>{
 it('transfers available source photos without persisting unsafe URLs or making optional CI photos mandatory',async()=>{
  const {transferAvailableGembaEvidence}=await import('@/lib/gemba/gemba-integration');
  const photos=[{id:'one',name:'good.png',url:'/demo-5s/good-example.png',uploadedAt:'2026-01-01',uploadedBy:'Actor'},{id:'two',name:'missing.png',url:'javascript:alert(1)',uploadedAt:'2026-01-01',uploadedBy:'Actor'}];const original=structuredClone(photos);
  const transfer=await transferAvailableGembaEvidence(photos);expect(transfer.available).toHaveLength(1);expect(transfer.available[0].url).toBe('/demo-5s/good-example.png');expect(transfer.unavailable).toEqual(['missing.png']);expect(photos).toEqual(original);
 });
 it('creates one reviewed Phase 2 Red Tag with source fields and reciprocal reload discovery; never creates an Action',async()=>{
  const {g,actor,observation,commands}=await setup('Issue');const actions=await import('@/lib/actions/action-store');const before=actions.getActions().length;
  const input={plant:'Egmore Plant',zone:'Zone A',section:observation.location,department:'Office',itemName:observation.title,remarks:observation.description,reasonCategory:'Usage' as const,reason:'Damaged' as const,imageUrl:observation.evidence[0].url!,createdById:actor.id,createdByName:actor.name};
  const tag=await commands.createRedTagFromGemba(observation.gembaId,observation.id,input,actor,()=>{});
  expect(tag.id).toBe('RT-000001');expect(tag.status).toBe('Under Review');expect(tag.review?.reviewerId).toBe('USR-RUMESH');expect(tag.itemName).toBe(observation.title);expect(tag.department).toBe('Office');expect(tag.actionId).toBeUndefined();expect(actions.getActions()).toHaveLength(before);
  const again=await commands.createRedTagFromGemba(observation.gembaId,observation.id,input,actor,()=>{});expect(again.id).toBe(tag.id);
  expect(g.getGembaState().observations.find(o=>o.id===observation.id)?.redTagId).toBe(tag.id);
  vi.resetModules();const reloaded=await import('@/features/five-s/red-tag/store');expect(reloaded.getRedTag(tag.id)?.status).toBe('Under Review');
  const r=await import('@/lib/relationships/relationship-store');expect(r.getIncomingRelationships({module:'redTag',recordId:tag.id})).toHaveLength(1);
 });
 it('preserves the created Red Tag ID across source write failure and retry without duplicating creation or history',async()=>{
  const {actor,observation,commands}=await setup('Issue');const input={plant:'Egmore Plant',zone:'Zone A',section:'Office',department:'Office',itemName:'Item',remarks:'Condition',reasonCategory:'Usage' as const,reason:'Damaged' as const,imageUrl:'/before.png',createdById:actor.id,createdByName:actor.name};let reserved='';
  const real=window.localStorage.setItem.bind(window.localStorage);let failed=false;
  vi.spyOn(window.localStorage,'setItem').mockImplementation((k,v)=>{if(k==='ops-gemba-v1'&&!failed){failed=true;throw new Error('Synthetic source write failure')}real(k,v)});
  await expect(commands.createRedTagFromGemba(observation.gembaId,observation.id,input,actor,id=>reserved=id)).rejects.toThrow('source link could not be saved');expect(reserved).toBe('RT-000001');
  vi.resetModules();const recovered=await import('@/lib/gemba/gemba-integration');
  await setup('Issue');
  const tag=await recovered.createRedTagFromGemba(observation.gembaId,observation.id,input,actor,()=>{});expect(tag.id).toBe(reserved);expect(tag.history.filter(e=>e.type==='created')).toHaveLength(1);
 });
 it('creates one CI using its existing approval workflow and never duplicates on retry',async()=>{
  const {actor,observation,commands}=await setup('Opportunity');
  const input={plant:'Egmore Plant',zone:'Zone A',title:observation.title,issueDescription:observation.description,proposedImprovement:'Organize work',expectedBenefit:'Less motion',benefitType:'Other' as const,estimatedTime:5,estimatedTimeUnit:'Days' as const,ownerId:'USR-RITIKA',memberIds:[],beforeEvidence:[]};
  const item=await commands.createImprovementFromGemba(observation.gembaId,observation.id,input,actor,()=>{});
  expect(item.id).toBe('CI-000001');expect(item.status).toBe('submitted');expect(item.actionIds).toEqual([]);expect(item.issueDescription).toBe(observation.description);
  expect((await commands.createImprovementFromGemba(observation.gembaId,observation.id,input,actor,()=>{})).id).toBe(item.id);
  const r=await import('@/lib/relationships/relationship-store');expect(r.getIncomingRelationships({module:'continuousImprovement',recordId:item.id})).toHaveLength(1);
 });
 it('rejects creation when the target CI module is disabled',async()=>{
  const {actor,observation,commands}=await setup('Opportunity');const modules=await import('@/lib/module-entitlements');const identity=await import('@/lib/current-user');identity.setDemoRole('superAdmin');expect(modules.saveFactoryAccess(modules.DEMO_ORGANIZATION.id,"PLANT-EGM",{...modules.getOrganizationAccess(),continuousImprovement:false})).toBe(true);identity.setDemoRole('auditor');
  await expect(commands.createImprovementFromGemba(observation.gembaId,observation.id,{title:'Title',issueDescription:'Context',estimatedTime:1,estimatedTimeUnit:'Days',ownerId:'USR-RITIKA',memberIds:[]},actor,()=>{})).rejects.toThrow('cannot create');
  expect([...values.keys()].some(k=>k.includes('record-sequence'))).toBe(false);
 });
 it('rejects wrong branches, unknown actors, completed walks and unavailable linked records without allocating',async()=>{
  const {g,actor,observation,commands}=await setup('Opportunity');const input={plant:'Egmore Plant',zone:'Zone A',section:'Office',department:'Office',itemName:'Item',remarks:'Condition',reason:'Damaged' as const,imageUrl:'/before.png',createdById:actor.id,createdByName:actor.name};
  await expect(commands.createRedTagFromGemba(observation.gembaId,observation.id,input,actor,()=>{})).rejects.toThrow('cannot create');
  await expect(commands.createRedTagFromGemba(observation.gembaId,observation.id,input,{...actor,id:'unknown'},()=>{})).rejects.toThrow('cannot create');
  const issue=g.saveGembaObservation('GEM-2026-015',{type:'Issue',title:'Other issue',description:'Context',location:'Office',peopleInvolved:[],evidence:[{id:'EV-2',name:'before.png',url:'/before.png',uploadedAt:'2026-01-01',uploadedBy:actor.name}]},actor)!;
  await expect(commands.createRedTagFromGemba(issue.gembaId,issue.id,input,{...actor,id:'unknown'},()=>{})).rejects.toThrow('cannot create');
  const state=structuredClone(g.getGembaState());state.observations.find(o=>o.id===issue.id)!.redTagId='RT-missing';values.set('ops-gemba-v1',JSON.stringify(state));
  await expect(commands.createRedTagFromGemba(issue.gembaId,issue.id,input,actor,()=>{})).rejects.toThrow('unavailable');
  state.walks.find(w=>w.id===issue.gembaId)!.status='Completed';values.set('ops-gemba-v1',JSON.stringify(state));
  await expect(commands.createRedTagFromGemba(issue.gembaId,issue.id,input,actor,()=>{})).rejects.toThrow('cannot create');
  expect([...values.keys()].some(k=>k.includes('record-sequence'))).toBe(false);
  expect(g.getGembaState().observations.find(o=>o.id===observation.id)?.redTagId).toBeUndefined();
 });
});
