import { NextResponse, type NextRequest } from "next/server";
import { acceptsDemoCredentials, protectedDemoConfiguration } from "@/lib/demo/demo-access-server";

/** Protect the whole demo deployment, including API routes; never trust a browser demo flag. */
export function proxy(request: NextRequest) {
  const demo = protectedDemoConfiguration();
  if (!demo.enabled) return NextResponse.next();
  const headers = { "Cache-Control": "private, no-store" };
  if (!demo.configured) return new NextResponse("Protected demo access is not configured.", { status: 503, headers });
  if (!acceptsDemoCredentials(request.headers.get("authorization"))) {
    return new NextResponse("Authorized demo access is required.", { status: 401, headers: { ...headers, "WWW-Authenticate": 'Basic realm="OE Admin demo", charset="UTF-8"' } });
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
