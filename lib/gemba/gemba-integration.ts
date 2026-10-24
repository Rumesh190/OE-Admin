'use client';
import { getGembaState } from '@/features/gemba/gemba-store';
import { canMutateGembaWalk } from '@/features/gemba/gemba-access';
import { createAndSubmitRedTagV2, createRedTagV2, getRedTag, type CreateRedTagV2Input } from '@/features/five-s/red-tag/store';
import { getRedTagCreationError, getRedTagSessionActor, getRedTagZoneLeader } from '@/features/five-s/red-tag/access';
import { getOrganizationAccess } from '@/lib/module-entitlements';
import { getOutgoingRelationships } from '@/lib/relationships/relationship-store';
import { withBusinessRecordCreation } from '@/lib/records/module-records';
import { linkGembaObservationToRedTag } from './gemba-red-tag-relationship';
import type { DemoUser } from '@/lib/current-user';
import type { GembaEvidence } from '@/features/gemba/types';
import { getGembaPhoto } from './gemba-photo-storage';
import { optimizeEvidenceImage } from '@/lib/evidence-images';

/** Resolve source photos into the target models' existing durable URL format, never persist an object URL. */
export async function gembaEvidenceUrlForTransfer(photo:GembaEvidence):Promise<string> {
  if(photo.url&&(photo.url.startsWith('/')&&!photo.url.startsWith('//')||/^https:\/\//i.test(photo.url)||photo.url.startsWith('data:image/'))) return photo.url;
  const blob=photo.storageKey?await getGembaPhoto(photo.storageKey):undefined;
  if(!blob) throw new Error(`Source photo unavailable: ${photo.name}. Upload a photo before creating this record.`);
  return (await optimizeEvidenceImage(new File([blob],photo.name,{type:blob.type||photo.mimeType||'image/jpeg'}))).dataUrl;
}
/** Serialized creation/retry. Keep the created ID when a later source/metadata write fails. */
export function createRedTagFromGemba(walkId:string,observationId:string,input:CreateRedTagV2Input,actor:DemoUser,onReserved:(id:string)=>void,pendingId?:string) {
  const validateSource = () => {
    const state=getGembaState(),walk=state.walks.find(w=>w.id===walkId),observation=state.observations.find(o=>o.id===observationId&&o.gembaId===walkId);
    const user=getRedTagSessionActor(actor.id);
    if(!getOrganizationAccess().gemba||!walk||!observation||observation.type!=='Issue'||walk.status==='Completed'||!canMutateGembaWalk(walk,actor)) throw new Error('You cannot create a Red Tag from this observation.');
    const creationError=getRedTagCreationError(user,walk.plant,walk.zone);
    if(creationError)throw new Error(creationError);
    if(input.plant!==walk.plant||input.zone!==walk.zone)throw new Error('The Red Tag target must match the source Gemba walk.');
    return { walk, observation };
  };
  // Reject before the allocator refreshes registered stores or touches counters.
  try { validateSource(); } catch (error) { return Promise.reject(error); }
  return withBusinessRecordCreation(()=>{
    const { walk, observation } = validateSource();
    const historical=getOutgoingRelationships({module:'gemba',recordId:walkId,childId:observationId}).find(r=>r.to.module==='redTag'&&(r.relationshipType==='red-tag'||r.relationshipType==='created-from'))?.to.recordId;
    const id=observation.redTagId??historical??pendingId;
    let tag=id?getRedTag(id):undefined;
    if(id&&!tag) throw new Error('The linked Red Tag is unavailable. No replacement was created.');
    if(tag&&(tag.plant!==walk.plant||tag.zone!==walk.zone)) throw new Error('The linked Red Tag is outside this observation scope.');
    if(!tag) {
      const leader=getRedTagZoneLeader(walk.plant,walk.zone);
      const creationInput={...input,plant:walk.plant,zone:walk.zone,createdById:actor.id,createdByName:actor.name};
      tag=leader&&leader.id!==actor.id?createAndSubmitRedTagV2(creationInput,actor,leader):createRedTagV2(creationInput,actor);
      if(!tag) throw new Error('Unable to create Red Tag. Check required fields and browser storage.');
    }
    onReserved(tag.id);
    linkGembaObservationToRedTag(walkId,observationId,tag.id,observation.title,actor);
    return tag;
  });
}

import { createImprovement, getImprovementById } from '@/features/five-s/continuous-improvement/store';
import type { CreateImprovementInput } from '@/features/five-s/continuous-improvement/types';
import { canCreateImprovement } from '@/features/five-s/continuous-improvement/access';
import { linkGembaObservationToImprovement } from './gemba-relationships';
export function createImprovementFromGemba(walkId:string,observationId:string,input:CreateImprovementInput,actor:DemoUser,onReserved:(id:string)=>void,pendingId?:string) {
  return withBusinessRecordCreation(()=>{
    const state=getGembaState(),walk=state.walks.find(w=>w.id===walkId),observation=state.observations.find(o=>o.id===observationId&&o.gembaId===walkId);
    const user=getRedTagSessionActor(actor.id);
    if(!walk||!observation||observation.type!=='Opportunity'||walk.status==='Completed'||!canMutateGembaWalk(walk,actor)||!getOrganizationAccess().continuousImprovement||!canCreateImprovement(user,actor)) throw new Error('You cannot create an improvement from this observation.');
    const historical=getOutgoingRelationships({module:'gemba',recordId:walkId,childId:observationId}).find(r=>r.to.module==='continuousImprovement'&&(r.relationshipType==='improvement'||r.relationshipType==='created-from'))?.to.recordId;
    const id=observation.improvementId??historical??pendingId;
    let item=id?getImprovementById(id):undefined;
    if(id&&!item)throw new Error('The linked improvement is unavailable. No replacement was created.');
    if(item&&(item.plant!==walk.plant||item.zone!==walk.zone))throw new Error('The linked improvement is outside this observation scope.');
    if(!item)item=createImprovement({...input,plant:walk.plant,zone:walk.zone},actor)??undefined;
    if(!item)throw new Error("Unable to create improvement. Check required fields and browser storage.");
    onReserved(item.id);
    linkGembaObservationToImprovement(walkId,observationId,item.id,observation.title,actor);
    return item;
  });
}

/** Optional source evidence is copied only when durable/readable; callers disclose omissions. */
export async function transferAvailableGembaEvidence(photos:readonly GembaEvidence[]) {
  const results=await Promise.allSettled(photos.map(async photo=>({id:photo.id,name:photo.name,url:await gembaEvidenceUrlForTransfer(photo),uploadedAt:photo.uploadedAt,uploadedBy:photo.uploadedBy,mimeType:photo.mimeType,caption:photo.note})));
  const available=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
  const unavailable=results.flatMap((result,index)=>result.status==='rejected'?[photos[index].name]:[]);
  return {available,unavailable};
}
