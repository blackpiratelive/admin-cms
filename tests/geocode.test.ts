import { describe, it, expect, afterEach, vi } from "vitest";

const ROUTE = "../src/app/api/geocode/route";

async function loadGet() {
  const mod = await import(ROUTE);
  return mod.GET as (req: Request) => Promise<Response>;
}

describe("Geocode API route (Mapbox forward geocoding proxy)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.MAPBOX_TOKEN;
  });

  it("returns 501 when MAPBOX_TOKEN is not configured", async () => {
    delete process.env.MAPBOX_TOKEN;
    const GET = await loadGet();
    const res = await GET(new Request("http://localhost/api/geocode?q=kolkata"));
    expect(res.status).toBe(501);
  });

  it("returns empty results for queries shorter than 2 chars without calling the provider", async () => {
    process.env.MAPBOX_TOKEN = "test-token";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const GET = await loadGet();
    const res = await GET(new Request("http://localhost/api/geocode?q=a"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes Mapbox v6 features into flat location results", async () => {
    process.env.MAPBOX_TOKEN = "test-token";
    const mapboxPayload = {
      features: [
        {
          properties: {
            mapbox_id: "abc123",
            name: "Victoria Memorial",
            full_address: "Victoria Memorial, Kolkata, West Bengal, India",
            coordinates: { longitude: 88.3426, latitude: 22.5448 },
            context: {
              place: { name: "Kolkata" },
              region: { name: "West Bengal" },
              country: { name: "India" },
            },
          },
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(mapboxPayload), { status: 200 }))
    );

    const GET = await loadGet();
    const res = await GET(new Request("http://localhost/api/geocode?q=victoria+memorial"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      id: "abc123",
      name: "Victoria Memorial",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      latitude: 22.5448,
      longitude: 88.3426,
    });
  });

  it("surfaces a 502 when the provider responds with an error status", async () => {
    process.env.MAPBOX_TOKEN = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unauthorized", { status: 401 }))
    );

    const GET = await loadGet();
    const res = await GET(new Request("http://localhost/api/geocode?q=paris"));
    expect(res.status).toBe(502);
  });
});
