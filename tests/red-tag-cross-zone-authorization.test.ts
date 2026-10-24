import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateDemoFixture } from './helpers/demo-session';
let values: Map<string,string>;
beforeEach(() => {
 vi.resetModules(); values=new Map([['ops-red-tag-original-reset-v1','done'],['unrelated','preserved']]);
 vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)},alert:vi.fn()});
 authenticateDemoFixture();
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(){
 const identity=await import('@/lib/current-user');const directory=await import('@/features/five-s/administration/store');const organization=await import('@/lib/organization-store');
 const actor=identity.DEMO_USERS.auditor,reviewer=identity.DEMO_USERS.leader;
 const user=directory.getAdminUser(actor.id)!;
 user.roles=['Auditor','Zone Leader'];user.zoneMemberships=[{zone:'Zone A',responsibility:'Leader'},{zone:'Zone B',responsibility:'Member'}];
 const store=await import('@/features/five-s/red-tag/store');store.getRedTags();
 const access=await import('@/features/five-s/red-tag/access');
 const input={plant:'Egmore Plant',zone:'Zone B',section:'Production',department:'Production',itemName:'Cross-zone fixture',reason:'Unused' as const,reasonCategory:'Usage' as const,remarks:'Inspect condition',imageUrl:'/demo-5s/not-good-example.png',createdById:actor.id,createdByName:'Spoofed name'};
 return {identity,directory,organization,actor,reviewer,user,store,access,input};
}
describe('Red Tag cross-zone creation and evaluator separation',()=>{
 it('denies all three own-zone creation commands without writes, allocation or history',async()=>{
  const m=await setup();const before=JSON.stringify([...values]);const write=vi.spyOn(window.localStorage,'setItem');
  expect(m.store.createRedTagV2({...m.input,zone:'Zone A'},m.actor)).toBeUndefined();
  expect(m.store.createAndSubmitRedTagV2({...m.input,zone:'Zone A'},m.actor,m.actor)).toBeUndefined();
  expect(()=>m.store.createRedTag({...m.input,zone:'Zone A'},m.actor)).toThrow();
  expect(write).not.toHaveBeenCalled();expect(JSON.stringify([...values])).toBe(before);
  const created=m.store.createAndSubmitRedTagV2(m.input,m.actor,m.reviewer)!;
  expect(created).toMatchObject({id:'RT-000001',status:'Under Review',createdByName:m.user.name,review:{reviewerId:m.reviewer.id}});
 });
 it('permits cross-zone creation only with existing access, and only the target leader evaluates',async()=>{
  const m=await setup();m.user.zoneMemberships=m.user.zoneMemberships.filter(item=>item.zone!=='Zone B');
  expect(m.store.createAndSubmitRedTagV2(m.input,m.actor,m.reviewer)).toBeUndefined();
  m.user.zoneMemberships.push({zone:'Zone B',responsibility:'Member'});
  const tag=m.store.createAndSubmitRedTagV2(m.input,m.actor,m.reviewer)!;
  expect(m.store.recordRedTagDecision(tag.id,{decision:'relocate'},m.actor)).toBeUndefined();
  m.identity.setDemoRole('leader');
  expect(m.store.recordRedTagDecision(tag.id,{decision:'relocate'},m.reviewer)?.decisionRecord?.decidedByUserId).toBe(m.reviewer.id);
 });
 it('denies every canonical leadership Zone including ID aliases and multiple assignments',async()=>{
  const m=await setup();const zone=m.organization.getOrganizationZone('Zone B')!;
  m.user.zoneMemberships.push({zone:zone.id,responsibility:'Leader'});
  expect(m.access.isRedTagOwnLeaderZone(m.user,'Zone A')).toBe(true);
  expect(m.access.isRedTagOwnLeaderZone(m.user,zone.id)).toBe(true);
  expect(m.store.createRedTagV2({...m.input,zone:zone.id},m.actor)).toBeUndefined();
 });
 it('preserves ordinary member and Admin creation without leadership assignments',async()=>{
  const m=await setup();m.identity.setDemoRole('responsible');
  const member=m.directory.getAdminUser(m.identity.DEMO_USERS.responsible.id)!;
  expect(m.store.createRedTagV2(m.input,m.identity.DEMO_USERS.responsible)).toBeDefined();
  m.identity.setDemoRole('auditor');m.user.roles=['Admin'];m.user.zoneMemberships=[{zone:'Zone B',responsibility:'Member'}];
  expect(m.store.createRedTagV2(m.input,m.actor)).toBeDefined();expect(member.roles).not.toContain('Zone Leader');
 });
 it('rejects unauthenticated, unknown, impersonated and stale-session actors',async()=>{
  const m=await setup();const before=JSON.stringify([...values]);
  expect(m.store.createRedTagV2(m.input,{...m.actor,id:'unknown'})).toBeUndefined();
  expect(m.store.createRedTagV2(m.input,m.reviewer)).toBeUndefined();
  values.delete('5s-auth-session');expect(m.store.createRedTagV2(m.input,m.actor)).toBeUndefined();
  authenticateDemoFixture();values.set('five-s-demo-role','leader');expect(m.store.createRedTagV2(m.input,m.actor)).toBeUndefined();
  values.delete('five-s-demo-role');expect(JSON.stringify([...values])).toBe(before);
 });
 it('rejects foreign plant/organization and caller-selected or inactive reviewers before allocating',async()=>{
  const m=await setup();const before=JSON.stringify([...values]);
  expect(m.store.createRedTagV2({...m.input,plant:'Foreign plant'},m.actor)).toBeUndefined();
  const foreignInput={...m.input,organizationId:"foreign"};
  expect(m.store.createRedTagV2(foreignInput,m.actor)).toBeUndefined();
  expect(m.store.createAndSubmitRedTagV2(m.input,m.actor,m.actor)).toBeUndefined();
  m.directory.getAdminUser(m.reviewer.id)!.status='Inactive';
  expect(m.store.createAndSubmitRedTagV2(m.input,m.actor,m.reviewer)).toBeUndefined();
  expect(m.access.getRedTagCreationError(m.user,m.input.plant,m.input.zone)).toContain('active authorized');
  expect(JSON.stringify([...values])).toBe(before);
 });
 it('preserves historical records and rejects creator Keep/evaluation even if reviewer metadata names them',async()=>{
  const m=await setup();const historical={...m.store.getRedTags()[0],id:'RT-LEGACY',createdById:m.reviewer.id,zone:'Zone B',status:'Under Review' as const,review:{reviewerId:m.reviewer.id,reviewerName:m.reviewer.name,submittedAt:'2026-01-01'}};
  values.set(m.store.RED_TAG_STORAGE_KEY,JSON.stringify([historical]));vi.resetModules();
  const identity=await import('@/lib/current-user');identity.setDemoRole('leader');const store=await import('@/features/five-s/red-tag/store');const before=values.get(store.RED_TAG_STORAGE_KEY);
  expect(store.getRedTag(historical.id)).toMatchObject({id:historical.id,createdById:m.reviewer.id});
  expect(store.recordRedTagDecision(historical.id,{decision:'relocate'},m.reviewer)).toBeUndefined();
  expect(store.confirmRedTagKeep(historical.id,'Keep own tag',m.reviewer)).toBeUndefined();
  expect(values.get(store.RED_TAG_STORAGE_KEY)).toBe(before);
 });
 it('enforces actual Gemba target scope without allocation or source links on rejected creation',async()=>{
  const m=await setup();const gemba=await import('@/features/gemba/gemba-store');
  const walk=gemba.getGembaState().walks.find(item=>item.id==='GEM-2026-015')!;
  const observation=gemba.saveGembaObservation(walk.id,{type:'Issue',title:'Cross-zone source',description:'Physical item',location:'Office',peopleInvolved:[],evidence:[{id:'SOURCE',name:'before.png',url:m.input.imageUrl,uploadedAt:'2026-10-19',uploadedBy:m.actor.name}]},m.actor)!;
  const commands=await import('@/lib/gemba/gemba-integration');
  const relationships=await import('@/lib/relationships/relationship-store');relationships.getOutgoingRelationships({module:'gemba',recordId:walk.id,childId:observation.id});
  const before=JSON.stringify([...values]);const reserved=vi.fn();
  await expect(commands.createRedTagFromGemba(walk.id,observation.id,{...m.input,zone:'Zone A'},m.actor,reserved)).rejects.toThrow('assigned Zone');
  expect(JSON.stringify([...values])).toBe(before);expect(reserved).not.toHaveBeenCalled();expect(observation.redTagId).toBeUndefined();
  gemba.getGembaState().walks.find(item=>item.id===walk.id)!.zone='Zone B';
  values.set('ops-gemba-v1',JSON.stringify(gemba.getGembaState()));
  await expect(commands.createRedTagFromGemba(walk.id,observation.id,{...m.input,zone:'Zone A'},m.actor,reserved)).rejects.toThrow('target must match');
  const tag=await commands.createRedTagFromGemba(walk.id,observation.id,m.input,m.actor,reserved);
  expect(tag).toMatchObject({id:'RT-000001',zone:'Zone B',status:'Under Review',review:{reviewerId:m.reviewer.id}});
  expect(gemba.getGembaState().observations.find(item=>item.id===observation.id)!.redTagId).toBe(tag.id);
  expect((await commands.createRedTagFromGemba(walk.id,observation.id,m.input,m.actor,reserved)).id).toBe(tag.id);
  expect(values.get('unrelated')).toBe('preserved');
 });

 it('preserves target-leader submission of an existing tag raised by a different member',async()=>{
  const m=await setup();m.identity.setDemoRole('responsible');const creator=m.identity.DEMO_USERS.responsible;
  const tag=m.store.createRedTagV2(m.input,creator)!;m.identity.setDemoRole('leader');
  expect(m.store.submitRedTagForReview(tag.id,{reviewerId:m.reviewer.id,reviewerName:'Untrusted'},m.reviewer)?.review?.reviewerName).toBe(m.reviewer.name);
  expect(m.store.confirmRedTagKeep(tag.id,'Retain inspected reference',m.reviewer)?.status).toBe('Closed');
 });
 it('rejects disabled entitlements and missing target leadership without reserving IDs',async()=>{
  const m=await setup();const entitlements=await import('@/lib/module-entitlements');m.identity.setDemoRole('superAdmin');
  entitlements.saveFactoryAccess(entitlements.DEMO_ORGANIZATION.id,"PLANT-EGM",{...entitlements.getOrganizationAccess(),redTag:false});m.identity.setDemoRole('auditor');
  const before=JSON.stringify([...values]);expect(m.store.createRedTagV2(m.input,m.actor)).toBeUndefined();expect(JSON.stringify([...values])).toBe(before);
  m.identity.setDemoRole('superAdmin');entitlements.saveFactoryAccess(entitlements.DEMO_ORGANIZATION.id,"PLANT-EGM",{...entitlements.getOrganizationAccess(),redTag:true});m.identity.setDemoRole('auditor');
  m.organization.getOrganizationZone('Zone B')!.leaderId='';
  const missing=JSON.stringify([...values]);expect(m.store.createAndSubmitRedTagV2(m.input,m.actor,m.reviewer)).toBeUndefined();expect(JSON.stringify([...values])).toBe(missing);
 });

});
