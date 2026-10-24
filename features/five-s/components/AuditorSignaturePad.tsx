"use client";

import { useRef, useState } from "react";
import { CheckCircle2, PenLine, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/preferences/use-i18n";

interface AuditorSignaturePadProps {
  auditor: string;
  signature?: { signedAt: string; signatureImage: string; userName?: string };
  onConfirm: (signatureImage: string) => void;
  onClear: () => void;
}

export default function AuditorSignaturePad({ auditor, signature, onConfirm, onClear }: AuditorSignaturePadProps) {
  const { t, formatDate } = useI18n();
  const signer = signature?.userName ?? auditor;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [error, setError] = useState(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return { x: ((event.clientX - bounds.left) / bounds.width) * canvas.width, y: ((event.clientY - bounds.top) / bounds.height) * canvas.height };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point(event);
    setError(false);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !lastPointRef.current) return;
    event.preventDefault();
    const next = point(event);
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    context.strokeStyle = "#0f172a";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    lastPointRef.current = next;
    setHasStrokes(true);
  }

  function stop(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastPointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    setError(false);
    onClear();
  }

  function confirm() {
    if (!hasStrokes || !canvasRef.current) { setError(true); return; }
    onConfirm(canvasRef.current.toDataURL("image/png"));
  }

  return <section className="min-w-0 rounded-xl border bg-card p-3 shadow-sm sm:p-5">
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-primary">{t("signature.title")}</p><h2 className="mt-1 break-words text-base font-semibold">{t("signature.finalApproval")}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{t("signature.required")}</p></div><div className="min-w-0 text-left text-xs sm:text-right"><p className="break-words font-semibold">{signature ? signer : auditor}</p><p className="mt-1 break-words text-muted-foreground">{formatDate(signature?.signedAt ?? new Date(), { dateStyle: "medium", timeStyle: "short" })}</p></div></div>
    {signature ? <div className="mt-4 min-w-0 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/20 sm:p-4"><div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="size-4 shrink-0" /> <span className="break-words">{t("signature.captured")}</span></div><img src={signature.signatureImage} alt={`${signer} auditor signature`} className="mt-3 h-28 w-full max-w-xl rounded-md border bg-white object-contain p-2" /><div className="mt-3 flex flex-col gap-3 text-xs sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"><div className="min-w-0"><p className="break-words font-semibold text-foreground">{t("signature.signedBy")} {signer}</p><p className="mt-1 break-words text-muted-foreground">{formatDate(signature.signedAt, { dateStyle: "medium", timeStyle: "short" })}</p></div><Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={clearCanvas}><RotateCcw className="size-3.5" /> {t("signature.redraw")}</Button></div></div> : <div className="mt-4 min-w-0"><div className={`min-w-0 overflow-hidden rounded-lg border-2 bg-white transition ${error ? "motion-error-shake border-red-500" : "border-border"}`}><canvas ref={canvasRef} width={900} height={260} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} className="block h-44 w-full touch-none cursor-crosshair overscroll-contain sm:h-52" aria-label={t("signature.title")} /></div>{error && <p className="mt-2 break-words text-sm font-medium text-red-600">{t("signature.validation")}</p>}<div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={clearCanvas}><RotateCcw className="size-4" /> {t("signature.clear")}</Button><Button type="button" className="w-full sm:w-auto" onClick={confirm}><PenLine className="size-4" /> {t("signature.confirm")}</Button></div></div>}
  </section>;
}
