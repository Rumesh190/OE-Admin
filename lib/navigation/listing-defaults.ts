/** Only listing routes belong here. Record, settings and report document URLs are excluded. */
export const LISTING_MAIN_ROUTES: Record<string, string> = {
  "/gemba": "/gemba",
  "/5s/red": "/5s/red",
  "/5s/red/overview": "/5s/red",
  "/5s/red/awaiting-closure": "/5s/red",
  "/5s/red/closed": "/5s/red",
  "/continuous-improvement": "/continuous-improvement",
  "/audits": "/audits",
  "/5s/audits": "/5s/audits",
  "/5s/listing": "/5s/listing",
  "/actions": "/actions",
  "/5s/actions": "/5s/actions",
  "/visual-improvement": "/visual-improvement",
  "/visual-management": "/visual-management",
  "/visual-management/boards": "/visual-management/boards",
  "/visual-management/meetings": "/visual-management/boards",
  "/reports": "/reports",
};

/** Pure, self-contained function, also serialized into the pre-render document initializer. */
export function listingReloadHref(pathname: string, search: string, navigationType: string | undefined, routes: Record<string, string>): string | undefined {
  if (navigationType !== "reload" || !Object.prototype.hasOwnProperty.call(routes, pathname)) return;
  const params = new URLSearchParams(search);
  // Audit selection is a supported record deep link, not a listing preference.
  if (params.has("audit")) return;
  for (const key of ["tab", "view", "status", "stage", "due", "walk-status", "module"]) params.delete(key);
  const href = routes[pathname] + (params.size ? `?${params}` : "");
  return href === pathname + search ? undefined : href;
}
