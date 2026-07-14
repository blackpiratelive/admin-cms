"use server";

import { ensureDbInitialized, db } from "@/db";
import { syncLogs, providers } from "@/db/schema";
import { syncRegistry } from "./registry";
import { SyncOptions } from "./types";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface ProviderOverviewDTO {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  connected: boolean;
  status: "connected" | "disconnected" | "syncing" | "error" | "disabled";
  lastSync: string | null;
  lastSuccess: string | null;
  stats: Record<string, number | string>;
  configFields: Array<{
    name: string;
    label: string;
    type: "text" | "password";
    placeholder?: string;
    required?: boolean;
    description?: string;
  }>;
  hasConfiguredKey: boolean;
  configurationSummary: Record<string, any>;
}

export async function getProvidersOverviewAction(): Promise<ProviderOverviewDTO[]> {
  await ensureDbInitialized();
  const allProviders = syncRegistry.getAllProviders();

  const overviewList: ProviderOverviewDTO[] = [];

  for (const p of allProviders) {
    const stored = await db.select().from(providers).where(eq(providers.slug, p.slug)).limit(1);
    const dbRecord = stored[0] || null;

    let stats: Record<string, number | string> = {};
    try {
      stats = await p.getStatistics();
    } catch {
      stats = {};
    }

    let configSummary: Record<string, any> = {};
    let hasConfig = false;
    if (dbRecord?.configurationJson) {
      try {
        const parsed = JSON.parse(dbRecord.configurationJson);
        hasConfig = Object.keys(parsed).length > 0;
        // Mask passwords/secrets in returned config summary
        for (const [key, val] of Object.entries(parsed)) {
          if (typeof val === "string") {
            configSummary[key] = key.toLowerCase().includes("key") || key.toLowerCase().includes("clientid") || key.toLowerCase().includes("token")
              ? `${val.slice(0, 4)}***${val.slice(-4)}`
              : val;
          } else {
            configSummary[key] = val;
          }
        }
      } catch {}
    }

    overviewList.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      icon: p.icon,
      description: p.description,
      connected: dbRecord?.connected === 1,
      status: (dbRecord?.status as any) || "disconnected",
      lastSync: dbRecord?.lastSync || null,
      lastSuccess: dbRecord?.lastSuccess || null,
      stats,
      configFields: p.getConfigFields(),
      hasConfiguredKey: hasConfig,
      configurationSummary: configSummary,
    });
  }

  return overviewList;
}

export async function connectProviderAction(slug: string, config: Record<string, any>) {
  const provider = syncRegistry.getProvider(slug);
  if (!provider) {
    return { success: false, error: `Provider ${slug} not found.` };
  }

  try {
    await provider.connect(config);
    revalidatePath("/sync");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to connect provider." };
  }
}

export async function disconnectProviderAction(slug: string) {
  const provider = syncRegistry.getProvider(slug);
  if (!provider) {
    return { success: false, error: `Provider ${slug} not found.` };
  }

  try {
    await provider.disconnect();
    revalidatePath("/sync");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to disconnect provider." };
  }
}

export async function testProviderConnectionAction(slug: string, config: Record<string, any>) {
  const provider = syncRegistry.getProvider(slug);
  if (!provider) {
    return { success: false, error: `Provider ${slug} not found.` };
  }

  try {
    const valid = await provider.validateConfiguration(config);
    if (!valid.valid) {
      return { success: false, error: valid.error };
    }
    const testOk = await provider.testConnection(config);
    return { success: testOk, error: testOk ? undefined : "Connection test failed." };
  } catch (err: any) {
    return { success: false, error: err.message || "Connection error." };
  }
}

export async function syncProviderAction(slug: string, options?: SyncOptions) {
  const provider = syncRegistry.getProvider(slug);
  if (!provider) {
    return { success: false, error: `Provider ${slug} not found.` };
  }

  try {
    const res = await provider.sync(options);
    revalidatePath("/sync");
    return res;
  } catch (err: any) {
    revalidatePath("/sync");
    return {
      success: false,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      errorMessage: err.message || "Sync execution failed.",
    };
  }
}

export async function cancelProviderSyncAction(slug: string) {
  const provider = syncRegistry.getProvider(slug);
  if (!provider) {
    return { success: false, error: `Provider ${slug} not found.` };
  }

  try {
    await provider.cancelSync();
    revalidatePath("/sync");
    return { success: true };
  } catch (err: any) {
    revalidatePath("/sync");
    return { success: false, error: err.message || "Failed to stop sync." };
  }
}

export async function getSyncLogsAction(providerSlug?: string, page = 1, limit = 30) {
  await ensureDbInitialized();
  const offset = (page - 1) * limit;

  let query = db.select().from(syncLogs);
  if (providerSlug) {
    query = query.where(eq(syncLogs.provider, providerSlug)) as any;
  }

  const logs = await query.orderBy(desc(syncLogs.startedAt)).limit(limit).offset(offset);
  return logs;
}

export async function getSyncSummaryAction() {
  await ensureDbInitialized();
  const providersList = await getProvidersOverviewAction();
  const logs = await db.select().from(syncLogs).orderBy(desc(syncLogs.startedAt)).limit(10);

  const connectedCount = providersList.filter((p) => p.connected).length;
  const healthyCount = providersList.filter((p) => p.status === "connected").length;
  const errorCount = providersList.filter((p) => p.status === "error").length;

  return {
    totalProviders: providersList.length,
    connectedCount,
    healthyCount,
    errorCount,
    providers: providersList.map((p) => ({
      name: p.name,
      slug: p.slug,
      status: p.status,
      lastSync: p.lastSync,
    })),
    recentLogs: logs,
  };
}
