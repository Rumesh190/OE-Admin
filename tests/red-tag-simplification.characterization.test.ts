import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { RED_TAG_REASON_GROUPS } from "@/features/five-s/red-tag/types";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Change Log 2 Red Tag simplification", () => {

  it("provides the standard Red Tag navigation and coming-soon settings", () => {
    const nav = source("features/five-s/red-tag/red-tag-nav.tsx");
    for (const label of ["Overview", "All", "Under Review", "Awaiting Closure", "Closed", "Settings"]) expect(nav).toContain(`label: "${label}"`);
    expect(source("app/(app)/5s/red/settings/page.tsx")).toContain("Settings coming soon");
  });

  it("uses the exact categorized reason model", () => {
    expect(RED_TAG_REASON_GROUPS).toEqual({
      Identification: ["Unidentified item", "No/incorrect labelling", "Unclear ownership", "Unknown quantity"],
      Organization: ["Wrong location", "Mixed materials", "Duplicate items", "No defined storage location"],
      Usage: ["Unused", "Obsolete", "Excess", "Damaged", "Expired"],
      "Inventory / Waste": ["Excess inventory", "Scrap/waste", "Redundant item"],
      Other: ["Free Text"],
    });
  });

  it("removes creator location/value inputs and retains camera-based photo identification", () => {
    const redTagSource = source("features/five-s/red-tag/red-tag-module.tsx");
    expect(redTagSource).not.toContain('<Field label="Location"><Input required');
    expect(redTagSource).not.toContain('<Field label="Estimated Value (optional)">');
    expect(redTagSource).toContain("Photo Identification");
    expect(redTagSource).toContain("OpsCameraCapture");
    expect(redTagSource).toContain("createAndSubmitRedTagV2");
  });

  it("uses one persistent form action and one canonical creation path", () => {
    const redTagSource = source("features/five-s/red-tag/red-tag-module.tsx");
    expect(redTagSource).not.toContain('actions={<><Button variant="ghost"');
    expect(redTagSource).toContain("<PageFormActionBar");
    expect(redTagSource).toContain('primaryType="submit"');
    expect(redTagSource).toContain('onSubmit={(e) => { e.preventDefault(); submit(); }}');
    expect(redTagSource).not.toContain("disabled={!canSubmit}");
    expect(redTagSource).toContain("if (creatingRef.current || processingPhotosRef.current) return");
    expect(redTagSource).toContain("creatingRef.current = true");
    expect(redTagSource.match(/createAndSubmitRedTagV2\(/g)).toHaveLength(1);
  });

  it("explains required fields and navigates to the first invalid control", () => {
    const redTagSource = source("features/five-s/red-tag/red-tag-module.tsx");
    for (const message of ["Enter an item name.", "Select a tagging category.", "Enter the tagging reason.", "Add a photo to create this Red Tag."]) expect(redTagSource).toContain(message);
    expect(redTagSource).toContain("target?.scrollIntoView");
    expect(redTagSource).toContain("target?.focus({ preventScroll: true })");
    expect(redTagSource).toContain("aria-invalid=");
    expect(redTagSource).toContain("aria-describedby=");
  });

  it("uses direct free text for Other without rendering a redundant reason choice", () => {
    const redTagSource = source("features/five-s/red-tag/red-tag-module.tsx");
    expect(redTagSource).toContain('setReason(option === "Other" ? "Free Text" : "")');
    expect(redTagSource).toContain('reasonCategory && reasonCategory !== "Other"');
    expect(redTagSource).toContain('reasonCategory === "Other" && <Field label="Reason *"');
    expect(redTagSource).toContain('placeholder="Describe the tagging reason..."');
    expect(redTagSource).toContain("getRedTagReasonDisplay(tag.reason, tag.customReason)");
    expect(redTagSource).toContain("sourceEvidenceCount: getRedTagIdentificationEvidence(tag).length");
  });

  it("uses canonical linked Actions with self-assignment instead of direct handling", () => {
    const redTagSource = source("features/five-s/red-tag/red-tag-module.tsx");
    expect(redTagSource).not.toContain("Handle directly");
    expect(redTagSource).not.toContain('chooseHandling("direct")');
    expect(source("features/actions/create-linked-action-dialog.tsx")).toContain("Assign to me");
    expect(redTagSource).toContain("Create Linked Action");
    expect(redTagSource).toContain('source: "Red Tag", sourceModule: "redTag", sourceId: tag.id');
    expect(redTagSource).toContain("incompleteLinkedAction");
  });

  it("places review and decision before the consolidated disposition outcome", () => {
    const redTagSource = source("features/five-s/red-tag/red-tag-module.tsx");
    expect(redTagSource.indexOf("<RedTagReviewDecisionSection")).toBeLessThan(
      redTagSource.indexOf("<RedTagDispositionSection"),
    );
    expect(redTagSource).toContain("Disposition Outcome");
  });
});
