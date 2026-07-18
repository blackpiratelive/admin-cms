"use server";

import { db, ensureDbInitialized } from "@/db";
import {
  journalEntries,
  journalRevisions,
  journalSettings,
  journalKeys,
  JournalEntryRecord,
  JournalRevisionRecord,
  JournalSettingsRecord,
  JournalKeyRecord,
  gallery,
  traktMovies,
  lastfmScrobbles,
  microblogs,
  locations,
  trips,
  persons,
  projects,
  relationships,
} from "@/db/schema";
import { desc, eq, and, or, gte, lte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/features/activity/actions";
import { addRelationship } from "@/features/relationships/actions";
import { createCachedQuery, purgeTag } from "@/lib/server-cache";
import { eventBus } from "@/lib/event-bus";

// --- DEK / KEK JOURNAL KEY ACTIONS ---

async function fetchJournalKeyRecordRaw(): Promise<JournalKeyRecord | null> {
  await ensureDbInitialized();
  const rows = await db.select().from(journalKeys).where(eq(journalKeys.id, "default")).limit(1);
  return rows[0] || null;
}

export async function getJournalKeyRecord(): Promise<JournalKeyRecord | null> {
  const cachedFn = createCachedQuery(
    fetchJournalKeyRecordRaw,
    ["journal-key-record"],
    { tags: ["journal-keys"], revalidate: 3600 }
  );
  return cachedFn();
}

export async function saveJournalKeyRecord(data: {
  encryptedDek: string;
  salt: string;
  iv: string;
  algorithm?: string;
  kdf?: string;
  argonMemory?: number;
  argonIterations?: number;
  argonParallelism?: number;
  keyVersion?: number;
}): Promise<JournalKeyRecord> {
  await ensureDbInitialized();
  const now = new Date().toISOString();

  const existing = await getJournalKeyRecord();

  if (existing) {
    await db
      .update(journalKeys)
      .set({
        encryptedDek: data.encryptedDek,
        salt: data.salt,
        iv: data.iv,
        algorithm: data.algorithm || existing.algorithm,
        kdf: data.kdf || existing.kdf,
        argonMemory: data.argonMemory ?? existing.argonMemory,
        argonIterations: data.argonIterations ?? existing.argonIterations,
        argonParallelism: data.argonParallelism ?? existing.argonParallelism,
        keyVersion: data.keyVersion ?? existing.keyVersion,
        updatedAt: now,
      })
      .where(eq(journalKeys.id, "default"));
  } else {
    await db.insert(journalKeys).values({
      id: "default",
      encryptedDek: data.encryptedDek,
      salt: data.salt,
      iv: data.iv,
      algorithm: data.algorithm || "AES-256-GCM",
      kdf: data.kdf || "Argon2id",
      argonMemory: data.argonMemory ?? 65536,
      argonIterations: data.argonIterations ?? 3,
      argonParallelism: data.argonParallelism ?? 1,
      keyVersion: data.keyVersion ?? 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  purgeTag("journal-keys");
  revalidatePath("/journal");
  const updated = await getJournalKeyRecord();
  return updated!;
}

// --- SETTINGS ACTIONS ---

async function fetchJournalSettingsRaw(): Promise<JournalSettingsRecord | null> {
  await ensureDbInitialized();
  const rows = await db.select().from(journalSettings).where(eq(journalSettings.id, "default")).limit(1);
  return rows[0] || null;
}

export async function getJournalSettings(): Promise<JournalSettingsRecord | null> {
  const cachedFn = createCachedQuery(
    fetchJournalSettingsRaw,
    ["journal-settings-record"],
    { tags: ["journal-settings"], revalidate: 3600 }
  );
  return cachedFn();
}

export async function saveJournalSettings(data: {
  salt: string;
  verificationPayload: string;
  verificationIv: string;
  autoLockMinutes?: number;
}): Promise<JournalSettingsRecord> {
  await ensureDbInitialized();
  const now = new Date().toISOString();

  const existing = await getJournalSettings();

  if (existing) {
    await db
      .update(journalSettings)
      .set({
        salt: data.salt,
        verificationPayload: data.verificationPayload,
        verificationIv: data.verificationIv,
        autoLockMinutes: data.autoLockMinutes ?? existing.autoLockMinutes,
        updatedAt: now,
      })
      .where(eq(journalSettings.id, "default"));
  } else {
    await db.insert(journalSettings).values({
      id: "default",
      salt: data.salt,
      verificationPayload: data.verificationPayload,
      verificationIv: data.verificationIv,
      autoLockMinutes: data.autoLockMinutes ?? 15,
      updatedAt: now,
    });
  }

  purgeTag("journal-settings");
  revalidatePath("/journal");
  const updated = await getJournalSettings();
  return updated!;
}

export async function updateAutoLockMinutes(autoLockMinutes: number): Promise<void> {
  await ensureDbInitialized();
  await db
    .update(journalSettings)
    .set({
      autoLockMinutes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(journalSettings.id, "default"));

  purgeTag("journal-settings");
  revalidatePath("/journal");
}

// --- JOURNAL ENTRIES ACTIONS ---

async function fetchJournalEntriesRaw(): Promise<JournalEntryRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(journalEntries)
    .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt));
}

export async function getJournalEntries(): Promise<JournalEntryRecord[]> {
  const cachedFn = createCachedQuery(
    fetchJournalEntriesRaw,
    ["journal-entries-list"],
    { tags: ["journal-entries-list"], revalidate: 3600 }
  );

  return cachedFn();
}

async function fetchJournalEntryByIdOrSlugRaw(idOrSlug: string): Promise<JournalEntryRecord | null> {
  await ensureDbInitialized();
  const byId = await db.select().from(journalEntries).where(eq(journalEntries.id, idOrSlug)).limit(1);
  if (byId[0]) return byId[0];

  const bySlug = await db.select().from(journalEntries).where(eq(journalEntries.slug, idOrSlug)).limit(1);
  if (bySlug[0]) return bySlug[0];

  return null;
}

export async function getJournalEntryByIdOrSlug(idOrSlug: string): Promise<JournalEntryRecord | null> {
  const cachedFn = createCachedQuery(
    () => fetchJournalEntryByIdOrSlugRaw(idOrSlug),
    ["journal-entry-detail", idOrSlug],
    { tags: ["journal-entries-list", `journal-entry-${idOrSlug}`], revalidate: 3600 }
  );

  return cachedFn();
}

export interface SaveJournalEntryInput {
  slug?: string;
  entryDate: string; // YYYY-MM-DD
  entryType?: string;
  mood?: string;
  favorite?: number;
  visibility?: "public" | "private" | "unlisted";
  locationId?: string;
  tripId?: string;
  weatherId?: string;
  encryptedContent: string;
  encryptionVersion?: number;
  iv: string;
  salt: string;
  wordCount?: number;
  readingTime?: number;
  tags?: string[];
  mentions?: Array<{ entityType: string; entityId: string }>;
}

export async function createJournalEntry(data: SaveJournalEntryInput): Promise<JournalEntryRecord> {
  await ensureDbInitialized();

  const id = `jnl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const slug = data.slug || `journal-${data.entryDate}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const entryRecord = {
    id,
    slug,
    entryDate: data.entryDate,
    entryType: data.entryType || "daily",
    mood: data.mood || null,
    favorite: data.favorite || 0,
    visibility: data.visibility || "private",
    locationId: data.locationId || null,
    tripId: data.tripId || null,
    weatherId: data.weatherId || null,
    encryptedContent: data.encryptedContent,
    encryptionVersion: data.encryptionVersion || 1,
    iv: data.iv,
    salt: data.salt,
    wordCount: data.wordCount || 0,
    readingTime: data.readingTime || 0,
    tags: JSON.stringify(data.tags || []),
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(journalEntries).values(entryRecord);

  // Initial revision
  const revId = `jnl_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await db.insert(journalRevisions).values({
    id: revId,
    entryId: id,
    encryptedContent: data.encryptedContent,
    iv: data.iv,
    salt: data.salt,
    createdAt: now,
  });

  // Explicit location / trip relationships
  if (data.locationId) {
    await addRelationship("journal", id, "location", data.locationId, "written_at");
  }
  if (data.tripId) {
    await addRelationship("journal", id, "trip", data.tripId, "belongs_to");
  }

  // Mentions relationships
  if (data.mentions && Array.isArray(data.mentions)) {
    for (const m of data.mentions) {
      await addRelationship("journal", id, m.entityType, m.entityId, "mentions");
    }
  }

  // Log activity (METADATA ONLY - zero knowledge of plaintext)
  await logActivity(
    "journal_created",
    "journal",
    id,
    `Created journal entry (${data.entryType || "daily"}) for ${data.entryDate}`,
    { entryType: data.entryType, mood: data.mood, wordCount: data.wordCount, date: data.entryDate }
  );

  eventBus.emit("entity.saved", { type: "journal", id, data: { entryDate: data.entryDate, wordCount: data.wordCount } });

  purgeTag("journal-entries-list");
  revalidatePath("/journal");
  return entryRecord;
}

export async function updateJournalEntry(
  id: string,
  data: Partial<SaveJournalEntryInput>
): Promise<JournalEntryRecord> {
  await ensureDbInitialized();
  const existing = await getJournalEntryByIdOrSlug(id);
  if (!existing) throw new Error("Journal entry not found");

  const now = new Date().toISOString();

  const updatePayload: Partial<JournalEntryRecord> = {
    updatedAt: now,
  };

  if (data.entryDate !== undefined) updatePayload.entryDate = data.entryDate;
  if (data.entryType !== undefined) updatePayload.entryType = data.entryType;
  if (data.mood !== undefined) updatePayload.mood = data.mood;
  if (data.favorite !== undefined) updatePayload.favorite = data.favorite;
  if (data.visibility !== undefined) updatePayload.visibility = data.visibility;
  if (data.locationId !== undefined) updatePayload.locationId = data.locationId;
  if (data.tripId !== undefined) updatePayload.tripId = data.tripId;
  if (data.weatherId !== undefined) updatePayload.weatherId = data.weatherId;
  if (data.wordCount !== undefined) updatePayload.wordCount = data.wordCount;
  if (data.readingTime !== undefined) updatePayload.readingTime = data.readingTime;
  if (data.tags !== undefined) updatePayload.tags = JSON.stringify(data.tags);

  if (data.encryptedContent && data.iv && data.salt) {
    updatePayload.encryptedContent = data.encryptedContent;
    updatePayload.iv = data.iv;
    updatePayload.salt = data.salt;

    // Create new encrypted revision
    const revId = `jnl_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.insert(journalRevisions).values({
      id: revId,
      entryId: id,
      encryptedContent: data.encryptedContent,
      iv: data.iv,
      salt: data.salt,
      createdAt: now,
    });
  }

  await db.update(journalEntries).set(updatePayload).where(eq(journalEntries.id, existing.id));

  // Sync relationships
  if (data.locationId !== undefined && data.locationId !== existing.locationId) {
    if (existing.locationId) {
      await db.delete(relationships).where(
        and(
          eq(relationships.sourceType, "journal"),
          eq(relationships.sourceId, existing.id),
          eq(relationships.targetType, "location"),
          eq(relationships.targetId, existing.locationId)
        )
      );
    }
    if (data.locationId) await addRelationship("journal", existing.id, "location", data.locationId, "written_at");
  }
  if (data.tripId !== undefined && data.tripId !== existing.tripId) {
    if (existing.tripId) {
      await db.delete(relationships).where(
        and(
          eq(relationships.sourceType, "journal"),
          eq(relationships.sourceId, existing.id),
          eq(relationships.targetType, "trip"),
          eq(relationships.targetId, existing.tripId)
        )
      );
    }
    if (data.tripId) await addRelationship("journal", existing.id, "trip", data.tripId, "belongs_to");
  }

  if (data.mentions && Array.isArray(data.mentions)) {
    for (const m of data.mentions) {
      await addRelationship("journal", existing.id, m.entityType, m.entityId, "mentions");
    }
  }

  await logActivity(
    "journal_updated",
    "journal",
    existing.id,
    `Updated journal entry for ${updatePayload.entryDate || existing.entryDate}`,
    { wordCount: updatePayload.wordCount || existing.wordCount }
  );

  eventBus.emit("entity.saved", { type: "journal", id: existing.id, data: { wordCount: updatePayload.wordCount } });

  purgeTag("journal-entries-list");
  purgeTag(`journal-entry-${existing.id}`);
  purgeTag(`journal-entry-${existing.slug}`);
  revalidatePath("/journal");

  const updated = await getJournalEntryByIdOrSlug(existing.id);
  return updated!;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await ensureDbInitialized();
  const existing = await getJournalEntryByIdOrSlug(id);
  if (!existing) return;

  await db.delete(journalRevisions).where(eq(journalRevisions.entryId, existing.id));
  await db.delete(journalEntries).where(eq(journalEntries.id, existing.id));

  await logActivity("journal_deleted", "journal", existing.id, `Deleted journal entry from ${existing.entryDate}`);
  eventBus.emit("entity.deleted", { type: "journal", id: existing.id });

  purgeTag("journal-entries-list");
  purgeTag(`journal-entry-${existing.id}`);
  purgeTag(`journal-entry-${existing.slug}`);
  revalidatePath("/journal");
}

export async function getJournalRevisions(entryId: string): Promise<JournalRevisionRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(journalRevisions)
    .where(eq(journalRevisions.entryId, entryId))
    .orderBy(desc(journalRevisions.createdAt));
}

// --- CONTEXTUAL DATA FETCH FOR JOURNALSIDEBAR / CONNECTIONS ---

export async function getJournalContextualData(dateStr: string) {
  await ensureDbInitialized();

  // Date boundaries for the day (e.g. "2026-07-18")
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  const [dayPhotos, dayMovies, dayScrobbles, dayMicroblogs] = await Promise.all([
    db
      .select()
      .from(gallery)
      .where(or(gte(gallery.takenAt, startOfDay), gte(gallery.createdAt, startOfDay)))
      .limit(10),
    db
      .select()
      .from(traktMovies)
      .where(and(gte(traktMovies.watchedAt, startOfDay), lte(traktMovies.watchedAt, endOfDay)))
      .limit(10),
    db
      .select()
      .from(lastfmScrobbles)
      .where(and(gte(lastfmScrobbles.playedAt, startOfDay), lte(lastfmScrobbles.playedAt, endOfDay)))
      .limit(15),
    db
      .select()
      .from(microblogs)
      .where(and(gte(microblogs.createdAt, startOfDay), lte(microblogs.createdAt, endOfDay)))
      .limit(10),
  ]);

  return {
    photos: dayPhotos,
    movies: dayMovies,
    scrobbles: dayScrobbles,
    microblogs: dayMicroblogs,
  };
}

export async function getEntityPickersData() {
  await ensureDbInitialized();
  const [locs, trps, pple, prjs] = await Promise.all([
    db.select({ id: locations.id, name: locations.name, city: locations.city, country: locations.country }).from(locations).orderBy(locations.name),
    db.select({ id: trips.id, title: trips.title, startDate: trips.startDate }).from(trips).orderBy(desc(trips.startDate)),
    db.select({ id: persons.id, displayName: persons.displayName, avatarUrl: persons.avatarUrl }).from(persons).orderBy(persons.displayName),
    db.select({ id: projects.id, name: projects.name, status: projects.status }).from(projects).orderBy(projects.name),
  ]);

  return {
    locations: locs,
    trips: trps,
    people: pple,
    projects: prjs,
  };
}
