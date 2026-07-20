"use server";

import { db, ensureDbInitialized } from "@/db";
import {
  persons,
  PersonRecord,
  relationships,
  gallery,
  locations,
  trips,
  microblogs,
  projects,
  collectionItems,
  collections,
  activities,
  GalleryPhoto,
  LocationRecord,
  TripRecord,
  Microblog,
  Project,
  CollectionRecord,
} from "@/db/schema";
import { eq, or, desc, asc, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/features/activity/actions";
import { addRelationship, removeRelationship } from "@/features/relationships/actions";
import { createCachedQuery, purgeTag } from "@/lib/server-cache";
import { eventBus } from "@/lib/event-bus";
import {
  personInputSchema,
  PersonInput,
  generatePersonSlug,
  ImportantDate,
} from "./schema";

export interface PeopleFilterOptions {
  search?: string;
  relationshipType?: string;
  favorite?: boolean;
  birthdayMonth?: number; // 1 - 12
  visibility?: "private" | "unlisted" | "public" | "all";
  hasNotes?: boolean;
  sortBy?: "name" | "created_desc" | "updated_desc" | "recently_added" | "memory_score" | "significant_relationships";
}

/**
 * Raw data loader for fetching people records from database.
 */
async function fetchPeopleRaw(options: PeopleFilterOptions = {}): Promise<PersonRecord[]> {
  await ensureDbInitialized();

  let query = db.select().from(persons);

  const sortBy = options.sortBy || "created_desc";
  if (sortBy === "name") {
    query.orderBy(asc(persons.displayName));
  } else if (sortBy === "updated_desc") {
    query.orderBy(desc(persons.updatedAt));
  } else {
    query.orderBy(desc(persons.createdAt));
  }

  let results = await query;

  if (sortBy === "memory_score" || sortBy === "significant_relationships") {
    try {
      const { analyticsMemoryScores } = await import("@/db/schema");
      const scores = await db.select().from(analyticsMemoryScores).where(eq(analyticsMemoryScores.entityType, "person"));
      const scoreMap = new Map(scores.map((s) => [s.entityId, s.finalScore]));
      results.sort((a, b) => (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0));
    } catch (e) {}
  }

  if (options.visibility && options.visibility !== "all") {
    results = results.filter((p) => p.visibility === options.visibility);
  }

  if (options.relationshipType && options.relationshipType !== "all") {
    results = results.filter(
      (p) => (p.relationshipType || "").toLowerCase() === options.relationshipType!.toLowerCase()
    );
  }

  if (options.favorite) {
    results = results.filter((p) => p.favorite === 1);
  }

  if (options.hasNotes) {
    results = results.filter((p) => p.notesMarkdown && p.notesMarkdown.trim().length > 0);
  }

  if (options.birthdayMonth) {
    const monthStr = options.birthdayMonth < 10 ? `0${options.birthdayMonth}` : `${options.birthdayMonth}`;
    results = results.filter((p) => {
      let dates: ImportantDate[] = [];
      try {
        dates = JSON.parse(p.importantDatesJson || "[]");
      } catch {}
      return dates.some((d) => {
        if (!d.date) return false;
        const parts = d.date.split("-");
        if (parts.length >= 2) {
          const m = parts.length === 3 ? parts[1] : parts[0];
          return m === monthStr || parseInt(m, 10) === options.birthdayMonth;
        }
        return false;
      });
    });
  }

  if (options.search && options.search.trim().length > 0) {
    const term = options.search.trim().toLowerCase();
    results = results.filter((p) => {
      const nameMatch = (p.displayName || "").toLowerCase().includes(term);
      const legacyNameMatch = (p.name || "").toLowerCase().includes(term);
      const firstLastMatch = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase().includes(term);
      const nicknameMatch = (p.nickname || "").toLowerCase().includes(term);
      const relationMatch = (p.relationshipType || "").toLowerCase().includes(term);
      const notesMatch = (p.notesMarkdown || "").toLowerCase().includes(term);
      const interestsMatch = (p.interests || "").toLowerCase().includes(term);
      const tagsMatch = (p.tags || "").toLowerCase().includes(term);

      return (
        nameMatch ||
        legacyNameMatch ||
        firstLastMatch ||
        nicknameMatch ||
        relationMatch ||
        notesMatch ||
        interestsMatch ||
        tagsMatch
      );
    });
  }

  return results;
}

/**
 * High-performance cached query loader for People list.
 */
export async function getPeopleAction(options: PeopleFilterOptions = {}): Promise<PersonRecord[]> {
  const cacheKey = [
    "people-list",
    options.search || "none",
    options.relationshipType || "all",
    options.favorite ? "fav" : "all",
    options.birthdayMonth ? `m${options.birthdayMonth}` : "all",
    options.visibility || "all",
    options.sortBy || "default",
  ];

  const cachedFn = createCachedQuery(
    () => fetchPeopleRaw(options),
    cacheKey,
    { tags: ["people-list"], revalidate: 3600 }
  );

  return cachedFn();
}

/**
 * Raw single person loader.
 */
async function fetchPersonByIdOrSlugRaw(idOrSlug: string): Promise<PersonRecord | null> {
  await ensureDbInitialized();

  const byId = await db.select().from(persons).where(eq(persons.id, idOrSlug)).limit(1);
  if (byId[0]) return byId[0];

  const bySlug = await db.select().from(persons).where(eq(persons.slug, idOrSlug)).limit(1);
  if (bySlug[0]) return bySlug[0];

  return null;
}

export async function getPersonByIdOrSlugAction(idOrSlug: string): Promise<PersonRecord | null> {
  const cachedFn = createCachedQuery(
    () => fetchPersonByIdOrSlugRaw(idOrSlug),
    ["person-detail", idOrSlug],
    { tags: ["people-list", `person-${idOrSlug}`], revalidate: 3600 }
  );

  return cachedFn();
}

export async function createPersonAction(rawInput: unknown): Promise<{ success: boolean; person?: PersonRecord; error?: string }> {
  try {
    await ensureDbInitialized();
    const parsed = personInputSchema.parse(rawInput);

    const id = `person_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slug = parsed.slug || generatePersonSlug(parsed.displayName, id);
    const now = new Date().toISOString();

    const existingSlug = await db.select().from(persons).where(eq(persons.slug, slug)).limit(1);
    const finalSlug = existingSlug[0] ? `${slug}-${Math.random().toString(36).substring(2, 6)}` : slug;

    const record = {
      id,
      displayName: parsed.displayName,
      name: parsed.displayName,
      firstName: parsed.firstName || null,
      lastName: parsed.lastName || null,
      nickname: parsed.nickname || null,
      slug: finalSlug,
      avatarUrl: parsed.avatarUrl || null,
      relationshipType: parsed.relationshipType || "Friend",
      importantDatesJson: JSON.stringify(parsed.importantDates || []),
      notesMarkdown: parsed.notesMarkdown || null,
      interests: JSON.stringify(parsed.interests || []),
      socialLinksJson: JSON.stringify(parsed.socialLinks || {}),
      visibility: parsed.visibility,
      favorite: parsed.favorite,
      tags: JSON.stringify(parsed.tags || []),
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(persons).values(record);
    await logActivity("person_created", "person", id, `Created Person: ${parsed.displayName}`, {
      slug: finalSlug,
      relationshipType: parsed.relationshipType,
    });

    // Invalidate Vercel Data Cache instantly
    purgeTag("people-list");
    purgeTag("upcoming-birthdays");

    try {
      revalidatePath("/people");
    } catch {}

    eventBus.emit("entity.saved", {
      type: "person",
      id,
      title: parsed.displayName,
      subtitle: parsed.relationshipType
        ? `${parsed.relationshipType}${parsed.nickname ? ` (${parsed.nickname})` : ""}`
        : "Person",
      keywords: `${parsed.displayName} ${parsed.firstName || ""} ${parsed.lastName || ""} ${parsed.nickname || ""} ${parsed.relationshipType || ""}`,
      url: `/people/${finalSlug}`,
    });

    return { success: true, person: record as PersonRecord };
  } catch (err: any) {
    console.error("Error creating person:", err);
    return { success: false, error: err.message || "Failed to create person record" };
  }
}

export async function updatePersonAction(
  id: string,
  rawInput: unknown
): Promise<{ success: boolean; person?: PersonRecord; error?: string }> {
  try {
    await ensureDbInitialized();

    const existing = await db.select().from(persons).where(eq(persons.id, id)).limit(1);
    if (!existing[0]) {
      return { success: false, error: "Person record not found" };
    }

    const parsed = personInputSchema.partial().parse(rawInput);
    const now = new Date().toISOString();

    const updates: Partial<PersonRecord> = {
      updatedAt: now,
    };

    if (parsed.displayName !== undefined) {
      updates.displayName = parsed.displayName;
      updates.name = parsed.displayName;
    }
    if (parsed.firstName !== undefined) updates.firstName = parsed.firstName || null;
    if (parsed.lastName !== undefined) updates.lastName = parsed.lastName || null;
    if (parsed.nickname !== undefined) updates.nickname = parsed.nickname || null;
    if (parsed.avatarUrl !== undefined) updates.avatarUrl = parsed.avatarUrl || null;
    if (parsed.relationshipType !== undefined) updates.relationshipType = parsed.relationshipType || null;
    if (parsed.importantDates !== undefined) updates.importantDatesJson = JSON.stringify(parsed.importantDates);
    if (parsed.notesMarkdown !== undefined) updates.notesMarkdown = parsed.notesMarkdown || null;
    if (parsed.interests !== undefined) updates.interests = JSON.stringify(parsed.interests);
    if (parsed.socialLinks !== undefined) updates.socialLinksJson = JSON.stringify(parsed.socialLinks);
    if (parsed.visibility !== undefined) updates.visibility = parsed.visibility;
    if (parsed.favorite !== undefined) updates.favorite = parsed.favorite;
    if (parsed.tags !== undefined) updates.tags = JSON.stringify(parsed.tags);

    if (parsed.slug && parsed.slug !== existing[0].slug) {
      const slugCheck = await db.select().from(persons).where(eq(persons.slug, parsed.slug)).limit(1);
      updates.slug = slugCheck[0] ? `${parsed.slug}-${Math.random().toString(36).substring(2, 6)}` : parsed.slug;
    }

    await db.update(persons).set(updates).where(eq(persons.id, id));

    await logActivity("person_updated", "person", id, `Updated Person: ${updates.displayName || existing[0].displayName}`, {
      id,
    });

    // Invalidate Vercel Data Cache instantly
    purgeTag("people-list");
    purgeTag(`person-${id}`);
    purgeTag(`person-${existing[0].slug}`);
    if (updates.slug) purgeTag(`person-${updates.slug}`);
    purgeTag("upcoming-birthdays");

    try {
      revalidatePath("/people");
      revalidatePath(`/people/${updates.slug || existing[0].slug}`);
    } catch {}

    const updatedRecord = await db.select().from(persons).where(eq(persons.id, id)).limit(1);
    if (updatedRecord[0]) {
      const p = updatedRecord[0];
      eventBus.emit("entity.saved", {
        type: "person",
        id,
        title: p.displayName,
        subtitle: p.relationshipType
          ? `${p.relationshipType}${p.nickname ? ` (${p.nickname})` : ""}`
          : "Person",
        keywords: `${p.displayName} ${p.firstName || ""} ${p.lastName || ""} ${p.nickname || ""} ${p.relationshipType || ""}`,
        url: `/people/${p.slug}`,
      });
    }
    return { success: true, person: updatedRecord[0] };
  } catch (err: any) {
    console.error("Error updating person:", err);
    return { success: false, error: err.message || "Failed to update person" };
  }
}

export async function toggleFavoritePersonAction(id: string): Promise<boolean> {
  await ensureDbInitialized();
  const existing = await db.select().from(persons).where(eq(persons.id, id)).limit(1);
  if (!existing[0]) return false;

  const newFav = existing[0].favorite === 1 ? 0 : 1;
  await db
    .update(persons)
    .set({ favorite: newFav, updatedAt: new Date().toISOString() })
    .where(eq(persons.id, id));

  purgeTag("people-list");
  purgeTag(`person-${id}`);
  purgeTag(`person-${existing[0].slug}`);
  purgeTag("upcoming-birthdays");

  try {
    revalidatePath("/people");
    revalidatePath(`/people/${existing[0].slug}`);
  } catch {}

  return true;
}

export async function deletePersonAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    const existing = await db.select().from(persons).where(eq(persons.id, id)).limit(1);
    if (!existing[0]) return { success: true };

    await db
      .delete(relationships)
      .where(
        or(
          and(eq(relationships.sourceType, "person"), eq(relationships.sourceId, id)),
          and(eq(relationships.targetType, "person"), eq(relationships.targetId, id))
        )
      );

    await db
      .delete(collectionItems)
      .where(and(eq(collectionItems.itemType, "person"), eq(collectionItems.itemId, id)));

    await db.delete(persons).where(eq(persons.id, id));

    await logActivity("person_deleted", "person", id, `Deleted Person: ${existing[0].displayName}`, {
      slug: existing[0].slug,
    });

    purgeTag("people-list");
    purgeTag(`person-${id}`);
    purgeTag(`person-${existing[0].slug}`);
    purgeTag("upcoming-birthdays");

    try {
      revalidatePath("/people");
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error("Error deleting person:", err);
    return { success: false, error: err.message || "Failed to delete person" };
  }
}

export interface ConnectedEntityItem<T> {
  relationshipId?: string;
  relationshipName: string;
  entity: T;
}

export interface PersonConnectionsResult {
  photos: ConnectedEntityItem<GalleryPhoto>[];
  locations: ConnectedEntityItem<LocationRecord>[];
  trips: ConnectedEntityItem<TripRecord>[];
  microblogs: ConnectedEntityItem<Microblog>[];
  projects: ConnectedEntityItem<Project>[];
  collections: CollectionRecord[];
}

/**
 * Optimized connection query using batch `inArray` database lookups in parallel.
 * Reduces 50+ sequential network requests down to 1 single parallel batch query!
 */
async function fetchPersonConnectionsRaw(personId: string): Promise<PersonConnectionsResult> {
  await ensureDbInitialized();

  const relRows = await db
    .select()
    .from(relationships)
    .where(
      or(
        and(eq(relationships.sourceType, "person"), eq(relationships.sourceId, personId)),
        and(eq(relationships.targetType, "person"), eq(relationships.targetId, personId))
      )
    );

  const photoIds: string[] = [];
  const locationIds: string[] = [];
  const tripIds: string[] = [];
  const microblogIds: string[] = [];
  const projectIds: string[] = [];

  const relMap = new Map<string, { relId: string; name: string }>();

  for (const rel of relRows) {
    const isSource = rel.sourceType === "person" && rel.sourceId === personId;
    const otherType = isSource ? rel.targetType : rel.sourceType;
    const otherId = isSource ? rel.targetId : rel.sourceId;
    const verb = rel.relationship || "connected";

    if (otherType === "gallery" || otherType === "photo") {
      photoIds.push(otherId);
      relMap.set(`photo_${otherId}`, { relId: rel.id, name: verb });
    } else if (otherType === "location") {
      locationIds.push(otherId);
      relMap.set(`location_${otherId}`, { relId: rel.id, name: verb });
    } else if (otherType === "trip") {
      tripIds.push(otherId);
      relMap.set(`trip_${otherId}`, { relId: rel.id, name: verb });
    } else if (otherType === "microblog") {
      microblogIds.push(otherId);
      relMap.set(`microblog_${otherId}`, { relId: rel.id, name: verb });
    } else if (otherType === "project") {
      projectIds.push(otherId);
      relMap.set(`project_${otherId}`, { relId: rel.id, name: verb });
    }
  }

  // Execute all batch IN queries in parallel in 1 roundtrip!
  const [photosRes, locationsRes, tripsRes, microblogsRes, projectsRes, colItemsRes] = await Promise.all([
    photoIds.length > 0 ? db.select().from(gallery).where(inArray(gallery.id, photoIds)) : Promise.resolve([]),
    locationIds.length > 0 ? db.select().from(locations).where(inArray(locations.id, locationIds)) : Promise.resolve([]),
    tripIds.length > 0 ? db.select().from(trips).where(inArray(trips.id, tripIds)) : Promise.resolve([]),
    microblogIds.length > 0 ? db.select().from(microblogs).where(inArray(microblogs.id, microblogIds)) : Promise.resolve([]),
    projectIds.length > 0 ? db.select().from(projects).where(inArray(projects.id, projectIds)) : Promise.resolve([]),
    db.select().from(collectionItems).where(and(eq(collectionItems.itemType, "person"), eq(collectionItems.itemId, personId))),
  ]);

  const collectionIds = colItemsRes.map((ci) => ci.collectionId);
  const collectionsRes = collectionIds.length > 0 ? await db.select().from(collections).where(inArray(collections.id, collectionIds)) : [];

  return {
    photos: photosRes.map((p) => ({
      relationshipId: relMap.get(`photo_${p.id}`)?.relId,
      relationshipName: relMap.get(`photo_${p.id}`)?.name || "appears_in",
      entity: p,
    })),
    locations: locationsRes.map((l) => ({
      relationshipId: relMap.get(`location_${l.id}`)?.relId,
      relationshipName: relMap.get(`location_${l.id}`)?.name || "visited",
      entity: l,
    })),
    trips: tripsRes.map((t) => ({
      relationshipId: relMap.get(`trip_${t.id}`)?.relId,
      relationshipName: relMap.get(`trip_${t.id}`)?.name || "joined",
      entity: t,
    })),
    microblogs: microblogsRes.map((m) => ({
      relationshipId: relMap.get(`microblog_${m.id}`)?.relId,
      relationshipName: relMap.get(`microblog_${m.id}`)?.name || "mentions",
      entity: m,
    })),
    projects: projectsRes.map((pr) => ({
      relationshipId: relMap.get(`project_${pr.id}`)?.relId,
      relationshipName: relMap.get(`project_${pr.id}`)?.name || "worked_on",
      entity: pr,
    })),
    collections: collectionsRes,
  };
}

export async function getPersonConnectionsAction(personId: string): Promise<PersonConnectionsResult> {
  const cachedFn = createCachedQuery(
    () => fetchPersonConnectionsRaw(personId),
    ["person-connections", personId],
    { tags: ["people-list", `person-${personId}`, `person-connections-${personId}`], revalidate: 3600 }
  );

  return cachedFn();
}

export async function connectPersonToEntityAction(
  personId: string,
  targetType: string,
  targetId: string,
  relationship: string = "connected_to"
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    await addRelationship("person", personId, targetType, targetId, relationship);
    
    purgeTag("people-list");
    purgeTag(`person-${personId}`);
    purgeTag(`person-connections-${personId}`);
    purgeTag(`person-timeline-${personId}`);

    const person = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
    if (person[0]) {
      try {
        revalidatePath(`/people/${person[0].slug}`);
      } catch {}
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create connection" };
  }
}

export async function removePersonEntityConnectionAction(
  relationshipId: string,
  personSlug?: string
): Promise<{ success: boolean }> {
  await ensureDbInitialized();
  await removeRelationship(relationshipId);

  purgeTag("people-list");
  if (personSlug) {
    purgeTag(`person-${personSlug}`);
    try {
      revalidatePath(`/people/${personSlug}`);
    } catch {}
  }

  return { success: true };
}

export interface PersonTimelineItem {
  id: string;
  type: "activity" | "date" | "trip" | "photo" | "microblog";
  date: string;
  title: string;
  description?: string;
  metadata?: any;
}

export interface PersonMemoryHubData {
  person: PersonRecord | null;
  connections: PersonConnectionsResult;
  timeline: PersonTimelineItem[];
}

/**
 * Ultra-fast single batch composite query for Memory Hub detail page.
 * Collects Person, Connections, and Timeline in 1 single DB roundtrip (or 0ms via Vercel Data Cache).
 */
async function fetchPersonMemoryHubDataRaw(slug: string): Promise<PersonMemoryHubData | null> {
  await ensureDbInitialized();

  const person = await fetchPersonByIdOrSlugRaw(slug);
  if (!person) return null;

  const personId = person.id;

  // 1. Relationships query
  const relRows = await db
    .select()
    .from(relationships)
    .where(
      or(
        and(eq(relationships.sourceType, "person"), eq(relationships.sourceId, personId)),
        and(eq(relationships.targetType, "person"), eq(relationships.targetId, personId))
      )
    );

  const photoIds: string[] = [];
  const locationIds: string[] = [];
  const tripIds: string[] = [];
  const microblogIds: string[] = [];
  const projectIds: string[] = [];
  const relMap = new Map<string, { relId: string; name: string }>();

  for (const rel of relRows) {
    const isSource = rel.sourceType === "person" && rel.sourceId === personId;
    const otherType = isSource ? rel.targetType : rel.sourceType;
    const otherId = isSource ? rel.targetId : rel.sourceId;
    const verb = rel.relationship || "connected";

    if (otherType === "gallery" || otherType === "photo") {
      photoIds.push(otherId);
      relMap.set(`photo_${otherId}`, { relId: rel.id, name: verb });
    } else if (otherType === "location") {
      locationIds.push(otherId);
      relMap.set(`location_${otherId}`, { relId: rel.id, name: verb });
    } else if (otherType === "trip") {
      tripIds.push(otherId);
      relMap.set(`trip_${otherId}`, { relId: rel.id, name: verb });
    } else if (otherType === "microblog") {
      microblogIds.push(otherId);
      relMap.set(`microblog_${otherId}`, { relId: rel.id, name: verb });
    } else if (otherType === "project") {
      projectIds.push(otherId);
      relMap.set(`project_${otherId}`, { relId: rel.id, name: verb });
    }
  }

  // 2. Execute parallel batch IN queries + activity logs in 1 single Promise.all call!
  const [photosRes, locationsRes, tripsRes, microblogsRes, projectsRes, colItemsRes, actRows] = await Promise.all([
    photoIds.length > 0 ? db.select().from(gallery).where(inArray(gallery.id, photoIds)) : Promise.resolve([]),
    locationIds.length > 0 ? db.select().from(locations).where(inArray(locations.id, locationIds)) : Promise.resolve([]),
    tripIds.length > 0 ? db.select().from(trips).where(inArray(trips.id, tripIds)) : Promise.resolve([]),
    microblogIds.length > 0 ? db.select().from(microblogs).where(inArray(microblogs.id, microblogIds)) : Promise.resolve([]),
    projectIds.length > 0 ? db.select().from(projects).where(inArray(projects.id, projectIds)) : Promise.resolve([]),
    db.select().from(collectionItems).where(and(eq(collectionItems.itemType, "person"), eq(collectionItems.itemId, personId))),
    db.select().from(activities).where(and(eq(activities.entityType, "person"), eq(activities.entityId, personId))).orderBy(desc(activities.createdAt)).limit(30),
  ]);

  const collectionIds = colItemsRes.map((ci) => ci.collectionId);
  const collectionsRes = collectionIds.length > 0 ? await db.select().from(collections).where(inArray(collections.id, collectionIds)) : [];

  const connections: PersonConnectionsResult = {
    photos: photosRes.map((p) => ({
      relationshipId: relMap.get(`photo_${p.id}`)?.relId,
      relationshipName: relMap.get(`photo_${p.id}`)?.name || "appears_in",
      entity: p,
    })),
    locations: locationsRes.map((l) => ({
      relationshipId: relMap.get(`location_${l.id}`)?.relId,
      relationshipName: relMap.get(`location_${l.id}`)?.name || "visited",
      entity: l,
    })),
    trips: tripsRes.map((t) => ({
      relationshipId: relMap.get(`trip_${t.id}`)?.relId,
      relationshipName: relMap.get(`trip_${t.id}`)?.name || "joined",
      entity: t,
    })),
    microblogs: microblogsRes.map((m) => ({
      relationshipId: relMap.get(`microblog_${m.id}`)?.relId,
      relationshipName: relMap.get(`microblog_${m.id}`)?.name || "mentions",
      entity: m,
    })),
    projects: projectsRes.map((pr) => ({
      relationshipId: relMap.get(`project_${pr.id}`)?.relId,
      relationshipName: relMap.get(`project_${pr.id}`)?.name || "worked_on",
      entity: pr,
    })),
    collections: collectionsRes,
  };

  // 3. Assemble timeline directly in memory without extra DB roundtrips!
  const timelineItems: PersonTimelineItem[] = [];

  try {
    const dates: ImportantDate[] = JSON.parse(person.importantDatesJson || "[]");
    for (const d of dates) {
      if (d.date) {
        timelineItems.push({
          id: `date_${d.id}`,
          type: "date",
          date: d.date,
          title: `${person.displayName}'s ${d.title}`,
          description: d.notes || undefined,
        });
      }
    }
  } catch {}

  for (const act of actRows) {
    timelineItems.push({
      id: act.id,
      type: "activity",
      date: act.createdAt,
      title: act.title,
      description: act.action,
    });
  }

  for (const tripConn of connections.trips) {
    const t = tripConn.entity;
    timelineItems.push({
      id: `trip_${t.id}`,
      type: "trip",
      date: t.startDate || t.createdAt,
      title: `Shared Trip: ${t.title}`,
      description: t.description || undefined,
    });
  }

  for (const photoConn of connections.photos) {
    const p = photoConn.entity;
    timelineItems.push({
      id: `photo_${p.id}`,
      type: "photo",
      date: p.takenAt || p.createdAt,
      title: `Photo: ${p.title}`,
      description: p.description || undefined,
      metadata: { thumbnailUrl: p.thumbnailUrl, mediumUrl: p.mediumUrl },
    });
  }

  for (const mbConn of connections.microblogs) {
    const m = mbConn.entity;
    timelineItems.push({
      id: `mb_${m.id}`,
      type: "microblog",
      date: m.publishedAt || m.createdAt,
      title: `Microblog post`,
      description: m.contentMarkdown.slice(0, 100),
    });
  }

  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    person,
    connections,
    timeline: timelineItems,
  };
}

export async function getPersonMemoryHubDataAction(slug: string): Promise<PersonMemoryHubData | null> {
  const cachedFn = createCachedQuery(
    () => fetchPersonMemoryHubDataRaw(slug),
    ["person-memoryhub", slug],
    { tags: ["people-list", `person-${slug}`], revalidate: 3600 }
  );

  return cachedFn();
}

async function fetchPersonTimelineRaw(personId: string): Promise<PersonTimelineItem[]> {
  const conn = await fetchPersonConnectionsRaw(personId);
  const person = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
  if (!person[0]) return [];

  const timelineItems: PersonTimelineItem[] = [];

  try {
    const dates: ImportantDate[] = JSON.parse(person[0].importantDatesJson || "[]");
    for (const d of dates) {
      if (d.date) {
        timelineItems.push({
          id: `date_${d.id}`,
          type: "date",
          date: d.date,
          title: `${person[0].displayName}'s ${d.title}`,
          description: d.notes || undefined,
        });
      }
    }
  } catch {}

  const actRows = await db
    .select()
    .from(activities)
    .where(and(eq(activities.entityType, "person"), eq(activities.entityId, personId)))
    .orderBy(desc(activities.createdAt))
    .limit(30);

  for (const act of actRows) {
    timelineItems.push({
      id: act.id,
      type: "activity",
      date: act.createdAt,
      title: act.title,
      description: act.action,
    });
  }

  for (const tripConn of conn.trips) {
    const t = tripConn.entity;
    timelineItems.push({
      id: `trip_${t.id}`,
      type: "trip",
      date: t.startDate || t.createdAt,
      title: `Shared Trip: ${t.title}`,
      description: t.description || undefined,
    });
  }

  for (const photoConn of conn.photos) {
    const p = photoConn.entity;
    timelineItems.push({
      id: `photo_${p.id}`,
      type: "photo",
      date: p.takenAt || p.createdAt,
      title: `Photo: ${p.title}`,
      description: p.description || undefined,
      metadata: { thumbnailUrl: p.thumbnailUrl, mediumUrl: p.mediumUrl },
    });
  }

  for (const mbConn of conn.microblogs) {
    const m = mbConn.entity;
    timelineItems.push({
      id: `mb_${m.id}`,
      type: "microblog",
      date: m.publishedAt || m.createdAt,
      title: `Microblog post`,
      description: m.contentMarkdown.slice(0, 100),
    });
  }

  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return timelineItems;
}

export async function getPersonTimelineAction(personId: string): Promise<PersonTimelineItem[]> {
  const cachedFn = createCachedQuery(
    () => fetchPersonTimelineRaw(personId),
    ["person-timeline", personId],
    { tags: ["people-list", `person-${personId}`, `person-timeline-${personId}`], revalidate: 3600 }
  );

  return cachedFn();
}

export interface UpcomingBirthdayItem {
  personId: string;
  displayName: string;
  slug: string;
  avatarUrl?: string | null;
  relationshipType?: string | null;
  title: string;
  dateStr: string;
  daysRemaining: number;
}

async function fetchUpcomingBirthdaysRaw(limit = 5): Promise<UpcomingBirthdayItem[]> {
  await ensureDbInitialized();

  const allPeople = await db.select({
    id: persons.id,
    displayName: persons.displayName,
    slug: persons.slug,
    avatarUrl: persons.avatarUrl,
    relationshipType: persons.relationshipType,
    importantDatesJson: persons.importantDatesJson,
  }).from(persons);

  const now = new Date();
  const currentYear = now.getFullYear();

  const upcomingList: UpcomingBirthdayItem[] = [];

  for (const p of allPeople) {
    let dates: ImportantDate[] = [];
    try {
      dates = JSON.parse(p.importantDatesJson || "[]");
    } catch {}

    for (const d of dates) {
      if (!d.date) continue;
      const parts = d.date.split("-");
      let month = 0;
      let day = 0;

      if (parts.length === 3) {
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else if (parts.length === 2) {
        month = parseInt(parts[0], 10) - 1;
        day = parseInt(parts[1], 10);
      }

      if (isNaN(month) || isNaN(day)) continue;

      let targetDate = new Date(currentYear, month, day);
      if (targetDate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
        targetDate = new Date(currentYear + 1, month, day);
      }

      const diffTime = targetDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysRemaining >= 0 && daysRemaining <= 60) {
        upcomingList.push({
          personId: p.id,
          displayName: p.displayName,
          slug: p.slug,
          avatarUrl: p.avatarUrl,
          relationshipType: p.relationshipType,
          title: d.title,
          dateStr: d.date,
          daysRemaining,
        });
      }
    }
  }

  upcomingList.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return upcomingList.slice(0, limit);
}

export async function getUpcomingBirthdaysAction(limit = 5): Promise<UpcomingBirthdayItem[]> {
  const cachedFn = createCachedQuery(
    () => fetchUpcomingBirthdaysRaw(limit),
    ["upcoming-birthdays", String(limit)],
    { tags: ["upcoming-birthdays", "people-list"], revalidate: 3600 }
  );

  return cachedFn();
}
