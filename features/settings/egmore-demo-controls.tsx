"use client";

import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { prepareEgmoreDemoData, resetEgmoreDemoData } from "@/lib/demo/egmore-demo-data";

export function EgmoreDemoControls() {
  const [busy, setBusy] = useState<"prepare" | "reset" | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState("");

  async function run(kind: "prepare" | "reset") {
    setBusy(kind); setMessage("");
    try {
      if (kind === "prepare") await prepareEgmoreDemoData();
      else await resetEgmoreDemoData();
      setMessage(kind === "prepare" ? "Egmore demo data is prepared. Refresh or select Egmore Plant to begin." : "The stable Egmore demo records were restored. Unmarked records were preserved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the Egmore demo data.");
    } finally { setBusy(null); setConfirmReset(false); }
  }

  return <section className="border-t pt-6">
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Authorized demo</p>
      <h2 className="mt-2 font-semibold">Egmore client demonstration</h2>
      <p className="mt-1 text-sm text-muted-foreground">Prepare the canonical ABC Manufacturing · Egmore Plant dataset and enable its registered OE modules. The action uses stable IDs and preserves unmarked operational records.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy !== null} onClick={() => void run("prepare")}>{busy === "prepare" ? "Preparing…" : "Prepare Egmore Demo Data"}</Button>
        <Button disabled={busy !== null} variant="outline" onClick={() => setConfirmReset(true)}>Reset Egmore Demo Data</Button>
      </div>
      {message && <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </div>
    <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Restore the Egmore demo baseline?</AlertDialogTitle><AlertDialogDescription>This replaces only records with the stable Egmore demo IDs. It preserves unmarked users, records and operational history.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void run("reset")}>Restore demo baseline</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
