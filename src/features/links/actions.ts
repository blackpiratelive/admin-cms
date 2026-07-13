"use server";

import { db, ensureDbInitialized } from "@/db";
import { links, domains, pastes, type ShortLink, type ShortDomain, type PasteItem } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

// Helper to generate a 7-character random slug
function generateShortSlug(length = 7): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --- SHORT LINKS ---

export async function getShortLinks(): Promise<ShortLink[]> {
  try {
    await ensureDbInitialized();
    return await db.select().from(links).orderBy(desc(links.createdAt));
  } catch (error) {
    console.error("Error fetching short links:", error);
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
    await ensureDbInitialized();
    let { url, slug, hostname, password } = input;
    url = url.trim();
    hostname = hostname.trim();

    if (!url || !hostname) {
      return { success: false, error: "Destination URL and domain are required." };
    }

    let finalSlug = slug ? slug.trim() : "";
    if (finalSlug) {
      const existing = await db.select().from(links).where(eq(links.slug, finalSlug));
      if (existing.length > 0) {
        return { success: false, error: `Slug "${finalSlug}" is already in use.` };
      }
    } else {
      let attempts = 0;
      do {
        finalSlug = generateShortSlug(7);
        const existing = await db.select().from(links).where(eq(links.slug, finalSlug));
        if (existing.length === 0) break;
        attempts++;
      } while (attempts < 10);
    }

    let hashedPassword: string | null = null;
    if (password && password.trim() !== "") {
      const salt = bcrypt.genSaltSync(10);
      hashedPassword = bcrypt.hashSync(password.trim(), salt);
    }

    const now = new Date().toISOString();
    await db.insert(links).values({
      slug: finalSlug,
      url,
      hostname,
      password: hashedPassword,
      clickCount: 0,
      createdAt: now,
    });

    revalidatePath("/links");
    return {
      success: true,
      shortUrl: `https://${hostname}/${finalSlug}`,
      slug: finalSlug,
    };
  } catch (error: any) {
    console.error("Error creating short link:", error);
    return { success: false, error: error.message || "Failed to create short link." };
  }
}

export interface UpdateShortLinkInput {
  originalSlug: string;
  newSlug?: string;
  url: string;
  hostname?: string;
  password?: string | null; // null to clear, string to set, undefined to keep existing
}

export async function updateShortLink(input: UpdateShortLinkInput) {
  try {
    await ensureDbInitialized();
    const { originalSlug, newSlug, url, hostname, password } = input;

    if (!originalSlug || !url) {
      return { success: false, error: "Original slug and URL are required." };
    }

    const targetSlug = newSlug && newSlug.trim() !== "" ? newSlug.trim() : originalSlug;

    if (targetSlug !== originalSlug) {
      const existing = await db.select().from(links).where(eq(links.slug, targetSlug));
      if (existing.length > 0) {
        return { success: false, error: `Slug "${targetSlug}" is already in use.` };
      }
    }

    const updateData: Partial<typeof links.$inferInsert> = {
      url: url.trim(),
      slug: targetSlug,
    };

    if (hostname) {
      updateData.hostname = hostname.trim();
    }

    if (password !== undefined) {
      if (password && password.trim() !== "") {
        const salt = bcrypt.genSaltSync(10);
        updateData.password = bcrypt.hashSync(password.trim(), salt);
      } else {
        updateData.password = null;
      }
    }

    await db.update(links).set(updateData).where(eq(links.slug, originalSlug));

    revalidatePath("/links");
    return { success: true, slug: targetSlug };
  } catch (error: any) {
    console.error("Error updating short link:", error);
    return { success: false, error: error.message || "Failed to update short link." };
  }
}

export async function deleteShortLink(slug: string) {
  try {
    await ensureDbInitialized();
    await db.delete(links).where(eq(links.slug, slug));
    revalidatePath("/links");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting short link:", error);
    return { success: false, error: error.message || "Failed to delete link." };
  }
}

// --- PASTES ---

export async function getPastes(): Promise<PasteItem[]> {
  try {
    await ensureDbInitialized();
    return await db.select().from(pastes).orderBy(desc(pastes.createdAt));
  } catch (error) {
    console.error("Error fetching pastes:", error);
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
    await ensureDbInitialized();
    const { content, hostname, slug, password, expires } = input;

    if (!content || !content.trim() || !hostname) {
      return { success: false, error: "Content and domain are required." };
    }

    let finalSlug = slug ? slug.trim() : "";
    if (finalSlug) {
      const existing = await db.select().from(pastes).where(eq(pastes.slug, finalSlug));
      if (existing.length > 0) {
        return { success: false, error: `Paste slug "${finalSlug}" is already in use.` };
      }
    } else {
      let attempts = 0;
      do {
        finalSlug = generateShortSlug(10).toLowerCase();
        const existing = await db.select().from(pastes).where(eq(pastes.slug, finalSlug));
        if (existing.length === 0) break;
        attempts++;
      } while (attempts < 10);
    }

    let hashedPassword: string | null = null;
    if (password && password.trim() !== "") {
      const salt = bcrypt.genSaltSync(10);
      hashedPassword = bcrypt.hashSync(password.trim(), salt);
    }

    let expiresAt: string | null = null;
    if (expires && expires !== "never") {
      const now = new Date();
      if (expires === "1hour") now.setHours(now.getHours() + 1);
      if (expires === "1day") now.setDate(now.getDate() + 1);
      if (expires === "1week") now.setDate(now.getDate() + 7);
      expiresAt = now.toISOString();
    }

    const now = new Date().toISOString();
    await db.insert(pastes).values({
      slug: finalSlug,
      content,
      hostname: hostname.trim(),
      password: hashedPassword,
      expiresAt,
      createdAt: now,
    });

    revalidatePath("/links");
    return {
      success: true,
      pasteUrl: `https://${hostname.trim()}/p/${finalSlug}`,
      slug: finalSlug,
    };
  } catch (error: any) {
    console.error("Error creating paste:", error);
    return { success: false, error: error.message || "Failed to create paste." };
  }
}

export async function deletePaste(slug: string) {
  try {
    await ensureDbInitialized();
    await db.delete(pastes).where(eq(pastes.slug, slug));
    revalidatePath("/links");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting paste:", error);
    return { success: false, error: error.message || "Failed to delete paste." };
  }
}

// --- DOMAINS ---

export async function getDomains(): Promise<ShortDomain[]> {
  try {
    await ensureDbInitialized();
    const result = await db.select().from(domains).orderBy(domains.addedAt);
    if (result.length === 0) {
      const defaultHost = process.env.SHORTNER_DEFAULT_DOMAIN || "lnk.to";
      const now = new Date().toISOString();
      await db.insert(domains).values({ hostname: defaultHost, addedAt: now });
      return [{ hostname: defaultHost, addedAt: now }];
    }
    return result;
  } catch (error) {
    console.error("Error fetching domains:", error);
    return [{ hostname: "lnk.to", addedAt: new Date().toISOString() }];
  }
}

export async function addDomain(hostname: string) {
  try {
    await ensureDbInitialized();
    const cleanHost = hostname.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!cleanHost) {
      return { success: false, error: "Invalid domain name." };
    }

    const existing = await db.select().from(domains).where(eq(domains.hostname, cleanHost));
    if (existing.length > 0) {
      return { success: false, error: `Domain "${cleanHost}" already exists.` };
    }

    const now = new Date().toISOString();
    await db.insert(domains).values({ hostname: cleanHost, addedAt: now });

    revalidatePath("/links");
    return { success: true, hostname: cleanHost };
  } catch (error: any) {
    console.error("Error adding domain:", error);
    return { success: false, error: error.message || "Failed to add domain." };
  }
}

export async function deleteDomain(hostname: string) {
  try {
    await ensureDbInitialized();
    const domainCount = await db.select({ value: count() }).from(domains);
    if (domainCount[0]?.value <= 1) {
      return { success: false, error: "Cannot delete the last domain." };
    }

    await db.delete(domains).where(eq(domains.hostname, hostname));

    revalidatePath("/links");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting domain:", error);
    return { success: false, error: error.message || "Failed to delete domain." };
  }
}
