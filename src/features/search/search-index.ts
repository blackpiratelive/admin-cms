import { db, ensureDbInitialized } from "@/db";
import {
  searchIndex,
  microblogs,
  gallery,
  projects,
  locations,
  trips,
  persons,
  traktMovies,
  traktShows,
  lastfmArtists,
  collections,
} from "@/db/schema";
import { eq, like, or, sql } from "drizzle-orm";

export interface SearchEntry {
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string | null;
  keywords?: string | null;
  url: string;
}

/**
 * Upsert a single entity into the search_index table.
 */
export async function upsertSearchEntry(entry: SearchEntry): Promise<void> {
  try {
    await ensureDbInitialized();
    const id = `${entry.entityType}_${entry.entityId}`;
    const now = new Date().toISOString();
    const payload = {
      id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      title: entry.title,
      subtitle: entry.subtitle || null,
      keywords: (entry.keywords || "").toLowerCase(),
      url: entry.url,
      updatedAt: now,
    };

    const existing = await db
      .select({ id: searchIndex.id })
      .from(searchIndex)
      .where(eq(searchIndex.id, id));

    if (existing.length > 0) {
      await db.update(searchIndex).set(payload).where(eq(searchIndex.id, id));
    } else {
      await db.insert(searchIndex).values(payload);
    }
  } catch (err) {
    console.error("Error upserting search entry:", err);
  }
}

/**
 * Remove an entity from the search_index table.
 */
export async function deleteSearchEntry(entityType: string, entityId: string): Promise<void> {
  try {
    await ensureDbInitialized();
    const id = `${entityType}_${entityId}`;
    await db.delete(searchIndex).where(eq(searchIndex.id, id));
  } catch (err) {
    console.error("Error deleting search entry:", err);
  }
}

/**
 * Rebuild the unified search index table from operational tables.
 */
export async function rebuildSearchIndex(): Promise<number> {
  await ensureDbInitialized();

  const [
    mRes,
    gRes,
    pRes,
    lRes,
    tRes,
    personRes,
    movRes,
    showRes,
    artRes,
    colRes,
  ] = await Promise.all([
    db.select().from(microblogs),
    db.select().from(gallery),
    db.select().from(projects),
    db.select().from(locations),
    db.select().from(trips),
    db.select().from(persons),
    db.select().from(traktMovies),
    db.select().from(traktShows),
    db.select().from(lastfmArtists),
    db.select().from(collections),
  ]);

  const now = new Date().toISOString();
  const indexRows: Array<typeof searchIndex.$inferInsert> = [];

  for (const m of mRes) {
    indexRows.push({
      id: `microblog_${m.id}`,
      entityType: "microblog",
      entityId: m.id,
      title: m.slug,
      subtitle: m.contentMarkdown.slice(0, 80) + "...",
      keywords: `${m.slug} ${m.tags} ${m.contentMarkdown.slice(0, 200)}`.toLowerCase(),
      url: `/microblog/${m.id}`,
      updatedAt: now,
    });
  }

  for (const g of gRes) {
    indexRows.push({
      id: `gallery_${g.id}`,
      entityType: "gallery",
      entityId: g.id,
      title: g.title,
      subtitle: g.description || g.slug,
      keywords: `${g.title} ${g.slug} ${g.description || ""} ${g.tags || ""}`.toLowerCase(),
      url: `/gallery`,
      updatedAt: now,
    });
  }

  for (const pr of pRes) {
    indexRows.push({
      id: `project_${pr.id}`,
      entityType: "project",
      entityId: pr.id,
      title: pr.name,
      subtitle: pr.description || "Project",
      keywords: `${pr.name} ${pr.description || ""} ${pr.technologies || ""}`.toLowerCase(),
      url: `/todos`,
      updatedAt: now,
    });
  }

  for (const l of lRes) {
    indexRows.push({
      id: `location_${l.id}`,
      entityType: "location",
      entityId: l.id,
      title: l.name,
      subtitle: [l.city, l.state, l.country].filter(Boolean).join(", "),
      keywords: `${l.name} ${l.city || ""} ${l.state || ""} ${l.country || ""}`.toLowerCase(),
      url: `/locations`,
      updatedAt: now,
    });
  }

  for (const tr of tRes) {
    indexRows.push({
      id: `trip_${tr.id}`,
      entityType: "trip",
      entityId: tr.id,
      title: tr.title,
      subtitle: tr.description || "Trip",
      keywords: `${tr.title} ${tr.description || ""} ${tr.tags || ""}`.toLowerCase(),
      url: `/trips`,
      updatedAt: now,
    });
  }

  for (const p of personRes) {
    indexRows.push({
      id: `person_${p.id}`,
      entityType: "person",
      entityId: p.id,
      title: p.displayName,
      subtitle: p.relationshipType
        ? `${p.relationshipType}${p.nickname ? ` (${p.nickname})` : ""}`
        : "Person",
      keywords: `${p.displayName} ${p.firstName || ""} ${p.lastName || ""} ${p.nickname || ""} ${p.relationshipType || ""}`.toLowerCase(),
      url: `/people/${p.slug}`,
      updatedAt: now,
    });
  }

  for (const m of movRes) {
    indexRows.push({
      id: `movie_${m.traktId}`,
      entityType: "movie",
      entityId: String(m.traktId),
      title: m.title,
      subtitle: m.year ? `${m.year}` : "Movie",
      keywords: `${m.title} ${m.genres || ""}`.toLowerCase(),
      url: `/libraries/movies`,
      updatedAt: now,
    });
  }

  for (const s of showRes) {
    indexRows.push({
      id: `show_${s.traktId}`,
      entityType: "show",
      entityId: String(s.traktId),
      title: s.title,
      subtitle: s.year ? `${s.year}` : "TV Show",
      keywords: `${s.title}`.toLowerCase(),
      url: `/libraries/shows`,
      updatedAt: now,
    });
  }

  for (const a of artRes) {
    indexRows.push({
      id: `artist_${a.artistName}`,
      entityType: "artist",
      entityId: a.artistName,
      title: a.artistName,
      subtitle: `${a.playCount} plays`,
      keywords: `${a.artistName}`.toLowerCase(),
      url: `/libraries/music`,
      updatedAt: now,
    });
  }

  for (const c of colRes) {
    indexRows.push({
      id: `collection_${c.id}`,
      entityType: "collection",
      entityId: c.id,
      title: c.name,
      subtitle: c.description || "Collection",
      keywords: `${c.name} ${c.description || ""}`.toLowerCase(),
      url: `/libraries/collections`,
      updatedAt: now,
    });
  }

  // Clear and batch re-insert
  await db.delete(searchIndex);
  if (indexRows.length > 0) {
    // Insert in chunks of 100
    for (let i = 0; i < indexRows.length; i += 100) {
      await db.insert(searchIndex).values(indexRows.slice(i, i + 100));
    }
  }

  return indexRows.length;
}
