

# 1. Design for Read Performance

Your application is **95% reads**.

Optimize for reads, not writes.

Instead of:

```
Read
↓

Calculate

↓

Return
```

Do:

```
Write

↓

Calculate

↓

Store

↓

Read
```

Always precompute expensive things.

---

# 2. Never Calculate on Page Load

Bad:

```
Dashboard

↓

COUNT Movies

COUNT Photos

COUNT Artists

GROUP BY Year

GROUP BY Genre

Recent Activity

Top Artists
```

Good:

```
Dashboard

↓

dashboard_snapshot

↓

Render
```

One query.

---

# 3. Create Read Models

Separate **operational tables** from **UI tables**.

Example:

```
movies

movie_metadata

watch_history
```

↓

Generate

↓

```
movie_statistics

movies_by_year

recent_movies

favorite_movies
```

The UI reads from these.

---

# 4. Build a Statistics Engine

Every mutation updates statistics.

Examples:

```
Photo uploaded

↓

Update

gallery_stats
```

```
Trakt Sync

↓

Update

movie_stats
```

```
Last.fm Sync

↓

Update

artist_stats
```

Statistics are no longer queries.

They're data.

---

# 5. Snapshot Tables

Example:

```
dashboard_snapshot

movie_count

show_count

artist_count

album_count

photo_count

microblog_count

latest_activity

last_sync
```

Updated automatically.

Dashboard becomes instant.

---

# 6. Event-Driven Updates

Instead of:

```
Page requests data

↓

Calculates everything
```

Do:

```
Microblog Published

↓

Event

↓

Update Stats

↓

Update Activity

↓

Trigger Deploy
```

The expensive work happens once.

---

# 7. Job Queue

Don't make the user wait.

```
Upload

↓

Create Job

↓

Worker

↓

Generate thumbnails

↓

Extract EXIF

↓

Reverse geocode

↓

Update DB

↓

Done
```

The page returns immediately.

---

# 8. Fetch in Parallel

Never:

```ts
await getPhotos();
await getMovies();
await getArtists();
```

Always:

```ts
await Promise.all([
    getPhotos(),
    getMovies(),
    getArtists()
]);
```

---

# 9. Select Only Needed Columns

Never:

```sql
SELECT *
```

Instead:

```sql
SELECT
id,
title,
poster_path,
watched_at
```

List pages don't need reviews.

---

# 10. Cursor Pagination

Never:

```
OFFSET 10000
```

Instead:

```
WHERE created_at < cursor
```

or

```
WHERE id < cursor
```

Cursor pagination scales much better.

---

# 11. Build Proper Indexes

Every frequently filtered column should be indexed.

Examples:

```
created_at

updated_at

slug

visibility

favorite

played_at

watched_at

location_id

trip_id

collection_id
```

Also index foreign keys.

---

# 12. Covering Indexes

Example:

You always query:

```
favorite = true

ORDER BY watched_at DESC
```

Index both:

```
favorite

watched_at
```

SQLite/Turso benefits enormously.

---

# 13. Eliminate N+1 Queries

Never:

```
Movies

↓

for each movie

↓

query metadata
```

Instead:

Fetch everything once.

---

# 14. Cache at Multiple Layers

### React

```
cache()
```

---

### Next.js

```
unstable_cache()
```

---

### Browser

Long-lived images.

---

### CDN

Static assets.

---

### Turso

Prepared statements.

---

# 15. Server Components

Render everything possible on the server.

Hydrate only:

* Forms
* Buttons
* Uploads

Everything else stays server-side.

---

# 16. Split the Dashboard

Instead of:

```
Dashboard

↓

Huge query
```

Do:

```
Widget

↓

Independent fetch
```

The user sees content progressively.

---

# 17. Lazy Loading

Music page:

```
Artists

Albums

Tracks

History
```

Load only the active tab.

---

# 18. Search Index

Don't search all tables.

Create:

```
search_index

entity

title

subtitle

keywords

url
```

Update after writes.

Global search becomes a single indexed query.

---

# 19. Relationship Cache

If you introduce the Relationship Engine:

Don't compute:

```
Movie

↓

Photos

↓

Trips

↓

Locations
```

every request.

Maintain relationship summaries.

---

# 20. Attachments

Store metadata separately.

```
attachment

↓

thumbnail

↓

medium

↓

large
```

No resizing during page loads.

---

# 21. Image Pipeline

You already planned this.

Browser:

```
Original

↓

Resize

↓

Thumbnail

↓

Upload
```

CMS never resizes.

Excellent.

---

# 22. Incremental Sync

Never:

```
Download everything
```

Instead:

```
Last Sync

↓

Only fetch newer records
```

---

# 23. Derived Tables

Examples:

```
artist_statistics

album_statistics

movie_statistics

location_statistics

trip_statistics
```

Never calculate them repeatedly.

---

# 24. Dashboard Service

Instead of:

```
Dashboard

↓

15 DB calls
```

Create:

```
DashboardService

↓

1 function

↓

Returns everything
```

Much easier to optimize.

---

# 25. Build a Performance Layer

Don't let UI talk directly to Drizzle everywhere.

Instead:

```
UI

↓

Service

↓

Repository

↓

Database
```

Repositories fetch raw data.

Services compose it.

UI never knows.

---

# 26. Measure Before Optimizing

Add simple instrumentation.

Track:

* Query duration
* Number of queries per request
* Slowest endpoints
* Largest payloads

You'll know exactly where time is going instead of guessing.

---

# 27. Database Maintenance

SQLite benefits from periodic maintenance:

* `ANALYZE` after creating or changing indexes so the query planner has good statistics.
* `PRAGMA optimize;` occasionally to let SQLite perform lightweight optimizations.
* Avoid unnecessary indexes—each extra index slows writes.

For Turso, follow their guidance on maintenance, but these SQLite concepts still apply.

---

# 28. Optimize Payloads

Don't return full objects if the UI needs a badge.

Instead of:

```json
{
  "review": "...5000 characters...",
  "notes": "...10000 characters..."
}
```

Return:

```json
{
  "hasReview": true,
  "favorite": true
}
```

Fetch the full content only when opening the detail page.

---

# 29. Think in Views

Every page should have a dedicated data model.

For example:

```
Movie Detail View

Movie List View

Dashboard View

Search View

Gallery Grid View
```

Each view should fetch exactly what's needed, no more.

---

# 30. Set Performance Budgets

Give yourself concrete targets:

| Operation                  |                                               Target |
| -------------------------- | ---------------------------------------------------: |
| Dashboard initial render   |                                    < 300 ms (server) |
| List page (first 50 items) |                                             < 200 ms |
| Search results             |                                             < 100 ms |
| Detail page                |                                             < 150 ms |
| Thumbnail upload response  | < 1 s (processing continues in background if needed) |
| Incremental sync           |                                 Only changed records |

When a feature exceeds its budget, redesign it instead of accepting the slowdown.

---

## The mindset I'd adopt

Treat your data in three categories:

### 1. Source Data (immutable or provider-owned)

```
Movies

Scrobbles

Photos

Microblogs
```

### 2. Derived Data (precomputed)

```
Dashboard

Statistics

Search Index

Activity Feed

Collections

Relationship Summaries
```

### 3. Presentation Data (view-specific)

```
Movie List

Gallery Grid

Dashboard Widgets

Search Results
```

Every expensive computation should move **left** (toward writes and background processing), so reads become simple and predictable.

That architectural approach is what lets applications feel "blazing fast" even as the underlying dataset grows by orders of magnitude.


