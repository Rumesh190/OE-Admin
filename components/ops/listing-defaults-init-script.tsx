import { LISTING_MAIN_ROUTES, listingReloadHref } from "@/lib/navigation/listing-defaults";

/** Runs before application markup: no stale selected tab is painted or hydrated on reload. */
export function ListingDefaultsInitScript() {
  const script = `(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const target = (${listingReloadHref.toString()})(location.pathname, location.search, navigation?.type, ${JSON.stringify(LISTING_MAIN_ROUTES)});
    if (target) {
      document.documentElement.style.visibility = "hidden";
      location.replace(target);
    }
  })();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
