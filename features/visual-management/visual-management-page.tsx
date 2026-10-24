"use client";

import { compareNewestMeetings } from "@/lib/records/record-order";


import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CirclePlay, Layers3, Repeat2 } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { useAdminUsers } from "@/features/five-s/administration/store";
import { useActionStore } from "@/lib/actions/action-store";
import { useCurrentUser } from "@/lib/current-user";
import { visibleVisualManagementBoards, visibleVisualManagementMeetings } from "./visual-management-access";
import { BoardHealthCard, formatVmDate, MeetingStatusBadge, StartMeetingDialog, VisualManagementNav, VmMetric } from "./visual-management-components";
import { getVisualManagementMetrics, meetingDurationMinutes, useVisualManagementStore } from "./visual-management-store";

export default function VisualManagementPage() {
  const state = useVisualManagementStore();
  const actions = useActionStore();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const boards = useMemo(() => visibleVisualManagementBoards(state.boards, currentUser, adminUser?.roles), [adminUser?.roles, currentUser, state.boards]);
  const meetings = useMemo(() => visibleVisualManagementMeetings(state.meetings, state.boards, currentUser, adminUser?.roles), [adminUser?.roles, currentUser, state.boards, state.meetings]);
  const meetingIds = useMemo(() => new Set(meetings.map((meeting) => meeting.id)), [meetings]);
  const scopedState = useMemo(() => ({ ...state, boards, meetings, topics: state.topics.filter((topic) => meetingIds.has(topic.meetingId)) }), [boards, meetingIds, meetings, state]);
  const [startOpen, setStartOpen] = useState(false);
  const metrics = getVisualManagementMetrics(scopedState, actions, new Date());
  const boardMap = useMemo(() => new Map(boards.map((board) => [board.id, board])), [boards]);
  const topicCounts = Object.entries(scopedState.topics.reduce<Record<string, number>>((counts, topic) => ({ ...counts, [topic.title]: (counts[topic.title] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  return <PageContainer className="max-w-none">
    <FiveSPageHeader eyebrow="OPS WORKSPACE" title="Visual Management" description="Run daily operational meetings, review performance, track issues, and turn discussions into action." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" nativeButton={false} render={<Link href="/visual-management/boards" />}>View Boards</Button><Button onClick={() => setStartOpen(true)}><CirclePlay className="size-4" />Start Meeting</Button></div>} />
    <VisualManagementNav active="overview" />
    <section aria-label="Visual Management summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><VmMetric label="Meetings Today" value={metrics.meetingsToday} detail={`${metrics.meetingsConducted} completed overall`} tone="info" /><VmMetric label="Open Actions" value={metrics.openActions} detail="From meetings" tone={metrics.openActions ? "warning" : "success"} /><VmMetric label="Overdue Actions" value={metrics.overdueActions} detail="Past due" tone={metrics.overdueActions ? "danger" : "success"} /><VmMetric label="Red KPI Areas" value={metrics.redKpiCount} detail="Across active boards" tone={metrics.redKpiCount ? "danger" : "success"} /></section>
    <div className="grid gap-4 xl:grid-cols-12">
      <section className="xl:col-span-8"><SectionHeader icon={Layers3} title="Board Health" description="Current SQDCP condition by tier board" action={<Link href="/visual-management/boards" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">All boards <ArrowRight className="size-3.5" /></Link>} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{boards.map((board) => <BoardHealthCard key={board.id} board={board} />)}</div></section>
      <Card className="gap-0 overflow-hidden xl:col-span-4"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Recent Meetings</CardTitle><p className="text-xs text-muted-foreground">Latest tier-meeting records</p></CardHeader><CardContent className="divide-y p-0">{meetings.slice().sort(compareNewestMeetings).slice(0, 5).map((meeting) => <Link key={meeting.id} href={`/visual-management/meetings/${meeting.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{meeting.boardName ?? boardMap.get(meeting.boardId)?.name ?? meeting.boardId}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{formatVmDate(meeting.startedAt, true)} · {meetingDurationMinutes(meeting)} min</span></span><MeetingStatusBadge status={meeting.status} /></Link>)}</CardContent></Card>
      <Card className="gap-0 overflow-hidden xl:col-span-12"><CardHeader className="border-b pb-4"><CardTitle className="flex items-center gap-2 text-[15px]"><Repeat2 className="size-4 text-primary" />Recurring Topics</CardTitle></CardHeader><CardContent className="grid gap-3 p-4 sm:grid-cols-2">{topicCounts.slice(0, 4).map(([title, count]) => <div key={title} className="flex items-center gap-3"><span className="min-w-0 flex-1 truncate text-sm">{title}</span><Badge variant={count > 1 ? "warning" : "secondary"}>{count} meeting{count === 1 ? "" : "s"}</Badge></div>)}</CardContent></Card>
    </div>
    <StartMeetingDialog open={startOpen} onOpenChange={setStartOpen} />
  </PageContainer>;
}

function SectionHeader({ icon: Icon, title, description, action }: { icon: typeof Layers3; title: string; description: string; action: React.ReactNode }) { return <div className="mb-3 flex items-end justify-between gap-3"><div className="flex items-start gap-2.5"><span className="mt-0.5 grid size-8 place-items-center rounded-lg bg-primary/[0.08] text-primary"><Icon className="size-4" /></span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div></div>{action}</div>; }
