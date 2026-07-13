"use server";

import { type ShortLink, type ShortDomain, type PasteItem } from "@/db/schema";
import { revalidatePath } from "next/cache";

// Helper to get RapidLink remote API configuration
function getRapidLinkApiConfig() {
  const baseUrl = process.env.RAPIDLINK_API_URL || process.env.SHORTNER_API_URL || process.env.URL_SHORTENER_API_URL;
  const apiKey = process.env.RAPIDLINK_API_KEY || process.env.SHORTNER_API_KEY || process.env.DASHBOARD_PASSWORD;

  if (!baseUrl) return null;
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey: apiKey || "",
  };
}

export async function checkRapidLinkApiStatus() {
  const config = getRapidLinkApiConfig();
  return {
    isConfigured: Boolean(config),
    baseUrl: config?.baseUrl || null,
  };
}

async function fetchFromRapidLinkApi(endpoint: string, options: RequestInit = {}) {
  const config = getRapidLinkApiConfig();
  if (!config) {
    throw new Error(
      "RapidLink service API URL is not configured. Please set RAPIDLINK_API_URL and RAPIDLINK_API_KEY in environment variables."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const url = `${config.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text || `HTTP ${response.status} Error` };
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

// --- SHORT LINKS ---

export async function getShortLinks(): Promise<ShortLink[]> {
  try {
    const rawLinks = await fetchFromRapidLinkApi("/api/links", { method: "GET" });
    if (Array.isArray(rawLinks)) {
      return rawLinks.map((item: any) => ({
        slug: item.slug,
        url: item.url,
        createdAt: item.created_at || item.createdAt || new Date().toISOString(),
        clickCount: Number(item.click_count ?? item.clickCount ?? 0),
        hostname: item.hostname || "lnk.to",
        password: item.password || null,
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching short links from RapidLink API:", error);
    return [];
  }
}

export interface CreateShortLinkInput {
  url: string;
  slug?: string;
  hostname: string;
  password?: string;
}

export async function createShortLink(input: CreateShortLinkInput) {
  try {
    const res = await fetchFromRapidLinkApi("/api/shorten", {
      method: "POST",
      body: JSON.stringify({
        url: input.url.trim(),
        slug: input.slug?.trim() || undefined,
        hostname: input.hostname.trim(),
        password: input.password?.trim() || undefined,
      }),
    });
    revalidatePath("/links");
    const shortUrl = res.shortUrl || `https://${input.hostname.trim()}/${input.slug || ""}`;
    const slugMatch = shortUrl.split("/").pop() || input.slug || "";
    return { success: true, shortUrl, slug: slugMatch };
  } catch (error: any) {
    console.error("Error creating short link via RapidLink API:", error);
    return { success: false, error: error.message || "Failed to create short link via API." };
  }
}

export interface UpdateShortLinkInput {
  originalSlug: string;
  newSlug?: string;
  url: string;
  hostname?: string;
  password?: string | null;
}

export async function updateShortLink(input: UpdateShortLinkInput) {
  try {
    const payload: any = {
      originalSlug: input.originalSlug,
      newSlug: input.newSlug?.trim() || input.originalSlug,
      destinationUrl: input.url.trim(),
      hostname: input.hostname?.trim(),
    };
    if (input.password !== undefined) {
      payload.password = input.password;
    }
    await fetchFromRapidLinkApi("/api/links", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    revalidatePath("/links");
    return { success: true, slug: payload.newSlug };
  } catch (error: any) {
    console.error("Error updating short link via RapidLink API:", error);
    return { success: false, error: error.message || "Failed to update short link via API." };
  }
}

export async function deleteShortLink(slug: string) {
  try {
    await fetchFromRapidLinkApi("/api/links", {
      method: "DELETE",
      body: JSON.stringify({ slug }),
    });
    revalidatePath("/links");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting short link via RapidLink API:", error);
    return { success: false, error: error.message || "Failed to delete link via API." };
  }
}

// --- PASTES ---

export async function getPastes(): Promise<PasteItem[]> {
  try {
    const rawPastes = await fetchFromRapidLinkApi("/api/pastes", { method: "GET" });
    if (Array.isArray(rawPastes)) {
      return rawPastes.map((item: any) => ({
        slug: item.slug,
        content: item.content || `[Markdown Paste /p/${item.slug}]`,
        hostname: item.hostname || "lnk.to",
        password: item.hasPassword || item.password ? "hashed" : null,
        expiresAt: item.expiresAt || item.expires_at || null,
        createdAt: item.createdAt || item.created_at || new Date().toISOString(),
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching pastes from RapidLink API:", error);
    return [];
  }
}

export interface CreatePasteInput {
  content: string;
  hostname: string;
  slug?: string;
  password?: string;
  expires?: "never" | "1hour" | "1day" | "1week";
}

export async function createPaste(input: CreatePasteInput) {
  try {
    const res = await fetchFromRapidLinkApi("/api/create-paste", {
      method: "POST",
      body: JSON.stringify({
        content: input.content,
        hostname: input.hostname.trim(),
        password: input.password?.trim() || undefined,
        expires: input.expires || "never",
      }),
    });
    revalidatePath("/links");
    const pasteUrl = res.pasteUrl || `https://${input.hostname.trim()}/p/${input.slug || ""}`;
    const slugMatch = pasteUrl.split("/").pop() || input.slug || "";
    return { success: true, pasteUrl, slug: slugMatch };
  } catch (error: any) {
    console.error("Error creating paste via RapidLink API:", error);
    return { success: false, error: error.message || "Failed to create paste via API." };
  }
}

export async function deletePaste(slug: string) {
  try {
    await fetchFromRapidLinkApi("/api/pastes", {
      method: "DELETE",
      body: JSON.stringify({ slug }),
    });
    revalidatePath("/links");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting paste via RapidLink API:", error);
    return { success: false, error: error.message || "Failed to delete paste via API." };
  }
}

// --- DOMAINS ---

export async function getDomains(): Promise<ShortDomain[]> {
  try {
    const rawDomains = await fetchFromRapidLinkApi("/api/domains", { method: "GET" });
    if (Array.isArray(rawDomains)) {
      return rawDomains.map((item: any) => ({
        hostname: typeof item === "string" ? item : item.hostname,
        addedAt: item.addedAt || item.added_at || new Date().toISOString(),
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching domains from RapidLink API:", error);
    return [{ hostname: "lnk.to", addedAt: new Date().toISOString() }];
  }
}

export async function addDomain(hostname: string) {
  try {
    const cleanHost = hostname.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    await fetchFromRapidLinkApi("/api/add-domain", {
      method: "POST",
      body: JSON.stringify({ hostname: cleanHost }),
    });
    revalidatePath("/links");
    return { success: true, hostname: cleanHost };
  } catch (error: any) {
    console.error("Error adding domain via RapidLink API:", error);
    return { success: false, error: error.message || "Failed to add domain via API." };
  }
}

export async function deleteDomain(hostname: string) {
  try {
    await fetchFromRapidLinkApi("/api/domains", {
      method: "DELETE",
      body: JSON.stringify({ hostname }),
    });
    revalidatePath("/links");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting domain via RapidLink API:", error);
    return { success: false, error: error.message || "Failed to delete domain via API." };
  }
}
