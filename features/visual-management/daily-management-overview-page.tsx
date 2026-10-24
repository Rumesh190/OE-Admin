"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CirclePlay, Settings2 } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { OpsTabBar } from "@/components/ops/ops-tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminUsers } from "@/features/five-s/administration/store";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { useCurrentUser } from "@/lib/current-user";
import { ConfiguredKpiBoard } from "./configured-kpi-board";
import { visibleVisualManagementBoards } from "./visual-management-access";
import { StartMeetingDialog, VisualManagementNav } from "./visual-management-components";
import { useVisualManagementStore } from "./visual-management-store";

type PeriodView = "daily" | "weekly" | "monthly";

export default function DailyManagementOverviewPage() {
  const state = useVisualManagementStore();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const boards = useMemo(() => visibleVisualManagementBoards(state.boards, currentUser, adminUser?.roles).filter((item) => item.status === "Active"), [adminUser?.roles, currentUser, state.boards]);
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");
  const [periodView, setPeriodView] = useState<PeriodView>("daily");
  const [startOpen, setStartOpen] = useState(false);
  const board = boards.find((item) => item.id === boardId) ?? boards[0];
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date());
  return <PageContainer className="max-w-none pb-24">
    <FiveSPageHeader eyebrow="OPS Workspace" title="Visual Management" description="Digital daily management boards for fast metric review, RAG visibility, and corrective action." actions={<div className="flex gap-2"><Button variant="outline" nativeButton={false} render={<Link href="/visual-management/settings" />}><Settings2 className="size-4" />Board Settings</Button><Button onClick={() => setStartOpen(true)} disabled={!board}><CirclePlay className="size-4" />Start Meeting</Button></div>} />
    <VisualManagementNav active="overview" />
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-end"><label className="grid min-w-0 flex-1 gap-1.5 text-sm font-medium">Board<Select searchLabel={"Select a board"} value={board?.id ?? ""} onValueChange={(value) => setBoardId(value ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Select a board" /></SelectTrigger><SelectContent>{boards.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></label><div className="min-w-48"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Period</p><p className="mt-2 text-sm font-semibold">{month}</p></div><OpsTabBar label="Dashboard period" active={periodView} onChange={(value) => setPeriodView(value as PeriodView)} tabs={[{ id: "daily", label: "Daily" }, { id: "weekly", label: "Weekly" }, { id: "monthly", label: "Monthly" }]} /></section>
    {board ? <section><div className="mb-4"><h2 className="text-lg font-semibold">{board.name}</h2><p className="mt-1 text-sm text-muted-foreground">{board.plant}{board.zone ? ` · ${board.zone}` : ""} · {periodView[0].toUpperCase() + periodView.slice(1)} view</p></div><ConfiguredKpiBoard board={board} periodView={periodView} /></section> : <div className="grid min-h-64 place-items-center rounded-xl border border-dashed text-center"><div><p className="font-semibold">No active boards</p><p className="mt-1 text-sm text-muted-foreground">Create a board in Board Settings to begin.</p></div></div>}
    <StartMeetingDialog open={startOpen} onOpenChange={setStartOpen} initialBoardId={board?.id} />
  </PageContainer>;
}
