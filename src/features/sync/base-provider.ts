import { db, ensureDbInitialized } from "@/db";
import { providers, syncLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ISyncProvider,
  ProviderStatus,
  SyncOptions,
  SyncResult,
  ConfigValidationResult,
  ConfigField,
} from "./types";

export abstract class BaseSyncProvider implements ISyncProvider {
  abstract id: string;
  abstract name: string;
  abstract slug: string;
  abstract icon: string;
  abstract description: string;

  protected cancellationRequested = false;

  abstract getConfigFields(): ConfigField[];
  abstract validateConfiguration(config: Record<string, any>): Promise<ConfigValidationResult>;
  abstract testConnection(config: Record<string, any>): Promise<boolean>;
  protected abstract executeSync(config: Record<string, any>, options?: SyncOptions): Promise<SyncResult>;
  abstract getStatistics(): Promise<Record<string, number | string>>;

  protected checkCancelled() {
    if (this.cancellationRequested) {
      throw new Error("Sync stopped by user.");
    }
  }

  async cancelSync(): Promise<boolean> {
    this.cancellationRequested = true;
    await ensureDbInitialized();
    const now = new Date().toISOString();

    // Mark active in-progress log as cancelled/failed
    const activeLogs = await db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.provider, this.slug))
      .limit(10);

    for (const log of activeLogs) {
      if (log.status === "in_progress") {
        const duration = log.startedAt ? Date.now() - new Date(log.startedAt).getTime() : 0;
        await db
          .update(syncLogs)
          .set({
            finishedAt: now,
            duration,
            status: "failed",
            errorMessage: "Sync stopped by user.",
          })
          .where(eq(syncLogs.id, log.id));
      }
    }

    await this.updateStatus("connected", { lastSync: now });
    return true;
  }

  async getStoredRecord() {
    await ensureDbInitialized();
    const records = await db.select().from(providers).where(eq(providers.slug, this.slug)).limit(1);
    return records[0] || null;
  }

  async getConfig(): Promise<Record<string, any>> {
    const record = await this.getStoredRecord();
    if (!record || !record.configurationJson) return {};
    try {
      return JSON.parse(record.configurationJson);
    } catch {
      return {};
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    const record = await this.getStoredRecord();
    if (!record) return "disconnected";
    if (record.enabled === 0) return "disabled";
    return record.status as ProviderStatus;
  }

  async updateStatus(status: ProviderStatus, options?: { lastSync?: string; lastSuccess?: string }) {
    await ensureDbInitialized();
    const now = new Date().toISOString();
    const existing = await this.getStoredRecord();

    const updateData: any = {
      status,
      updatedAt: now,
      ...(status === "connected" ? { connected: 1 } : {}),
      ...(status === "disconnected" ? { connected: 0 } : {}),
    };

    if (options?.lastSync) updateData.lastSync = options.lastSync;
    if (options?.lastSuccess) updateData.lastSuccess = options.lastSuccess;

    if (existing) {
      await db.update(providers).set(updateData).where(eq(providers.slug, this.slug));
    } else {
      await db.insert(providers).values({
        id: this.slug,
        name: this.name,
        slug: this.slug,
        enabled: 1,
        connected: status === "connected" ? 1 : 0,
        status,
        lastSync: options?.lastSync || null,
        lastSuccess: options?.lastSuccess || null,
        configurationJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async connect(config: Record<string, any>): Promise<boolean> {
    const validation = await this.validateConfiguration(config);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid configuration");
    }

    const testPassed = await this.testConnection(config);
    if (!testPassed) {
      throw new Error("Connection test failed. Please verify your credentials.");
    }

    await ensureDbInitialized();
    const now = new Date().toISOString();
    const existing = await this.getStoredRecord();

    if (existing) {
      await db
        .update(providers)
        .set({
          connected: 1,
          status: "connected",
          configurationJson: JSON.stringify(config),
          updatedAt: now,
        })
        .where(eq(providers.slug, this.slug));
    } else {
      await db.insert(providers).values({
        id: this.slug,
        name: this.name,
        slug: this.slug,
        enabled: 1,
        connected: 1,
        status: "connected",
        configurationJson: JSON.stringify(config),
        createdAt: now,
        updatedAt: now,
      });
    }

    return true;
  }

  async disconnect(): Promise<boolean> {
    await ensureDbInitialized();
    const now = new Date().toISOString();
    await db
      .update(providers)
      .set({
        connected: 0,
        status: "disconnected",
        updatedAt: now,
      })
      .where(eq(providers.slug, this.slug));
    return true;
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    this.cancellationRequested = false;
    const config = await this.getConfig();
    const stored = await this.getStoredRecord();
    if (!stored || stored.connected === 0) {
      throw new Error(`Provider ${this.name} is not connected.`);
    }

    const logId = `${this.slug}_${Date.now()}`;
    const startedAt = new Date().toISOString();
    const startTimeMs = Date.now();

    await this.updateStatus("syncing");

    await db.insert(syncLogs).values({
      id: logId,
      provider: this.slug,
      startedAt,
      status: "in_progress",
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      metadataJson: JSON.stringify(options || {}),
    });

    try {
      const result = await this.executeSync(config, options);
      const finishedAt = new Date().toISOString();
      const duration = Date.now() - startTimeMs;

      await db
        .update(syncLogs)
        .set({
          finishedAt,
          duration,
          status: result.success ? "success" : "failed",
          itemsCreated: result.itemsCreated,
          itemsUpdated: result.itemsUpdated,
          itemsDeleted: result.itemsDeleted,
          errorMessage: result.errorMessage || null,
          metadataJson: JSON.stringify(result.metadata || options || {}),
        })
        .where(eq(syncLogs.id, logId));

      if (result.success) {
        await this.updateStatus("connected", { lastSync: finishedAt, lastSuccess: finishedAt });
      } else {
        await this.updateStatus("error", { lastSync: finishedAt });
      }

      return result;
    } catch (err: any) {
      const finishedAt = new Date().toISOString();
      const duration = Date.now() - startTimeMs;
      const errorMessage = err.message || "Unknown error during sync";

      await db
        .update(syncLogs)
        .set({
          finishedAt,
          duration,
          status: "failed",
          errorMessage,
        })
        .where(eq(syncLogs.id, logId));

      await this.updateStatus(errorMessage.includes("stopped") ? "connected" : "error", { lastSync: finishedAt });

      return {
        success: false,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        errorMessage,
      };
    }
  }
}
