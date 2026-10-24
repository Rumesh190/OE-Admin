'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Tag, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OpsFeedback } from '@/components/ops/ops-feedback';
import { useCurrentUser } from '@/lib/current-user';
import { useAdminUsers } from '@/features/five-s/administration/store';
import { getRedTagCreationError, canCreateRedTagInZone, getRedTagDepartments, getRedTagZoneLeader } from '@/features/five-s/red-tag/access';
import { RED_TAG_REASON_GROUPS, type RedTagReason, type RedTagReasonCategory } from '@/features/five-s/red-tag/types';
import { getOrganizationZone } from '@/lib/organization-store';
import { createRedTagFromGemba, transferAvailableGembaEvidence } from '@/lib/gemba/gemba-integration';
import { optimizeEvidenceImage } from '@/lib/evidence-images';
import type { GembaObservation } from '@/features/gemba/types';

interface Props {open:boolean;onOpenChange:(open:boolean)=>void;observation:GembaObservation;walkId:string;plant:string;zone:string;onCreated?:(id:string)=>void;}
export function CreateRedTagFromGembaDialog({open,onOpenChange,observation,walkId,plant,zone,onCreated}:Props) {
  const actor=useCurrentUser(), admin=useAdminUsers(true).find(u=>u.id===actor.id);
  const [itemName,setItemName]=useState(observation.title),[remarks,setRemarks]=useState(observation.description),[section,setSection]=useState(observation.location);
  const [department,setDepartment]=useState(getOrganizationZone(zone)?.department??'');
  const [reasonCategory,setReasonCategory]=useState<RedTagReasonCategory|''>(''),[reason,setReason]=useState<RedTagReason|''>(''),[customReason,setCustomReason]=useState('');
  const [photo,setPhoto]=useState<string>(),[pendingId,setPendingId]=useState<string>(),[linkedId,setLinkedId]=useState<string>();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''); const guard=useRef(false); const upload=useRef<HTMLInputElement>(null);
  const allowed=observation.type==='Issue'&&canCreateRedTagInZone(admin,plant,zone), leader=getRedTagZoneLeader(plant,zone);
  const reasons=reasonCategory?RED_TAG_REASON_GROUPS[reasonCategory]:[];
  async function create() {
    if(guard.current)return;
    setError('');
    if(!allowed) {setError(getRedTagCreationError(admin,plant,zone)||'Red Tag creation is unavailable for this observation.');return;}
    if(!pendingId&&(!itemName.trim()||!remarks.trim()||!section.trim()||!getRedTagDepartments(plant).includes(department)||!reasonCategory||!reason||(reason==='Free Text'&&!customReason.trim()))) {setError('Complete the item, description, location, department and tagging reason.');return;}
    guard.current=true;setBusy(true);
    try {
      const sourcePhotos=pendingId||photo?undefined:await transferAvailableGembaEvidence(observation.evidence);
      const imageUrl=pendingId?"":photo??sourcePhotos?.available[0]?.url;
      if(!pendingId&&!imageUrl)throw new Error('A before photo is required. Upload a photo or add evidence to the observation.');
      const tag=await createRedTagFromGemba(walkId,observation.id,{plant,zone,section:section.trim(),department,itemName:itemName.trim(),remarks:remarks.trim(),reason:reason as RedTagReason,reasonCategory:reasonCategory||undefined,customReason:customReason.trim()||undefined,imageUrl:imageUrl??"",createdById:actor.id,createdByName:actor.name},actor,setPendingId,pendingId);
      setLinkedId(tag.id);onCreated?.(tag.id);
    } catch(e){setError(e instanceof Error?e.message:'Unable to create Red Tag.');}
    finally {guard.current=false;setBusy(false);}
  }
  return <Dialog open={open} onOpenChange={next=>{if(!guard.current)onOpenChange(next);}}><DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] sm:max-w-2xl">
    <DialogHeader className="pr-8"><DialogTitle className="flex items-center gap-2"><Tag className="size-5 shrink-0" />Create Red Tag from Observation</DialogTitle><DialogDescription>{plant} · {zone}. Create the physical-item record and submit it when an independent Zone Leader is available.</DialogDescription></DialogHeader>
    {linkedId?<div className="grid gap-4"><OpsFeedback tone="success" message={`${linkedId} created and linked.`} /><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>onOpenChange(false)}>Continue Gemba walk</Button><Button nativeButton={false} render={<Link href={`/5s/red/${encodeURIComponent(linkedId)}`} />}>View Red Tag</Button></div></div>:<div className="grid min-w-0 gap-4">
      {error&&<OpsFeedback tone="error" message={error} />}
      {!allowed?<p className="text-sm text-muted-foreground">{getRedTagCreationError(admin,plant,zone)||'Red Tag creation is unavailable for this observation.'}</p>:<>
      <label className="grid gap-1.5 text-sm">Item Name *<Input value={itemName} onChange={e=>setItemName(e.target.value)} disabled={busy||Boolean(pendingId)} /></label>
      <label className="grid gap-1.5 text-sm">Item Description *<Textarea value={remarks} onChange={e=>setRemarks(e.target.value)} disabled={busy||Boolean(pendingId)} /></label>
      <label className="grid gap-1.5 text-sm">Location *<Input value={section} onChange={e=>setSection(e.target.value)} disabled={busy||Boolean(pendingId)} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm">Department *<Select value={department} onValueChange={v=>setDepartment(v??'')} disabled={busy||Boolean(pendingId)}><SelectTrigger aria-label="Department"><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent>{getRedTagDepartments(plant).map(d=><SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></label>
      <label className="grid gap-1.5 text-sm">Tagging Category *<Select value={reasonCategory} onValueChange={v=>{setReasonCategory(v as RedTagReasonCategory);setReason('');}} disabled={busy||Boolean(pendingId)}><SelectTrigger aria-label="Tagging Category"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{Object.keys(RED_TAG_REASON_GROUPS).map(c=><SelectItem key={c} value={c}>{c==='Organization'?'Arrangement':c}</SelectItem>)}</SelectContent></Select></label></div>
      <label className="grid gap-1.5 text-sm">Tagging Reason *<Select value={reason} onValueChange={v=>setReason(v as RedTagReason)} disabled={busy||Boolean(pendingId)||!reasonCategory}><SelectTrigger aria-label="Tagging Reason"><SelectValue placeholder="Select reason" /></SelectTrigger><SelectContent>{reasons.map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></label>
      {reason==='Free Text'&&<label className="grid gap-1.5 text-sm">Custom Reason *<Input value={customReason} onChange={e=>setCustomReason(e.target.value)} disabled={busy||Boolean(pendingId)} /></label>}
      <div className="grid gap-2"><p className="text-sm">Before Photo *</p><p className="text-xs text-muted-foreground">{photo?'Uploaded photo selected.':observation.evidence.length?'The first available observation photo will be included.':'Upload a photo to continue.'}</p><Button variant="outline" className="w-fit" onClick={()=>upload.current?.click()} disabled={busy||Boolean(pendingId)}><Upload className="size-4" />Upload Photo</Button><input hidden ref={upload} type="file" accept="image/*" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{setPhoto((await optimizeEvidenceImage(f)).dataUrl);setError('');}catch(err){setError(err instanceof Error?err.message:'Unable to read photo.');}}} /></div>
      <p className="text-xs text-muted-foreground">Reviewer: {leader?.name??'No active Zone Leader assigned'}</p>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={()=>onOpenChange(false)} disabled={busy}>Cancel</Button><Button onClick={create} disabled={busy}>{busy?'Saving…':pendingId?'Retry linking existing Red Tag':'Create Red Tag'}</Button></div>
      </>}
    </div>}
  </DialogContent></Dialog>;
}
