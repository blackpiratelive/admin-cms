import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Server-side proxy for Mapbox forward geocoding (Geocoding API v6).
 * Keeps MAPBOX_TOKEN secret (never exposed to the client) and normalizes the
 * response into the flat shape the Location form needs.
 *
 * GET /api/geocode?q=victoria+memorial
 */
export interface GeocodeResult {
  id: string;
  /** Best label for the place, e.g. "Victoria Memorial" */
  name: string;
  /** Full formatted address for display in the dropdown */
  label: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export async function GET(request: Request) {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Location search is not configured. Set MAPBOX_TOKEN in the environment." },
      { status: 501 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Bound the upstream call so a slow provider never blocks the CMS.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    url.searchParams.set("q", q);
    url.searchParams.set("access_token", token);
    url.searchParams.set("autocomplete", "true");
    url.searchParams.set("limit", "6");

    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Geocoding provider returned ${res.status}`, detail: detail.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = await res.json();
    const features: any[] = Array.isArray(data?.features) ? data.features : [];

    const results: GeocodeResult[] = features.map((feature, index) => {
      const props = feature?.properties ?? {};
      const context = props.context ?? {};
      const coords = props.coordinates ?? {};

      // For a city/region/country feature, that feature's own name is the
      // most specific label; fall back through the context hierarchy.
      const city = context.place?.name ?? context.locality?.name ?? undefined;
      const state = context.region?.name ?? undefined;
      const country = context.country?.name ?? undefined;

      return {
        id: props.mapbox_id ?? feature?.id ?? `geo_${index}`,
        name: props.name ?? props.name_preferred ?? q,
        label: props.full_address ?? props.place_formatted ?? props.name ?? q,
        city,
        state,
        country,
        latitude: typeof coords.latitude === "number" ? coords.latitude : undefined,
        longitude: typeof coords.longitude === "number" ? coords.longitude : undefined,
      };
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return NextResponse.json({ error: "Geocoding request timed out" }, { status: 504 });
    }
    console.error("Geocoding failed:", error);
    return NextResponse.json({ error: error?.message || "Geocoding failed" }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
