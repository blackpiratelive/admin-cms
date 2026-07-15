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
import { eq, or, desc, asc, and, inArray, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/features/activity/actions";
import { addRelationship, removeRelationship } from "@/features/relationships/actions";
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
  sortBy?: "name" | "created_desc" | "updated_desc" | "recently_added";
}

export async function getPeopleAction(options: PeopleFilterOptions = {}): Promise<PersonRecord[]> {
  await ensureDbInitialized();

  let query = db.select().from(persons);

  // Sorting
  const sortBy = options.sortBy || "created_desc";
  if (sortBy === "name") {
    query.orderBy(asc(persons.displayName));
  } else if (sortBy === "updated_desc") {
    query.orderBy(desc(persons.updatedAt));
  } else {
    query.orderBy(desc(persons.createdAt));
  }

  let results = await query;

  // Filter in memory for complex JSON & fuzzy checks if needed, or query conditions
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
        // Check YYYY-MM-DD or MM-DD formats
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
      const firstLastMatch = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase().includes(term);
      const nicknameMatch = (p.nickname || "").toLowerCase().includes(term);
      const relationMatch = (p.relationshipType || "").toLowerCase().includes(term);
      const notesMatch = (p.notesMarkdown || "").toLowerCase().includes(term);
      const interestsMatch = (p.interests || "").toLowerCase().includes(term);
      const tagsMatch = (p.tags || "").toLowerCase().includes(term);

      return (
        nameMatch ||
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

export async function getPersonByIdOrSlugAction(idOrSlug: string): Promise<PersonRecord | null> {
  await ensureDbInitialized();

  const byId = await db.select().from(persons).where(eq(persons.id, idOrSlug)).limit(1);
  if (byId[0]) return byId[0];

  const bySlug = await db.select().from(persons).where(eq(persons.slug, idOrSlug)).limit(1);
  if (bySlug[0]) return bySlug[0];

  return null;
}

export async function createPersonAction(rawInput: unknown): Promise<{ success: boolean; person?: PersonRecord; error?: string }> {
  try {
    await ensureDbInitialized();
    const parsed = personInputSchema.parse(rawInput);

    const id = `person_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slug = parsed.slug || generatePersonSlug(parsed.displayName, id);
    const now = new Date().toISOString();

    // Check if slug is unique
    const existingSlug = await db.select().from(persons).where(eq(persons.slug, slug)).limit(1);
    const finalSlug = existingSlug[0] ? `${slug}-${Math.random().toString(36).substring(2, 6)}` : slug;

    const record = {
      id,
      displayName: parsed.displayName,
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

    try {
      revalidatePath("/people");
    } catch {}

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

    if (parsed.displayName !== undefined) updates.displayName = parsed.displayName;
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

    try {
      revalidatePath("/people");
      revalidatePath(`/people/${updates.slug || existing[0].slug}`);
    } catch {}

    const updatedRecord = await db.select().from(persons).where(eq(persons.id, id)).limit(1);
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

    // Clean up relationships
    await db
      .delete(relationships)
      .where(
        or(
          and(eq(relationships.sourceType, "person"), eq(relationships.sourceId, id)),
          and(eq(relationships.targetType, "person"), eq(relationships.targetId, id))
        )
      );

    // Clean up collection items
    await db
      .delete(collectionItems)
      .where(and(eq(collectionItems.itemType, "person"), eq(collectionItems.itemId, id)));

    // Delete record
    await db.delete(persons).where(eq(persons.id, id));

    await logActivity("person_deleted", "person", id, `Deleted Person: ${existing[0].displayName}`, {
      slug: existing[0].slug,
    });

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

export async function getPersonConnectionsAction(personId: string): Promise<PersonConnectionsResult> {
  await ensureDbInitialized();

  // Get all relationship rows involving personId
  const relRows = await db
    .select()
    .from(relationships)
    .where(
      or(
        and(eq(relationships.sourceType, "person"), eq(relationships.sourceId, personId)),
        and(eq(relationships.targetType, "person"), eq(relationships.targetId, personId))
      )
    );

  const photoConnections: ConnectedEntityItem<GalleryPhoto>[] = [];
  const locationConnections: ConnectedEntityItem<LocationRecord>[] = [];
  const tripConnections: ConnectedEntityItem<TripRecord>[] = [];
  const microblogConnections: ConnectedEntityItem<Microblog>[] = [];
  const projectConnections: ConnectedEntityItem<Project>[] = [];

  for (const rel of relRows) {
    const isSource = rel.sourceType === "person" && rel.sourceId === personId;
    const otherType = isSource ? rel.targetType : rel.sourceType;
    const otherId = isSource ? rel.targetId : rel.sourceId;

    if (otherType === "gallery" || otherType === "photo") {
      const item = await db.select().from(gallery).where(eq(gallery.id, otherId)).limit(1);
      if (item[0]) {
        photoConnections.push({
          relationshipId: rel.id,
          relationshipName: rel.relationship || "appears_in",
          entity: item[0],
        });
      }
    } else if (otherType === "location") {
      const item = await db.select().from(locations).where(eq(locations.id, otherId)).limit(1);
      if (item[0]) {
        locationConnections.push({
          relationshipId: rel.id,
          relationshipName: rel.relationship || "visited",
          entity: item[0],
        });
      }
    } else if (otherType === "trip") {
      const item = await db.select().from(trips).where(eq(trips.id, otherId)).limit(1);
      if (item[0]) {
        tripConnections.push({
          relationshipId: rel.id,
          relationshipName: rel.relationship || "joined",
          entity: item[0],
        });
      }
    } else if (otherType === "microblog") {
      const item = await db.select().from(microblogs).where(eq(microblogs.id, otherId)).limit(1);
      if (item[0]) {
        microblogConnections.push({
          relationshipId: rel.id,
          relationshipName: rel.relationship || "mentions",
          entity: item[0],
        });
      }
    } else if (otherType === "project") {
      const item = await db.select().from(projects).where(eq(projects.id, otherId)).limit(1);
      if (item[0]) {
        projectConnections.push({
          relationshipId: rel.id,
          relationshipName: rel.relationship || "worked_on",
          entity: item[0],
        });
      }
    }
  }

  // Get collections
  const colItems = await db
    .select()
    .from(collectionItems)
    .where(and(eq(collectionItems.itemType, "person"), eq(collectionItems.itemId, personId)));

  const connectedCollections: CollectionRecord[] = [];
  for (const ci of colItems) {
    const col = await db.select().from(collections).where(eq(collections.id, ci.collectionId)).limit(1);
    if (col[0]) connectedCollections.push(col[0]);
  }

  return {
    photos: photoConnections,
    locations: locationConnections,
    trips: tripConnections,
    microblogs: microblogConnections,
    projects: projectConnections,
    collections: connectedCollections,
  };
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
  if (personSlug) {
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

export async function getPersonTimelineAction(personId: string): Promise<PersonTimelineItem[]> {
  await ensureDbInitialized();

  const person = await db.select().from(persons).where(eq(persons.id, personId)).limit(1);
  if (!person[0]) return [];

  const timelineItems: PersonTimelineItem[] = [];

  // 1. Important dates
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

  // 2. Activities referencing this person
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

  // 3. Connected Trips, Photos, Microblogs
  const connections = await getPersonConnectionsAction(personId);

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

  // Sort timeline items descending by date
  timelineItems.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return timelineItems;
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

export async function getUpcomingBirthdaysAction(limit = 5): Promise<UpcomingBirthdayItem[]> {
  await ensureDbInitialized();

  const allPeople = await db.select().from(persons);
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
      // Parse MM-DD
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
      // If targetDate is in past for current year, look at next year
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
