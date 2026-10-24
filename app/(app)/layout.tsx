import { AccessContextBoundary } from "@/components/ops/access-context-boundary";
import { AdministrationSubjectBoundary } from "@/components/ops/administration-subject-boundary";
import { OperationalRecordBoundary } from "@/components/ops/operational-record-boundary";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";

// Wraps the standalone 5S workspace and profile route in the shared
// application shell. The route group keeps this layout out of the URL and
// leaves room for future authentication routes outside the product shell.
export default function AppRouteGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthGate><AppShell><AccessContextBoundary><AdministrationSubjectBoundary><OperationalRecordBoundary>{children}</OperationalRecordBoundary></AdministrationSubjectBoundary></AccessContextBoundary></AppShell></AuthGate>;
}
