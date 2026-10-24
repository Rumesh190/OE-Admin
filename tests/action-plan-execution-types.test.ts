import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {authenticateDemoFixture} from './helpers/demo-session';
let values:Map<string,string>;
beforeEach(()=>{
 vi.resetModules();values=new Map([['ops-red-tag-original-reset-v1','done'],['ops-organization-modules-v1',JSON.stringify({'abc-manufacturing':{visualImprovement:true,redFlag:true}})]]);
 vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)},alert:vi.fn()});authenticateDemoFixture();
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(){
 const identity=await import('@/lib/current-user');const audits=await import('@/lib/five-s/audit-store');const actions=await import('@/lib/actions/action-store');const linked=await import('@/features/actions/create-linked-action-dialog');
 const auditor=identity.DEMO_USERS.auditor,leader=identity.DEMO_USERS.leader,member=identity.DEMO_USERS.responsible;
 const audit=audits.createFiveSAudit({title:'Action plan fixture',plant:'Egmore Plant',area:'Zone B',department:'Production',auditor:auditor.name,dueDate:'2030-12-20',sections:[{category:'Sort',description:'Sort',score:0,maxScore:2,questions:[{id:'PLAN-Q',category:'Sort',question:'Is the area ready?',score:0,maxScore:2,status:'Fail',observation:'Stored items block the aisle',evidence:[],actionRequired:true}]}]});
 const context: import('@/features/actions/create-linked-action-dialog').LinkedActionContext={source:'Audit',sourceModule:'audit',sourceId:audit.id,sourceTitle:audit.title,sourceObservationId:'PLAN-Q',sourceObservation:'Stored items block the aisle',title:'Clear aisle',description:'Move the stored items',plant:audit.plant,zone:audit.area,location:'Production',evidence:[{id:'INITIAL',name:'initial.jpg',type:'image',url:'data:image/jpeg;base64,initial',uploadedAt:'2026-10-19',uploadedBy:auditor.name}],requiresEvidence:true,defaultDueDate:'2030-12-20',auditQuestion:{auditId:audit.id,questionId:'PLAN-Q',questionText:'Is the area ready?',questionSource:'standard',sectionId:'Sort',category:'Sort'}};
 const create=(ownerId:string=leader.id)=>linked.createCanonicalLinkedAction(context,ownerId,auditor,'Safety','Medium','2030-12-20');
 return {identity,audits,actions,linked,auditor,leader,member,audit,context,create};
}
const completion={id:'AFTER',name:'after.jpg',type:'image' as const,url:'data:image/jpeg;base64,after',uploadedAt:'2026-10-19',uploadedBy:'Owner'};
describe('shared Action Plan creation and execution types',()=>{
 it('creates assigned Audit Actions with editable details, real leader ownership and canonical question/evidence links',async()=>{
  const m=await setup();m.context.title='Edited action title';m.context.description='Edited execution instructions';
  expect(m.linked.getEligibleLinkedActionMembers(m.context)).toContainEqual(expect.objectContaining({id:m.leader.id}));
  const action=m.create();expect(action).toMatchObject({status:'Assigned',title:m.context.title,description:m.context.description,responsiblePersonId:m.leader.id,responsiblePersonName:m.leader.name,assignedByUserId:m.auditor.id,sourceModule:'audit',sourceId:m.audit.id,auditId:m.audit.id,questionId:'PLAN-Q',sourceObservationId:'PLAN-Q',sourceObservation:'Stored items block the aisle',issueEvidence:m.context.evidence});
  expect(m.audits.linkAuditQuestionAction(m.audit.id,'PLAN-Q',action.id,m.auditor)).toBe(true);
  expect(m.audits.getFiveSAuditById(m.audit.id)!.sections[0].questions[0]).toMatchObject({score:0,question:'Is the area ready?',actionId:action.id,evidence:[expect.objectContaining({id:'INITIAL'})]});
  vi.resetModules();expect((await import('@/lib/actions/action-store')).getActionById(action.id)).toMatchObject({responsiblePersonId:m.leader.id,sourceId:m.audit.id});
  expect((await import('@/lib/five-s/audit-store')).getFiveSAuditById(m.audit.id)!.sections[0].questions[0].actionId).toBe(action.id);
 });
 it('allows the auditor to choose an eligible member instead of the leader',async()=>{
  const m=await setup();expect(m.create(m.member.id)).toMatchObject({status:'Assigned',responsiblePersonId:m.member.id});
 });
 it('requires a title, description and required finding evidence before creating',async()=>{
  const m=await setup();const before=values.get('standalone-5s-actions');
  for(const patch of [{title:'  '},{description:'  '},{evidence:[]}]) expect(()=>m.linked.createCanonicalLinkedAction({...m.context,...patch},m.leader.id,m.auditor,'Safety','Medium','2030-12-20')).toThrow();
  expect(values.get('standalone-5s-actions')).toBe(before);
 });
 it('requires explicit type selection and rejects strangers and duplicate starts without extra history',async()=>{
  const m=await setup();const action=m.create();const before=values.get('standalone-5s-actions');
  expect(m.actions.startAssignedAction(action.id,m.leader)).toBeUndefined();
  expect(m.actions.startAssignedAction(action.id,m.member,'immediate')).toBeUndefined();
  expect(values.get('standalone-5s-actions')).toBe(before);
  m.identity.setDemoRole('leader');const started=m.actions.startAssignedAction(action.id,m.leader,'immediate')!;
  expect(started).toMatchObject({status:'In Progress',actionType:'immediate'});
  expect(m.actions.startAssignedAction(action.id,m.leader,'corrective')).toBeUndefined();
  expect(m.actions.getActionById(action.id)!.activityHistory?.filter(item=>item.type==='started')).toHaveLength(1);
  expect(m.actions.updateAction(action.id,{actionType:'corrective'},m.leader)).toBeUndefined();
 });
 it.each(['immediate','corrective'] as const)('%s retains standard category/cost validation and the type in revision/closure/reload',async actionType=>{
  const m=await setup();const action=m.create();m.identity.setDemoRole('leader');m.actions.startAssignedAction(action.id,m.leader,actionType);m.actions.addActionEvidence(action.id,completion,m.leader);
  const resolution={observation:'Aisle cleared',correctiveActionCategory:'Communication',costSaving:0};
  const submitted=m.actions.submitActionForReview(action.id,m.leader,resolution)!;
  expect(submitted).toMatchObject({status:'Pending Auditor Review',actionType});expect(submitted.costSaving).toBe(0);expect(submitted.submissionRevisions![0]).toMatchObject({actionType,observation:resolution.observation});
  expect(submitted.submissionRevisions![0].costSaving).toBe(0);
  expect(m.actions.closeReviewedAction(action.id,m.leader)).toBeUndefined();
  m.identity.setDemoRole('auditor');const closed=m.actions.closeReviewedAction(action.id,m.auditor,'Verified')!;expect(closed.status).toBe('Completed');
  vi.resetModules();expect((await import('@/lib/actions/action-store')).getActionById(action.id)).toMatchObject({status:'Completed',actionType});
 });
 it.each(['immediate','corrective'] as const)('%s retains category, evidence, notes and numeric cost requirements',async actionType=>{
  const m=await setup();const action=m.create();m.identity.setDemoRole('leader');m.actions.startAssignedAction(action.id,m.leader,actionType);m.actions.addActionEvidence(action.id,completion,m.leader);
  expect(m.actions.submitActionForReview(action.id,m.leader,{observation:'Done',correctiveActionCategory:'',costSaving:0})).toBeUndefined();
  expect(m.actions.submitActionForReview(action.id,m.leader,{observation:'Done',correctiveActionCategory:'Communication',costSaving:undefined as unknown as number})).toBeUndefined();
  for(const costSaving of [-1,Number.NaN,Number.POSITIVE_INFINITY]) expect(m.actions.submitActionForReview(action.id,m.leader,{observation:'Done',correctiveActionCategory:'Communication',costSaving})).toBeUndefined();
  expect(m.actions.submitActionForReview(action.id,m.leader,{observation:'',correctiveActionCategory:'Communication',costSaving:0})).toBeUndefined();
  m.actions.setActions([{...m.actions.getActionById(action.id)!,evidence:[],actionType:'immediate'}]);
  expect(m.actions.submitActionForReview(action.id,m.leader,{observation:'Done',correctiveActionCategory:'',costSaving:0})).toBeUndefined();
 });
 it('lets the assigned leader reassign to a zone member with a reason and prevents work by the former owner',async()=>{
  const m=await setup();const action=m.create();m.identity.setDemoRole('leader');
  expect(m.actions.reassignActionOwner(action.id,m.leader,m.member.id,'')).toBeUndefined();
  const reassigned=m.actions.reassignActionOwner(action.id,m.leader,m.member.id,'Shift coverage')!;
  expect(reassigned).toMatchObject({status:'Assigned',responsiblePersonId:m.member.id,sourceId:m.audit.id});
  expect(m.actions.startAssignedAction(action.id,m.leader,'immediate')).toBeUndefined();m.identity.setDemoRole('responsible');
  expect(m.actions.startAssignedAction(action.id,m.member,'immediate')?.status).toBe('In Progress');
 });
 it('lists a leader only once when the auditor is also the configured leader',async()=>{
  const m=await setup();const members=m.linked.getEligibleLinkedActionMembers({...m.context,zone:'Zone A'});
  expect(members.filter(item=>item.id===m.auditor.id)).toHaveLength(1);
 });
 it('retains the assigned state, type and history when starting cannot be persisted',async()=>{
  const m=await setup();const action=m.create();m.identity.setDemoRole('leader');const before=values.get('standalone-5s-actions');
  const write=window.localStorage.setItem.bind(window.localStorage);vi.spyOn(window.localStorage,'setItem').mockImplementation((key,value)=>{if(key==='standalone-5s-actions')throw new DOMException('quota','QuotaExceededError');write(key,value);});
  expect(m.actions.startAssignedAction(action.id,m.leader,'immediate')).toBeUndefined();expect(values.get('standalone-5s-actions')).toBe(before);expect(m.actions.getActionById(action.id)).toMatchObject({status:'Assigned'});expect(m.actions.getActionById(action.id)!.actionType).toBeUndefined();
 });
 it('does not publish a source link when Audit persistence fails and supports rolling back the newly created Action',async()=>{
  const m=await setup();const action=m.create();const original=m.audits.getFiveSAuditById(m.audit.id);const write=window.localStorage.setItem.bind(window.localStorage);
  vi.spyOn(window.localStorage,'setItem').mockImplementation((key,value)=>{if(key==='manufacturing-qms-five-s-audits-v1')throw new DOMException('quota','QuotaExceededError');write(key,value);});
  expect(m.audits.linkAuditQuestionAction(m.audit.id,'PLAN-Q',action.id,m.auditor)).toBe(false);expect(m.audits.getFiveSAuditById(m.audit.id)).toEqual(original);
  expect(m.actions.rollbackCreatedAction(action.id,m.auditor)).toBe(true);expect(m.actions.getActionById(action.id)).toBeUndefined();
 });
});


describe('Action Type start boundaries and compatibility',()=>{
 it('creates an unstarted, untyped Action and rejects creation-time type injection',async()=>{
  const m=await setup();const item=m.create();expect(item.status).toBe('Assigned');expect(item.actionType).toBeUndefined();
  expect(item.activityHistory?.some(event=>event.type==='started')).toBe(false);
  expect(()=>m.actions.createAction({...item,id:undefined,actionType:'immediate'} as unknown as Parameters<typeof m.actions.createAction>[0])).toThrow();
 });
 it('rejects omitted and invalid types without changing persisted state',async()=>{
  const m=await setup();const item=m.create();m.identity.setDemoRole('leader');const before=values.get('standalone-5s-actions');
  for(const type of [undefined,'', 'unsupported',null,0])expect(m.actions.startAssignedAction(item.id,m.leader,type as never)).toBeUndefined();
  expect(values.get('standalone-5s-actions')).toBe(before);
 });
 it('rejects forged identity, stale session, missing login, inactive user, disabled entitlement and foreign organization',async()=>{
  const m=await setup();const item=m.create();const before=values.get('standalone-5s-actions');
  expect(m.actions.startAssignedAction(item.id,m.leader,'immediate')).toBeUndefined();
  m.identity.setDemoRole('leader');const session=values.get('5s-auth-session')!;values.delete('5s-auth-session');
  expect(m.actions.startAssignedAction(item.id,m.leader,'immediate')).toBeUndefined();values.set('5s-auth-session',session);
  expect(m.actions.startAssignedAction(item.id,{...m.leader,id:'UNKNOWN'},'immediate')).toBeUndefined();
  const directory=await import('@/features/five-s/administration/store');const user=directory.getAdminUser(m.leader.id)!;
  const status=user.status;user.status='Inactive';expect(m.actions.startAssignedAction(item.id,m.leader,'immediate')).toBeUndefined();user.status=status;
  expect(values.get('standalone-5s-actions')).toBe(before);
  const access=await import('@/lib/module-entitlements');m.identity.setDemoRole('superAdmin');expect(access.saveFactoryAccess('abc-manufacturing','PLANT-EGM',{...access.getOrganizationAccess(),audit:false})).toBe(true);m.identity.setDemoRole('leader');
  expect(m.actions.startAssignedAction(item.id,m.leader,'immediate')).toBeUndefined();
  m.identity.setDemoRole('superAdmin');access.saveFactoryAccess('abc-manufacturing','PLANT-EGM',{...access.getOrganizationAccess(),audit:true,actions:false});m.identity.setDemoRole('leader');
  expect(m.actions.startAssignedAction(item.id,m.leader,'immediate')).toBeUndefined();
  m.identity.setDemoRole('superAdmin');access.saveFactoryAccess('abc-manufacturing','PLANT-EGM',{...access.getOrganizationAccess(),actions:true});m.identity.setDemoRole('leader');
  m.actions.setActions([{...item,organizationId:'other-org'} as typeof item & {organizationId:string}]);
  expect(m.actions.startAssignedAction(item.id,m.leader,'immediate')).toBeUndefined();
 });
 it('checks durable state and rejects stale ownership/lifecycle snapshots without overwriting newer data',async()=>{
  const m=await setup();const item=m.create();m.identity.setDemoRole('leader');const token=m.actions.getActionStartState(item);
  const next={...item,responsiblePersonId:m.member.id,responsiblePersonName:m.member.name,assignedTo:m.member.name};
  values.set('standalone-5s-actions',JSON.stringify([next]));const before=values.get('standalone-5s-actions');
  expect(m.actions.startAssignedAction(item.id,m.leader,'immediate',token)).toBeUndefined();expect(values.get('standalone-5s-actions')).toBe(before);
  m.actions.setActions([item]);const started=m.actions.startAssignedAction(item.id,{...m.leader,name:'Forged display'},'corrective',token)!;
  expect(started.activityHistory?.at(-1)).toMatchObject({actorName:m.leader.name,actionType:'corrective'});
  expect(m.actions.startAssignedAction(item.id,m.leader,'immediate',token)).toBeUndefined();expect(m.actions.getActionById(item.id)).toEqual(started);
 });
 it.each(['Assigned','Open','Rework Required'] as const)('undo from %s clears only active type and retains typed events, work and revisions',async status=>{
  const m=await setup();const item=m.create();m.actions.setActions([{...item,status,correctiveActionCategory:'Communication',costSaving:5}]);m.identity.setDemoRole('leader');
  const started=m.actions.startAssignedAction(item.id,m.leader,'immediate')!;expect(started.correctiveActionCategory).toBe('Communication');
  const undone=m.actions.undoActionStart(item.id,m.leader)!;expect(undone).toMatchObject({status,correctiveActionCategory:'Communication',costSaving:5});expect(undone.actionType).toBeUndefined();
  expect(undone.activityHistory?.filter(e=>e.type==='started')).toEqual(started.activityHistory?.filter(e=>e.type==='started'));
  expect(undone.activityHistory?.at(-1)).toMatchObject({type:'start_undone',actionType:'immediate'});
  expect(m.actions.startAssignedAction(item.id,m.leader)).toBeUndefined();
  expect(m.actions.startAssignedAction(item.id,m.leader,'corrective')?.actionType).toBe('corrective');
 });
 it('preserves typed revisions through rework, restart and owner reassignment',async()=>{
  const m=await setup();const item=m.create();m.identity.setDemoRole('leader');m.actions.startAssignedAction(item.id,m.leader,'immediate');m.actions.addActionEvidence(item.id,completion,m.leader);
  const first=m.actions.submitActionForReview(item.id,m.leader,{observation:'First work',correctiveActionCategory:'Communication',costSaving:0})!;
  m.identity.setDemoRole('auditor');const reviewed=m.actions.sendActionBack(item.id,m.auditor,'Clarify result')!;expect(reviewed.status).toBe('Rework Required');
  m.identity.setDemoRole('leader');const restart=m.actions.startAssignedAction(item.id,m.leader,'corrective')!;expect(restart.submissionRevisions).toEqual(reviewed.submissionRevisions);expect(restart.submissionRevisions?.[0]).toMatchObject(first.submissionRevisions![0]);
  const reassigned=m.actions.reassignActionOwner(item.id,m.leader,m.member.id,'Shift coverage')!;expect(reassigned.actionType).toBe('corrective');expect(reassigned.submissionRevisions?.[0].actionType).toBe('immediate');
  m.identity.setDemoRole('responsible');const second=m.actions.submitActionForReview(item.id,m.member,{observation:'Updated work',correctiveActionCategory:'Communication',costSaving:0})!;
  expect(second.submissionRevisions?.map(r=>r.actionType)).toEqual(['immediate','corrective']);
  m.identity.setDemoRole('auditor');expect(m.actions.closeReviewedAction(item.id,m.auditor)?.status).toBe('Completed');
 });
 it('keeps already-running untyped historical records readable and submittable without fabricating type',async()=>{
  const m=await setup();const item=m.create();m.actions.setActions([{...item,status:'In Progress'}]);m.identity.setDemoRole('leader');m.actions.addActionEvidence(item.id,completion,m.leader);
  const submitted=m.actions.submitActionForReview(item.id,m.leader,{observation:'Legacy work',correctiveActionCategory:'Communication',costSaving:0})!;
  expect(submitted.actionType).toBeUndefined();expect(submitted.submissionRevisions?.[0].actionType).toBeUndefined();
  m.identity.setDemoRole('auditor');expect(m.actions.closeReviewedAction(item.id,m.auditor)?.status).toBe('Completed');
 });
 for(const [sourceModule,source] of [['audit','Audit'],['redTag','Red Tag'],['gemba','Gemba'],['continuousImprovement','Continuous Improvement'],['visualImprovement','Visual Improvement'],['visualManagement','Visual Management'],['manual','Manual']] as const)
 it.each(['immediate','corrective'] as const)(sourceModule+' existing canonical Action starts with %s without changing source or ownership',async type=>{
  const m=await setup();const original=m.create();const item={...original,sourceModule,source,sourceId:'LEGACY-'+sourceModule};m.actions.setActions([item]);m.identity.setDemoRole('leader');
  const started=m.actions.startAssignedAction(item.id,m.leader,type)!;expect(started).toMatchObject({actionType:type,status:'In Progress',sourceModule,sourceId:item.sourceId,responsiblePersonId:item.responsiblePersonId,createdAt:item.createdAt,issueEvidence:item.issueEvidence});expect(started.reviewerId).toBe(item.reviewerId);
 });
});


describe('persisted type display',()=>{
 it.each(['immediate','corrective',undefined] as const)('renders %s consistently in detail history and both reports without inferring historical types',async actionType=>{
  const m=await setup();const original=m.create();
  const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
  const {UiPreferencesProvider}=await import('@/components/preferences/ui-preferences-provider');
  const {ActionSubmissionHistory}=await import('@/features/actions/action-submission-history');
  const {default:Report}=await import('@/features/five-s/action-report-page');const {default:Canonical}=await import('@/features/reports/canonical-action-report-page');
  const {getActionTypeLabel}=await import('@/lib/actions/action-config');
  const item={...original,status:'Completed' as const,actionType,activityHistory:[{id:'START',type:'started' as const,actorId:m.leader.id,actorName:m.leader.name,createdAt:'2026-10-19T10:00:00Z',actionType}],submissionRevisions:[{id:'REV',number:1,submittedAt:'2026-10-19T11:00:00Z',observation:'Work',actionType,correctiveActionCategory:'Communication',costSaving:0,evidence:[],progressEvidence:[]}]};
  const before={evidence:[],state:'not-captured' as const,provenance:'Fixture',description:'Fixture',readOnly:true as const};
  const elements=[React.createElement(ActionSubmissionHistory,{action:item,beforeEvidence:before}),React.createElement(Report,{action:item,beforeEvidence:before,onBack:()=>{}}),React.createElement(Canonical,{action:item,beforeEvidence:before,onBack:()=>{}})];
  for(const element of elements){const html=renderToStaticMarkup(React.createElement(UiPreferencesProvider,null,element));expect(html).toContain(getActionTypeLabel(actionType));expect(html).toContain('Action');}
  const html=renderToStaticMarkup(React.createElement(ActionSubmissionHistory,{action:item,beforeEvidence:before}));expect(html).toContain('Communication');expect(html).toContain('Start History');
 });
});
