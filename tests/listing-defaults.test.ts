import { describe, expect, it } from "vitest";
import { LISTING_MAIN_ROUTES, listingReloadHref } from "@/lib/navigation/listing-defaults";
const reset = (path: string, search = "", type = "reload") => listingReloadHref(path, search, type, LISTING_MAIN_ROUTES);

describe("All listing entry and reload policy", () => {
  it.each(["/gemba", "/5s/red", "/continuous-improvement", "/audits", "/actions", "/visual-improvement", "/visual-management", "/reports"])("clears status scopes on reload of %s while retaining unrelated filters", path => {
    expect(reset(path, "?tab=overview&status=Completed&stage=completed&view=history&search=guard")).toBe(`${path}?search=guard`);
    expect(reset(path)).toBeUndefined();
  });
  it("resets separate listing routes without merging record types", () => {
    expect(reset("/5s/red/closed")).toBe("/5s/red");
    expect(reset("/5s/red/overview")).toBe("/5s/red");
    expect(reset("/visual-management/meetings", "?view=calendar")).toBe("/visual-management/boards");
  });
  it("preserves explicit navigation, history navigation and record deep links", () => {
    expect(reset("/gemba", "?tab=observations", "navigate")).toBeUndefined();
    expect(reset("/gemba", "?tab=overview", "back_forward")).toBeUndefined();
    expect(reset("/actions/ACT-001", "?tab=review")).toBeUndefined();
    expect(reset("/visual-management/boards/VM-001")).toBeUndefined();
    expect(reset("/reports/action/ACT-001")).toBeUndefined();
    expect(reset("/audits", "?audit=AUD-001")).toBeUndefined();
    expect(reset("/actions/settings")).toBeUndefined();
  });
});
