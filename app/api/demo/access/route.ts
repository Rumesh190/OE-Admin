import { NextResponse, type NextRequest } from "next/server";
import { acceptsDemoCredentials, protectedDemoConfiguration } from "@/lib/demo/demo-access-server";

export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  const config = protectedDemoConfiguration();
  const enabled = config.enabled ? config.configured && acceptsDemoCredentials(request.headers.get("authorization")) : process.env.NODE_ENV === "development";
  return NextResponse.json({ enabled }, { headers: { "Cache-Control": "private, no-store" } });
}
