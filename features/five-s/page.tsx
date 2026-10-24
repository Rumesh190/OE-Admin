"use client";

import { newestCreatedFirst } from "@/lib/records/record-order";


import { withBusinessRecordCreation } from "@/lib/records/module-records";

import { useState } from "react";

import FiveSAuditList from "./components/FiveSAuditList";
import FiveSAuditCreate from "./components/FiveSAuditCreate";
import FiveSAuditExecution from "./components/FiveSAuditExecution";
import FiveSAuditScheduled from "./components/FiveSAuditScheduled";

import {
  createFiveSAudit,
  startScheduledFiveSAudit,
  updateScheduledFiveSAuditSetup,
  updateFiveSAudit,
  useFiveSAuditStore,
} from "@/lib/five-s/audit-store";

import type {
  FiveSAudit,
  FiveSCategory,
  FiveSQuestion,
  FiveSSection,
} from "./types/five-s";
import { referenceFields } from "@/lib/five-s/reference-guides";
import { createAuditChecklistSnapshot } from "@/features/settings/custom-audit-questions/checklist";

/* =========================================================
   5S CHECKLIST
   =========================================================
   Total questions: 39

   Sort          = 7
   Set in Order  = 9
   Shine         = 8
   Standardize   = 7
   Sustain       = 8

   Total         = 39

   Score:
   2 points per question
   Maximum score = 78
   ========================================================= */

/* =========================================================
   CREATE EMPTY 5S SECTIONS
   ========================================================= */

function createEmptyFiveSSections(): FiveSSection[] {
  const sectionDefinitions: Array<{
    category: FiveSCategory;
    description: string;
    questions: string[];
  }> = [
    {
      category: "Sort",
      description:
        "Remove unnecessary items from the workplace and keep only what is required.",
      questions: [
        "Are unnecessary materials/items removed from the workplace?",
        "Are obsolete tools/equipment identified and removed?",
        "Are excess raw materials identified and controlled?",
        "Are rejected/scrap materials segregated?",
        "Are red-tagged items properly identified?",
        "Are unused documents/forms removed?",
        "Are personal items restricted to designated locations?",
      ],
    },

    {
      category: "Set in Order",
      description:
        "Arrange required items so they are easy to identify, access, and return.",
      questions: [
        "Does every frequently used item have a designated location?",
        "Are locations clearly identified?",
        "Are tools arranged for easy retrieval?",
        "Are storage locations visually marked?",
        "Are material quantities/limits identified?",
        "Are walkways clearly marked?",
        "Are emergency equipment locations identified?",
        "Are WIP locations clearly defined?",
        "Are fixtures/jigs stored systematically?",
      ],
    },

    {
      category: "Shine",
      description:
        "Keep the workplace, equipment, and surrounding areas clean and maintained.",
      questions: [
        "Is the workplace clean?",
        "Are machines/equipment free from excessive dirt/oil?",
        "Are cleaning responsibilities defined?",
        "Are cleaning schedules available?",
        "Are leaks/spills addressed immediately?",
        "Are cleaning tools properly stored?",
        "Does cleaning include inspection for abnormalities?",
        "Are waste bins properly maintained?",
      ],
    },

    {
      category: "Standardize",
      description:
        "Establish consistent standards for workplace organization and cleanliness.",
      questions: [
        "Are 5S standards displayed at the workplace?",
        "Are cleaning standards defined?",
        "Are responsibilities clearly assigned?",
        "Are standard photographs available?",
        "Are visual management standards followed?",
        "Are abnormal conditions clearly identified?",
        "Are standards periodically reviewed?",
      ],
    },

    {
      category: "Sustain",
      description:
        "Maintain 5S practices through discipline, monitoring, and continual improvement.",
      questions: [
        "Are employees following defined 5S standards?",
        "Are previous audit findings closed?",
        "Are repeat findings controlled?",
        "Are periodic 5S audits conducted?",
        "Are employees trained in 5S?",
        "Are improvement ideas encouraged?",
        "Is 5S performance communicated to employees?",
        "Are 5S responsibilities actively maintained?",
      ],
    },
  ];

  const createdAt = Date.now();

  return sectionDefinitions.map(
    (section, sectionIndex) => {
      const questions: FiveSQuestion[] =
        section.questions.map(
          (questionText, questionIndex) => ({
            id: `Q-${createdAt}-${sectionIndex}-${questionIndex + 1}`,
            category: section.category,
            question: questionText,
            description:
              "Assess the workplace against the defined 5S requirement.",
            maxScore: 2,
            score: null,
            status: "Not Started",
            observation: "",
            evidence: [],
            actionRequired: false,
            ...referenceFields(section.category, questionIndex),
          })
        );

      return {
        category: section.category,
        description: section.description,
        questions,
        score: 0,
        maxScore: questions.reduce(
          (total, question) =>
            total + question.maxScore,
          0
        ),
      };
    }
  );
}
/* =========================================================
   PAGE
   ========================================================= */

export default function FiveSPage() {
  const audits =
    newestCreatedFirst(useFiveSAuditStore());

  const [
    selectedAudit,
    setSelectedAudit,
  ] = useState<FiveSAudit | null>(
    null
  );

  const [
    isCreatingAudit,
    setIsCreatingAudit,
  ] = useState(false);

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
    const sections = createAuditChecklistSnapshot(createEmptyFiveSSections());

    const audit =
      await withBusinessRecordCreation(() => createFiveSAudit({
        title: input.title,

        plant: input.plant,

        department:
          input.department,

        area: input.area,

        auditor: input.auditor,

        dueDate: input.dueDate,

        scheduledDate: input.scheduledDate,

        scheduledTime: input.scheduledTime,

        sections,
      }, { startNow: input.startNow }));

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
    const startedAudit = startScheduledFiveSAudit(audit.id);
    if (startedAudit) setSelectedAudit(startedAudit);
  }

  function handleUpdateScheduledAudit(audit: FiveSAudit, updates: Pick<FiveSAudit, "dueDate" | "scheduledDate" | "scheduledTime">) {
    const updatedAudit = updateScheduledFiveSAuditSetup(audit.id, updates);
    if (updatedAudit) setSelectedAudit(updatedAudit);
    return updatedAudit;
  }

  /* =======================================================
     UPDATE AUDIT
     ======================================================= */

  /* =======================================================
     DELETE AUDIT
     ======================================================= */

  /* =======================================================
     COMPLETE AUDIT
     ======================================================= */

  function handleCompleteAudit(
    completedAudit: FiveSAudit
  ) {
    updateFiveSAudit(
      completedAudit.id,
      completedAudit
    );

    setSelectedAudit(null);

    setIsCreatingAudit(false);
  }

  /* =======================================================
     BACK
     ======================================================= */

  function handleBackToDashboard() {
    setSelectedAudit(null);

    setIsCreatingAudit(false);
  }

  /* =======================================================
     CREATE SCREEN
     ======================================================= */

  if (isCreatingAudit) {
    return (
      <FiveSAuditCreate
        onBack={
          handleBackToDashboard
        }
        onStart={
          handleCreateAudit
        }
      />
    );
  }

  /* =======================================================
     AUDIT EXECUTION
     ======================================================= */

  if (selectedAudit) {
    if (selectedAudit.status === "Scheduled") {
      return <FiveSAuditScheduled audit={selectedAudit} onBack={handleBackToDashboard} onStart={handleStartScheduledAudit} onUpdate={handleUpdateScheduledAudit} />;
    }
    return (
      <div className="grid gap-6">
        <FiveSAuditExecution
          audit={selectedAudit}
          onBack={
            handleBackToDashboard
          }
          onComplete={
            handleCompleteAudit
          }
        />
      </div>
    );
  }

  /* =======================================================
     5S AUDIT LIST
     ======================================================= */

  return (
    <div className="flex flex-1 flex-col px-6 py-6 lg:px-8">
      <FiveSAuditList
        audits={audits}
        onStartAudit={
          handleStartAudit
        }
        onViewAudit={
          handleViewAudit
        }
        onStartScheduledAudit={handleStartScheduledAudit}
      />
    </div>
  );
}
