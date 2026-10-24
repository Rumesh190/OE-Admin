"use client";

import { getActiveAccessContext } from "./administration/access-v4-context";
import { newestCreatedFirst } from "@/lib/records/record-order";


import { withBusinessRecordCreation } from "@/lib/records/module-records";

import { useState } from "react";

import FiveSAuditList from "./components/FiveSAuditList";
import { canReadScopedAudit, canExecuteScopedAudit, requiresScopedAuditPolicy } from "@/lib/five-s/audit-authorization";
import { Button } from "@/components/ui/button";
import FiveSAuditCreate from "./components/FiveSAuditCreate";
import FiveSAuditExecution from "./components/FiveSAuditExecution";
import FiveSAuditScheduled from "./components/FiveSAuditScheduled";
import FiveSAuditReport from "./components/FiveSAuditReport";
import { PageContainer } from "@/components/layout/page-container";

import {
  createFiveSAudit,
  startScheduledFiveSAudit,
  updateScheduledFiveSAuditSetup,
  useFiveSAuditStore,
} from "@/lib/five-s/audit-store";

import type {
  FiveSAudit,
  FiveSCategory,
  FiveSQuestion,
  FiveSSection,
} from "./types/five-s";
import { FIVE_S_QUESTIONS } from "@/features/settings/standard-audit-checklist/defaults";
import { referenceFields } from "@/lib/five-s/reference-guides";
import { createAuditChecklistSnapshot } from "@/features/settings/custom-audit-questions/checklist";

/* =========================================================
   5S CHECKLIST
   ========================================================= */



/* =========================================================
   CREATE SECTIONS
   ========================================================= */

function createEmptyFiveSSections(): FiveSSection[] {
  const categories: FiveSCategory[] = [
    "Sort",
    "Set in Order",
    "Shine",
    "Standardize",
    "Sustain",
  ];

  const createdAt = Date.now();

  return categories.map((category, sectionIndex) => {
    const questions: FiveSQuestion[] =
      FIVE_S_QUESTIONS[category].map(
        (questionText, questionIndex) => ({
          id: `Q-${createdAt}-${sectionIndex}-${questionIndex + 1}`,

          category,

          question: questionText,

          description:
            "Assess the workplace against the defined 5S requirement.",

          maxScore: 2,

          score: null,

          status: "Not Started",

          observation: "",

          evidence: [],

          actionRequired: false,
          ...referenceFields(category, questionIndex),
        })
      );

    return {
      category,

      description: getCategoryDescription(category),

      questions,

      score: 0,

      maxScore: questions.reduce(
        (total, question) =>
          total + question.maxScore,
        0
      ),
    };
  });
}

/* =========================================================
   CATEGORY DESCRIPTION
   ========================================================= */

function getCategoryDescription(
  category: FiveSCategory
): string {
  const descriptions: Record<FiveSCategory, string> = {
    Sort:
      "Remove unnecessary items from the workplace and keep only what is required.",

    "Set in Order":
      "Arrange required items so they are easy to identify, access, and return.",

    Shine:
      "Keep the workplace, equipment, and surrounding areas clean and maintained.",

    Standardize:
      "Establish consistent standards for workplace organization and cleanliness.",

    Sustain:
      "Maintain 5S practices through discipline, monitoring, and continual improvement.",
  };

  return descriptions[category];
}

/* =========================================================
   PAGE
   ========================================================= */

export default function FiveSAuditListPage({ initialAuditId }: { initialAuditId?: string } = {}) {
  const audits = newestCreatedFirst(useFiveSAuditStore());

  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(initialAuditId ?? null);
  const selectedAudit = audits.find(a => a.id === selectedAuditId) ?? null;
  function setSelectedAudit(audit: FiveSAudit | null) { setSelectedAuditId(audit?.id ?? null); }

  const [isCreatingAudit, setIsCreatingAudit] =
    useState(false);

  /* =======================================================
     START AUDIT
     ======================================================= */

  function handleStartAudit() {
    setSelectedAudit(null);
    setIsCreatingAudit(true);
  }

  /* =======================================================
     CREATE AUDIT
     ======================================================= */

  async function handleCreateAudit(input: {
    organizationId?: string; plantId?: string; zoneId?: string; assignedAuditorId?: string; departmentId?: string; expectedContextSelectionId?: string;
    title: string;
    plant: string;
    department: string;
    area: string;
    auditor: string;
    dueDate: string;
    startNow: boolean;
    scheduledDate?: string;
    scheduledTime?: string;
  }) {
    const sections = createAuditChecklistSnapshot(createEmptyFiveSSections(), undefined, input.organizationId).map(section => ({ ...section, questions: section.questions.map(q => input.departmentId ? { ...q, departmentId: input.departmentId } : q) }));

    const audit =
      await withBusinessRecordCreation(() => createFiveSAudit({
        organizationId: input.organizationId, plantId: input.plantId, zoneId: input.zoneId, assignedAuditorId: input.assignedAuditorId,
        title: input.title,
        plant: input.plant,
        department: input.department,
        area: input.area,
        auditor: input.auditor,
        dueDate: input.dueDate,
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime,
        sections,
      }, { startNow: input.startNow, expectedContextSelectionId: input.expectedContextSelectionId }));

    setIsCreatingAudit(false);
    setSelectedAudit(audit);
  }

  /* =======================================================
     VIEW AUDIT
     ======================================================= */

  function handleViewAudit(
    audit: FiveSAudit
  ) {
    setIsCreatingAudit(false);
    setSelectedAudit(audit);
  }

  function handleStartScheduledAudit(audit: FiveSAudit) {
    const startedAudit = startScheduledFiveSAudit(audit.id, new Date(), audit.policyVersion ? { selectionId: getActiveAccessContext()?.selectionId ?? "", revision: audit.revision! } : undefined);
    if (startedAudit) setSelectedAudit(startedAudit);
  }

  function handleUpdateScheduledAudit(audit: FiveSAudit, updates: Pick<FiveSAudit, "dueDate" | "scheduledDate" | "scheduledTime">) {
    const updatedAudit = updateScheduledFiveSAuditSetup(audit.id, updates, new Date(), audit.policyVersion ? { selectionId: getActiveAccessContext()?.selectionId ?? "", revision: audit.revision! } : undefined);
    if (updatedAudit) setSelectedAudit(updatedAudit);
    return updatedAudit;
  }

  /* =======================================================
     DELETE AUDIT
     ======================================================= */

  /* =======================================================
     COMPLETE AUDIT
     ======================================================= */

  function handleCompleteAudit() {
    // The execution component is responsible
    // for updating the audit during assessment.
    // Returning here simply closes the execution view.
    setSelectedAudit(null);
    setIsCreatingAudit(false);
  }

  /* =======================================================
     BACK
     ======================================================= */

  function handleBack() {
    setSelectedAudit(null);
    setIsCreatingAudit(false);
  }

  /* =======================================================
     CREATE
     ======================================================= */

  if (isCreatingAudit) {
    return (
      <FiveSAuditCreate
        onBack={handleBack}
        onStart={handleCreateAudit}
      />
    );
  }

  /* =======================================================
     EXECUTION
     ======================================================= */

  if (selectedAuditId && !selectedAudit) return <PageContainer><h1 className="text-lg font-semibold">Audit unavailable</h1><p className="mt-3 text-sm">This audit is unavailable in your current scope.</p><Button className="mt-4" onClick={handleBack}>Back to audits</Button></PageContainer>;
  if (selectedAudit) {
    const currentAudit = audits.find(a => a.id === selectedAudit.id);
    if (!currentAudit || !canReadScopedAudit(currentAudit)) return <PageContainer><p>Audit unavailable in your current scope.</p><Button onClick={handleBack}>Back to audits</Button></PageContainer>;
    if (requiresScopedAuditPolicy(currentAudit) && currentAudit.status !== "Completed" && !canExecuteScopedAudit(currentAudit, undefined, currentAudit.status === "Scheduled" ? "start" : "edit")) return <FiveSAuditReport auditId={currentAudit.id} />;
    if (selectedAudit.status === "Scheduled") {
      return <FiveSAuditScheduled audit={currentAudit} onBack={handleBack} onStart={handleStartScheduledAudit} onUpdate={handleUpdateScheduledAudit} />;
    }
    return (
      <div className="grid gap-6">
        <FiveSAuditExecution
          key={`${currentAudit.id}:${currentAudit.assignedAuditorId ?? "legacy"}`}
          audit={currentAudit}
          onBack={handleBack}
          onComplete={handleCompleteAudit}
        />
      </div>
    );
  }

  /* =======================================================
     LISTING
     ======================================================= */

  return (
    <PageContainer>
      <FiveSAuditList
        audits={audits}
        onStartAudit={handleStartAudit}
        onViewAudit={handleViewAudit}
        onStartScheduledAudit={handleStartScheduledAudit}
      />
    </PageContainer>
  );
}
