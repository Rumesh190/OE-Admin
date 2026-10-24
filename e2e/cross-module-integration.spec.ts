import {ADMIN_USER_SEEDS} from '../features/five-s/administration/store';
import {permissionsForRoles} from '../features/five-s/administration/permissions';
import {expect,test,type Page} from '@playwright/test';
import {GEMBA_SEED_STATE} from '../features/gemba/gemba-store';
import {seed,settle} from './ui-batch2-helpers';
const sizes=[{width:320,height:640},{width:911,height:512},{width:1024,height:600},{width:1440,height:900}];
const issueId='GEM-2026-015-OBS-80',opportunityId='GEM-2026-015-OBS-81';
async function fixtures(page:Page){
 await seed(page,'responsible');
 const users=structuredClone(ADMIN_USER_SEEDS);const creator=users.find(user=>user.id==='USR-SIVA-KUMAR')!;
 creator.roles=['Zone Member','Admin','Auditor'];creator.permissions=permissionsForRoles(creator.roles);creator.zoneMemberships.push({zone:'Zone A',responsibility:'Member'});
 await page.addInitScript(users=>{if(!localStorage.getItem('cross-directory-seeded')){localStorage.setItem('five-s-administration-users-v1',JSON.stringify(users));localStorage.setItem('cross-directory-seeded','1');}},users);
 const state=structuredClone(GEMBA_SEED_STATE),base=structuredClone(state.observations[0]);
 state.observations.push({...base,id:issueId,gembaId:'GEM-2026-015',title:'Integration physical item',description:'Synthetic physical item condition',location:'Office workbench',actionId:undefined,redTagId:undefined,evidence:[{id:'QA-EV',name:'before.png',url:'/demo-5s/not-good-example.png',uploadedAt:'2026-10-19',uploadedBy:'Lakshman'}]}, {...base,id:opportunityId,gembaId:'GEM-2026-015',type:'Opportunity',title:'Integration improvement opportunity',description:'Synthetic excess motion',location:'Office workbench',actionId:undefined,redTagId:undefined,improvementId:undefined,evidence:[]});
 state.walks.find(w=>w.id==='GEM-2026-015')!.observationIds.push(issueId,opportunityId);
 await page.addInitScript(state=>{if(!localStorage.getItem('ops-cross-qa-seeded')){localStorage.setItem('ops-gemba-v1',JSON.stringify(state));localStorage.setItem('ops-cross-qa-seeded','1');localStorage.setItem('cross-unrelated-sentinel','preserved');}},state);
}
async function fits(page:Page){await settle(page);const width=await page.evaluate(()=>document.documentElement.scrollWidth);const outside=width>page.viewportSize()!.width?await page.evaluate(()=>[...document.querySelectorAll('*')].filter(el=>el.checkVisibility()&&el.getBoundingClientRect().width).map(el=>({text:el.textContent?.slice(0,70),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,classes:el.className})).filter(r=>r.right>innerWidth+1||r.left<0).slice(0,15)):[];expect(width,JSON.stringify(outside)).toBeLessThanOrEqual(page.viewportSize()!.width);const panel=page.getByRole('region',{name:'Linked Records',exact:true}).last();if(await panel.count()){expect(await panel.evaluate(el=>el.scrollWidth)).toBeLessThanOrEqual(await panel.evaluate(el=>el.clientWidth));}}
for(const viewport of sizes) test(`Canonical Gemba Red Tag and CI integration ${viewport.width}x${viewport.height}`,async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize(viewport);await fixtures(page);
 await page.goto('/gemba/GEM-2026-015/walk',{waitUntil:'domcontentloaded'});
 const issue=page.locator(`article[id="${issueId}"]`),opportunity=page.locator(`article[id="${opportunityId}"]`);
 await expect(issue.getByRole('button',{name:'Create Improvement',exact:true})).toHaveCount(0);await expect(opportunity.getByRole('button',{name:'Create Red Tag',exact:true})).toHaveCount(0);
 await issue.getByRole('button',{name:'Create Red Tag',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Item Name *',{exact:true})).toHaveValue('Integration physical item');await expect(dialog.getByRole('textbox',{name:'Item Description *',exact:true})).toHaveValue('Synthetic physical item condition');await expect(dialog.getByLabel('Location *',{exact:true})).toHaveValue('Office workbench');
 await dialog.getByRole('combobox',{name:'Department',exact:true}).click();await page.getByRole('option',{name:'Office',exact:true}).click();
 await dialog.getByRole('combobox',{name:'Tagging Category',exact:true}).click();await page.getByRole('option',{name:'Usage',exact:true}).click();await dialog.getByRole('combobox',{name:'Tagging Reason',exact:true}).click();await page.getByRole('option',{name:'Damaged',exact:true}).click();
 await dialog.getByRole('button',{name:'Create Red Tag',exact:true}).dblclick();await expect(dialog.getByRole('button',{name:'View Red Tag',exact:true})).toBeVisible();
 const tags=await page.evaluate(()=>JSON.parse(localStorage.getItem('five-s-red-tags-v1')!));expect(tags.filter((t:{itemName:string})=>t.itemName==='Integration physical item')).toHaveLength(1);expect(tags.some((t:{id:string})=>t.id==='RT-EGM-ZA-001')).toBe(true);expect(tags[0].id).toBe('RT-000001');expect(tags[0].status).toBe('Under Review');expect(tags[0].review.reviewerId).toBe('USR-LAKSHMAN');expect(tags[0].createdById).toBe('USR-SIVA-KUMAR');expect(tags[0].department).toBe('Office');expect(tags[0].imageUrl).toBe('/demo-5s/not-good-example.png');expect(tags[0].actionId).toBeUndefined();
 await dialog.getByRole('button',{name:'View Red Tag',exact:true}).click();await expect(page).toHaveURL(/\/5s\/red\/RT-000001$/);await fits(page);
 let panel=page.getByRole('region',{name:'Linked Records',exact:true});const reverse=panel.getByRole('link',{name:/Gemba/});await expect(reverse).toHaveAttribute('href',`/gemba/GEM-2026-015?tab=observations#${issueId}`);await page.reload({waitUntil:'domcontentloaded'});await expect(reverse).toBeVisible();
 await page.evaluate(()=>localStorage.setItem('five-s-demo-role','auditor'));await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Keep',exact:true}).click();await page.getByLabel('Keep Justification',{exact:true}).fill('Retain the inspected source item');await page.getByRole('button',{name:'Confirm Keep & Close',exact:true}).click();await expect(page.getByText('Kept · Closed',{exact:true})).toBeVisible();await page.reload({waitUntil:'domcontentloaded'});await expect(reverse).toBeVisible();await expect(page.getByText('Retain the inspected source item',{exact:true})).toBeVisible();await fits(page);if(viewport.width===320||viewport.width===1440)await page.screenshot({path:info.outputPath('gemba-keep-closed-origin.png'),fullPage:true});await reverse.click();await expect(page).toHaveURL(new RegExp(`#${issueId}$`));await issue.getByRole('button',{name:'View',exact:true}).click();await expect(page.getByRole('dialog').getByRole('region',{name:'Linked Records'}).getByRole('link',{name:/Red Tag/})).toHaveCount(1);await page.keyboard.press('Escape');
 await page.goto('/gemba/GEM-2026-015/walk',{waitUntil:'domcontentloaded'});await expect(issue.getByRole('button',{name:'Create Red Tag',exact:true})).toHaveCount(0);
 await opportunity.getByRole('button',{name:'Create Improvement',exact:true}).click();
 const ciDialog=page.getByRole('dialog');const text=ciDialog.locator('input').first();await expect(text).toHaveValue('Integration improvement opportunity');const areas=ciDialog.locator('textarea');await expect(areas.nth(0)).toHaveValue('Synthetic excess motion');await areas.nth(1).fill('Reorganize the workstation');await areas.nth(2).fill('Reduce walking');
 await ciDialog.getByRole('button',{name:'Create Improvement',exact:true}).dblclick();await expect(ciDialog.getByRole('link',{name:'Open improvement CI-000001',exact:true})).toBeVisible();await ciDialog.getByRole('link',{name:'Open improvement CI-000001',exact:true}).click();await expect(page).toHaveURL(/\/continuous-improvement\/CI-000001$/);panel=page.getByRole('region',{name:'Linked Records',exact:true});await expect(panel.getByRole('link',{name:/Gemba/})).toHaveAttribute('href',`/gemba/GEM-2026-015?tab=observations#${opportunityId}`);await fits(page);await page.screenshot({path:info.outputPath('ci-linked-records.png'),fullPage:true});await page.reload({waitUntil:'domcontentloaded'});await expect(panel.getByRole('link',{name:/Gemba/})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('cross-unrelated-sentinel'))).toBe('preserved');
});

import { MY_ACTIONS } from '../features/five-s/data/my-actions-data';
import { getRedTags } from '../features/five-s/red-tag/store';
for(const viewport of sizes)test(`Linked Records scope, multiple Actions and missing records ${viewport.width}x${viewport.height}`,async({page},info)=>{
 await page.setViewportSize(viewport);await fixtures(page);
 const tag={...structuredClone(getRedTags()[0]),id:'RT-000099',tagNumber:'RT-000099',itemName:'Synthetic linked item',actionId:'ACT-000091',actionIds:['ACT-000091','ACT-000092']};
 const a={...structuredClone(MY_ACTIONS[0]),id:'ACT-000091',title:'Independent execution one',sourceModule:'redTag',source:'Red Tag',sourceId:tag.id,sourceTitle:tag.id,plant:tag.plant,area:tag.zone,status:'Rework Required',responsiblePersonId:'USR-RITIKA',responsiblePersonName:'Ritika',createdByUserId:'USR-LAKSHMAN',createdByName:'Lakshman'};
 const b={...a,id:'ACT-000092',title:'Independent execution two',status:'Completed'};
 const foreign={...a,id:'ACT-000093',title:'PRIVATE FOREIGN TITLE',organizationId:'xyz-components'};
 await page.addInitScript(({tag,a,b,foreign})=>{if(!localStorage.getItem('ops-cross-links-seeded')){localStorage.setItem('five-s-red-tags-v1',JSON.stringify([tag]));localStorage.setItem('standalone-5s-actions',JSON.stringify([a,b,foreign]));localStorage.setItem('ops_relationships_v1',JSON.stringify({version:1,relationships:[{id:'duplicate',from:{module:'action',recordId:a.id},to:{module:'redTag',recordId:tag.id},relationshipType:'action',createdAt:'2026-10-19'},{id:'missing',from:{module:'redTag',recordId:tag.id},to:{module:'action',recordId:'ACT-missing'},relationshipType:'action',createdAt:'2026-10-19'},{id:'foreign',from:{module:'redTag',recordId:tag.id},to:{module:'action',recordId:foreign.id},relationshipType:'action',createdAt:'2026-10-19'}]}));localStorage.setItem('ops-cross-links-seeded','1');}},{tag,a,b,foreign});
 await page.goto('/5s/red/'+tag.id,{waitUntil:'domcontentloaded'});
 let panel=page.getByRole('region',{name:'Linked Records',exact:true});await expect(panel.getByRole('link')).toHaveCount(2);await expect(panel.getByText('Rework Required',{exact:true})).toBeVisible();await expect(panel.getByText('Completed',{exact:true})).toBeVisible();await expect(panel).not.toContainText('PRIVATE FOREIGN TITLE');await expect(panel).not.toContainText('ACT-missing');await expect(panel.getByText('Some linked records are unavailable or outside your access.',{exact:true})).toBeVisible();
 await fits(page);const link=panel.getByRole('link',{name:/Independent execution one/});await link.focus();await expect(link).toBeFocused();await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/actions\/ACT-000091/);
 panel=page.getByRole('region',{name:'Linked Records',exact:true});await expect(panel.getByRole('link',{name:/Synthetic linked item/})).toHaveCount(1);await fits(page);await page.screenshot({path:info.outputPath('action-linked-records.png'),fullPage:true});
 // Existing Zone Leader rules: Zone B leadership does not grant access to this Zone A source.
 await page.evaluate(()=>localStorage.setItem('five-s-demo-role','leader'));await page.goto('/5s/red/'+tag.id,{waitUntil:'domcontentloaded'});panel=page.getByRole('region',{name:'Linked Records',exact:true});await expect(panel.getByRole('link')).toHaveCount(0);await expect(panel).not.toContainText('Independent execution');
});

import { DEFAULT_MODULE_ENTITLEMENTS } from '../lib/modules';
for(const viewport of [sizes[0],sizes[3]])test(`Existing VI and VM canonical detail links ${viewport.width}px`,async({page})=>{
 await page.setViewportSize(viewport);await seed(page);
 await page.addInitScript(access=>{if(!localStorage.getItem('ops-cross-modules-seeded')){localStorage.setItem('ops-organization-modules-v1',JSON.stringify({'abc-manufacturing':{...access,visualImprovement:true}}));localStorage.setItem('ops-cross-modules-seeded','1');}},DEFAULT_MODULE_ENTITLEMENTS);
 await page.goto('/visual-improvement/VI-2026-014',{waitUntil:'domcontentloaded'});
 let panel=page.getByRole('region',{name:'Linked Records',exact:true});await expect(panel.getByRole('link',{name:/ACT-VI-014/})).toHaveAttribute('href',/\/actions\/ACT-VI-014/);await fits(page);
 await panel.getByRole('link',{name:/ACT-VI-014/}).click();panel=page.getByRole('region',{name:'Linked Records',exact:true});await expect(panel.getByRole('link',{name:/Visual Improvement/})).toHaveAttribute('href','/visual-improvement/VI-2026-014');
 await page.goto('/visual-management/meetings/VMM-2026-013',{waitUntil:'domcontentloaded'});panel=page.getByRole('region',{name:'Linked Records',exact:true});await expect(panel.getByRole('link',{name:/ACT-VM-001/})).toHaveAttribute('href',/\/actions\/ACT-VM-001/);await expect(panel.getByRole('link',{name:/VM-ZA-T1/})).toHaveAttribute('href','/visual-management/boards/VM-ZA-T1');await fits(page);
});

test('IndexedDB source photo transfers durably after reload without removing the Gemba asset',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await fixtures(page);await page.goto('/gemba/GEM-2026-015/walk',{waitUntil:'domcontentloaded'});
 await page.evaluate(async issueId=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('ops-local-assets',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('gemba-photos'))request.result.createObjectStore('gemba-photos');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('gemba-photos','readwrite');tx.objectStore('gemba-photos').put(new Blob([bytes],{type:'image/png'}),'cross-qa-before-photo');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
  const state=JSON.parse(localStorage.getItem('ops-gemba-v1')!);state.observations.find((o:{id:string})=>o.id===issueId).evidence=[{id:'QA-DB',name:'source.png',storageKey:'cross-qa-before-photo',mimeType:'image/png',uploadedAt:'2026-10-19',uploadedBy:'Lakshman'}];localStorage.setItem('ops-gemba-v1',JSON.stringify(state));
 },issueId);
 await page.reload({waitUntil:'domcontentloaded'});await page.locator(`article[id="${issueId}"]`).getByRole('button',{name:'Create Red Tag',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByRole('combobox',{name:'Tagging Category',exact:true}).click();await page.getByRole('option',{name:'Usage',exact:true}).click();await dialog.getByRole('combobox',{name:'Tagging Reason',exact:true}).click();await page.getByRole('option',{name:'Damaged',exact:true}).click();await dialog.getByRole('button',{name:'Create Red Tag',exact:true}).click();await expect(dialog.getByRole('button',{name:'View Red Tag',exact:true})).toBeVisible();
 const photo=await page.evaluate(()=>JSON.parse(localStorage.getItem('five-s-red-tags-v1')!).find((t:{id:string})=>t.id==='RT-000001').imageUrl);expect(photo).toMatch(/^data:image\/jpeg;base64,/);
 await dialog.getByRole('button',{name:'View Red Tag',exact:true}).click();await page.reload({waitUntil:'domcontentloaded'});expect(await page.evaluate(issueId=>JSON.parse(localStorage.getItem('ops-gemba-v1')!).observations.find((o:{id:string})=>o.id===issueId).evidence[0].storageKey,issueId)).toBe('cross-qa-before-photo');
 const exists=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('ops-local-assets',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const value=await new Promise<boolean>((resolve,reject)=>{const r=db.transaction('gemba-photos').objectStore('gemba-photos').get('cross-qa-before-photo');r.onsuccess=()=>resolve(r.result instanceof Blob);r.onerror=()=>reject(r.error);});db.close();return value;});expect(exists).toBe(true);
});

import { FIVE_S_AUDITS } from '../features/five-s/data/five-s-data';
for(const viewport of [sizes[0],sizes[3]])test(`Audit review canonical Action links ${viewport.width}px`,async({page},info)=>{
 await page.setViewportSize(viewport);await seed(page);
 const audit={...structuredClone(FIVE_S_AUDITS[0]),id:'AUD-000099',title:'Synthetic linked Audit',area:'Zone A',status:'In Progress'};
 audit.sections[0].questions[0].status='Not Started';audit.sections[0].questions[0].score=null;audit.sections[0].questions[0].complianceResponse=null;audit.sections[0].questions[0].actionId='ACT-000098';
 const action={...structuredClone(MY_ACTIONS[0]),id:'ACT-000098',title:'Audit follow-up',source:'5S Audit',sourceModule:'audit',sourceId:audit.id,auditId:audit.id,sourceTitle:audit.title,area:'Zone A',createdByUserId:'USR-LAKSHMAN',createdByName:'Lakshman'};
 await page.addInitScript(({audit,action})=>{if(!localStorage.getItem('ops-cross-audit-seeded')){localStorage.setItem('manufacturing-qms-five-s-audits-v1',JSON.stringify([audit]));localStorage.setItem('standalone-5s-audit-fixture-version','canonical-zone-a-v1');localStorage.setItem('standalone-5s-actions',JSON.stringify([action]));localStorage.setItem('ops-cross-audit-seeded','1');}},{audit,action});
 await page.goto('/audits?audit='+audit.id,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Review Audit',exact:true}).click();
 const panel=page.getByRole('region',{name:'Linked Records',exact:true});await expect(panel.getByRole('link',{name:/Audit follow-up/})).toHaveAttribute('href',/\/actions\/ACT-000098/);await fits(page);await page.screenshot({path:info.outputPath('audit-review-after.png'),fullPage:true});await panel.getByRole('link',{name:/Audit follow-up/}).click();await expect(page.getByRole('region',{name:'Linked Records',exact:true}).getByRole('link',{name:/Synthetic linked Audit/})).toHaveAttribute('href','/audits?audit=AUD-000099');
 const saved=await page.evaluate(id=>JSON.parse(localStorage.getItem('manufacturing-qms-five-s-audits-v1')!).find((record:{id:string})=>record.id===id),audit.id);expect(saved.sections[0].questions[0].status).toBe('Not Started');expect(saved.sections[0].questions[0].actionId).toBe('ACT-000098');
});

for (const viewport of [sizes[0], sizes[3]]) test(`Gemba sibling dialogs retain independent identity ${viewport.width}px`, async ({page}) => {
 await page.setViewportSize(viewport);
 await fixtures(page);
 const errors: string[] = [];
 page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
 page.on('pageerror', error => errors.push(error.message));
 await page.goto('/gemba/GEM-2026-015/walk', {waitUntil:'domcontentloaded'});
 const before = await page.evaluate(() => localStorage.getItem('ops-gemba-v1'));
 for (const [id, title, createLabel, field] of [
  [issueId, 'Integration physical item', 'Create Red Tag', 'Item Name *'],
  [opportunityId, 'Integration improvement opportunity', 'Create Improvement', 'Improvement title *'],
 ]) {
  const card = page.locator(`article[id="${id}"]`);
  await card.getByRole('button', {name:'Create Action', exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The closed Action dialog keeps its source context while the sibling opens.
  await card.getByRole('button', {name:createLabel, exact:true}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCount(1);
  if (createLabel === 'Create Red Tag') await expect(dialog.getByLabel(field, {exact:true})).toHaveValue(title);
  else await expect(dialog.locator('input').first()).toHaveValue(title);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Reopening the Action must not resurrect the other dialog or its draft.
  await card.getByRole('button', {name:'Create Action', exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
 }
 expect(errors.filter(error => /same key|unique.*key|maximum update depth/i.test(error))).toEqual([]);
 expect(await page.evaluate(() => localStorage.getItem('ops-gemba-v1'))).toBe(before);
});
