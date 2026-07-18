# AI Handoff & Personal Knowledge Platform Architecture Blueprint

> **Notice to Future AI Assistants**: Read this document first to immediately understand the repository structure, schema, conventions, and Personal Knowledge Platform (PKP) design philosophy without spending tokens parsing the entire codebase.
> Always update this document (`AI_HANDOFF.md`) before committing and pushing changes to GitHub!
>
> 📖 **Hugo Integration**: For instructions on plugging Hugo Content Adapters to this CMS, read [HUGO_CONTENT_ADAPTER.md](file:///home/dog/git/admin-cms/HUGO_CONTENT_ADAPTER.md).

---

## 1. High-Level Summary

This repository is **`admin-cms`**, a private, single-user **Personal Knowledge Platform** built with Next.js App Router for managing, connecting, enriching, and publishing every aspect of digital life to a Hugo website via Turso (libSQL).

- **Strict Separation of Concerns**: Hugo site is read-only static; CMS is the sole writer to Turso. Provider data (Trakt, Last.fm) is owned by external providers, while CMS personal metadata (ratings, notes, tags, reviews, visibility) belongs exclusively to the CMS.
- **Entity-Driven Interconnected Architecture**: Reusable core entities (Locations, Trips, Projects, Persons, Tags, Collections) connected seamlessly via a generic Relationship Engine and Attachment System without redundant join tables.
- **Workflow**: Create/Edit Post or Media -> Save to Turso -> Status set to `published` -> Trigger `VERCEL_DEPLOY_HOOK` -> Hugo site rebuilds automatically.
- **UI & UX Highlights**: Keyboard-first Command Palette (`Ctrl+K`) for global fuzzy search across all entities and quick actions, central Settings Hub (`/settings`), Locations (`/locations` & `/locations/[slug]`), Trips (`/trips` & `/trips/[slug]`), People Memory Hubs (`/people` & `/people/[slug]`), real-time R2 usage monitors, and responsive themes.

---

## 2. Key Directories & Code Structure

```text
admin-cms/
├── src/
│   ├── app/
│   │   ├── (auth)/login/        # Password login page
│   │   ├── (dashboard)/         # Protected dashboard layout & routes
│   │   │   ├── page.tsx         # Control center overview with modular widgets
│   │   │   ├── microblog/       # Microblog list & CRUD editor routes
│   │   │   ├── todos/           # Todo list & Project management route
│   │   │   ├── people/          # Personal Relationship & Memory Hub routes (/people and /people/[slug])
│   │   │   ├── locations/       # Geographical locations entity page & detail hub (/locations and /locations/[slug])
│   │   │   ├── trips/           # Travel itineraries & trip grouping hub (/trips and /trips/[slug])
│   │   │   ├── settings/        # Centralized Settings Hub (General, Storage, Providers, etc.)
│   │   │   ├── libraries/       # Personal Media Libraries (Movies, TV, Music, Collections)
│   │   │   └── sync/            # Sync Center integration hub
│   │   ├── globals.css          # Design tokens, themes (HN Orange, Dark, Mono, Teal)
│   │   └── layout.tsx           # Root layout & ThemeProvider
│   ├── components/              # Shared UI (Header, Sidebar, CommandPalette, DeployWidget)
│   ├── db/
│   │   ├── schema.ts            # Drizzle table schemas for all entities and providers
│   │   └── index.ts             # Turso / libSQL client & auto-initializer DDL
│   ├── features/
│   │   ├── activity/            # Universal Activity Engine logging & timeline
│   │   ├── relationships/       # Generic Relationship Engine (connects any two entities)
│   │   ├── attachments/         # Reusable Attachment System for media & files
│   │   ├── jobs/                # Background Job Queue Engine (queued, running, completed)
│   │   ├── search/              # Universal fuzzy multi-table search engine
│   │   ├── people/              # Personal relationship server actions, Memory Hub & parallel batch query engine
│   │   ├── locations/           # Location CRUD actions, detail hub & trip associations
│   │   ├── trips/               # Trip management server actions & location linkage
│   │   ├── auth/                # Session cookies, password check, login server actions
│   │   ├── microblog/           # Microblog actions, Zod validation, Editor & List
│   │   ├── libraries/           # Personal media libraries & metadata preservation
│   │   └── sync/                # Extensible Provider integration registry
│   ├── lib/
│   │   ├── server-cache.ts      # Vercel Data Cache helper (createCachedQuery, purgeTag)
│   │   ├── client-cache.ts      # Client-side SWR browser cache helper (getBrowserCache, setBrowserCache)
│   │   ├── event-bus.ts         # Internal event pub-sub bus
│   │   └── deploy-hook.ts       # Vercel deploy hook caller
│   └── middleware.ts            # Next.js route protection middleware
├── tests/                       # Vitest unit test suite
├── HUGO_CONTENT_ADAPTER.md      # Step-by-step Hugo Content Adapter setup guide
├── arch.txt                     # Architecture Evolution Plan
└── drizzle.config.ts            # Drizzle kit configuration
```

### Performance & Perceived-Speed Conventions

- **Gallery Location & Trip Associations**:
  - Replaced legacy manual location text inputs in both [GalleryGrid.tsx](file:///home/dog/git/admin-cms/src/features/gallery/GalleryGrid.tsx) edit modal and [GalleryUploader.tsx](file:///home/dog/git/admin-cms/src/features/gallery/GalleryUploader.tsx) inspector with dropdown selectors linked directly to the `locations` and `trips` database tables.
  - Automatically records `locationId` and `tripId` while maintaining backwards-compatible `locationName`, latitude, and longitude synchronization.
- **Locations & Trips Universal High-Performance Architecture**:
  - Single composite batch queries (`getLocationHubDataAction` and `getTripHubDataAction`) fetch entity records and associated media/relationships in **1 single DB roundtrip** using `inArray` queries.
  - Vercel Data Cache (`createCachedQuery` & `purgeTag`) caches responses in server memory, providing **0-1ms** response times.
  - Client-side SWR browser caching (`getBrowserCache` / `setBrowserCache`) enables instant **0ms initial paints** on route changes for `/locations`, `/locations/[slug]`, `/trips`, and `/trips/[slug]`.
  - Lazy `onFocus` deferred dropdown entity loading eliminates redundant API calls when opening detail pages.
- **Movies & TV Shows Library High-Performance Caching**:
  - `getMovieDetailAction(traktId)` and `getShowDetailAction(traktId)` wrapped with Vercel Data Cache (`createCachedQuery` & `purgeTag`), serving detail views in **0-1ms**.
  - Client-side SWR caching (`getBrowserCache` / `setBrowserCache`) provides instant 0ms paints across movies and TV show library lists and detail views (`/libraries/movies`, `/libraries/movies/[id]`, `/libraries/shows`, `/libraries/shows/[id]`).
- **People Module & Memory Hub High Performance Architecture**: 
  - Single composite batch queries (`getPersonMemoryHubDataAction`) fetch person details, relationships, connected photos, locations, trips, microblogs, projects, and timeline events in **1 single DB roundtrip** using `inArray` batch queries (reducing 50+ sequential network calls).
  - Vercel Data Cache integration (`createCachedQuery` & `purgeTag`) serves cached queries in **0-1ms** with instantaneous tag invalidation on updates.
  - Client-side SWR browser caching (`getBrowserCache` / `setBrowserCache`) enables instant **0ms initial paints** on route changes while revalidating seamlessly in the background.
  - Deferred loading of picker dropdown data (`allLocations`, `allTrips`) keeps initial page weight light and render speeds near-instant.
- **Locations & Trips Interconnected Detail Hubs**:
  - Full editability modals ([LocationFormModal.tsx](file:///home/dog/git/admin-cms/src/features/locations/components/LocationFormModal.tsx) and [TripFormModal.tsx](file:///home/dog/git/admin-cms/src/features/trips/components/TripFormModal.tsx)) covering state fields, GPS coordinates, elevation, photo notes, gear recommendations, privacy settings, and ratings.
  - Bi-directional relationship linkage allowing Trips to link multiple Locations (`includes_location`) and vice versa, rendering associated media (photos, microblogs, movies, people) on dedicated detail pages ([/locations/[slug]](file:///home/dog/git/admin-cms/src/app/(dashboard)/locations/[slug]/page.tsx) & [/trips/[slug]](file:///home/dog/git/admin-cms/src/app/(dashboard)/trips/[slug]/page.tsx)).
- **SQLite Schema & Backward Compatibility Layer**:
  - `persons` table schema maintains `displayName` alongside legacy `name` column, executing sync queries (`UPDATE persons SET display_name = name...`) in `src/db/index.ts` and populating both columns on writes to prevent SQLite `NOT NULL constraint failed` errors on existing databases.
- **Mobile Responsive Layout & Z-Index Hierarchy**:
  - Mobile `.sidebar-backdrop` uses `z-index: 1000` with blur, while `.sidebar` uses `z-index: 1005 !important` (top: 42px) to ensure navigation links are fully clickable and interactive without backdrop blur blocking touch events.
  - `.sidebar` is split into `.sidebar-nav-container` (`flex: 1; overflow-y: auto`) and `.sidebar-footer` (`flex-shrink: 0; border-top: 1px solid var(--border-color)`) so Vercel Deploy widgets sit at the bottom without overlapping navigation items.
- **Route Feedback & Navigation Progress**: `NavigationProgressBar` (`src/components/NavigationProgressBar.tsx`) is rendered globally in `src/app/(dashboard)/layout.tsx`. It intercepts internal link navigation clicks instantly (0ms latency visual feedback), showing a glowing top accent progress bar across the screen.
- **Non-Blocking Background DB Write Engine & Toast Notifications**:
  - Global notification manager (`src/lib/notifications.ts`) and floating client toast container (`src/components/ToastNotification.tsx`) enable zero-latency, instant UI responses on all save, publish, save draft, update, and delete actions across Microblogs, Locations, Trips, People, Todos, Links, Gallery, Libraries, and Sync Provider settings.
  - Modals and forms close instantly (0ms latency) without blocking user input or showing modal loading spinners, executing server actions non-blockingly in the background and presenting floating completion/error toast notifications.

---

## 3. Database Schema (`src/db/schema.ts`)

### `locations`
- `id` (text, primary key): `loc_${timestamp}_${rand}`
- `name` (text, not null), `slug` (text, unique, not null)
- `country`, `state`, `city`, `latitude`, `longitude`, `elevation`, `timezone`
- `firstVisited`, `lastVisited` (ISO timestamp strings), `visitCount` (integer, default 1)
- `privateNotes`, `publicDescription`, `tags` (JSON string array)
- `visibility` (`public` | `private` | `unlisted`), `favorite` (0 or 1)
- `photographyNotes`, `parkingNotes`, `walkingDifficulty`, `weatherNotes`, `bestSeason`, `bestTimeOfDay`, `cameraRecommendations`, `personalRating`

### `trips`
- `id` (text, primary key): `trip_${timestamp}_${rand}`
- `title` (text, not null), `slug` (text, unique, not null), `description`
- `startDate`, `endDate` (date strings)
- `status` (`planned` | `ongoing` | `completed` | `cancelled`)
- `visibility` (`public` | `private` | `unlisted`), `favorite` (0 or 1), `tags` (JSON string array)

### `persons` (Personal Contacts & Memory Hub)
- `id` (text, primary key): `person_${timestamp}_${rand}`
- `displayName` (text, not null), `name` (text, not null, legacy fallback), `firstName`, `lastName`, `nickname`, `slug` (text, unique, not null)
- `avatarUrl`, `relationshipType` (`Family`, `Friend`, `Partner`, `Relative`, `Colleague`, `Classmate`, `Neighbor`, `Mentor`, or custom)
- `importantDatesJson` (JSON array of `{ id, title, date, reminderEnabled, notes }`)
- `notesMarkdown` (private markdown notes), `interests` (JSON string array), `socialLinksJson` (JSON object)
- `visibility` (`private` | `unlisted` | `public`, default `private`), `favorite` (0 or 1), `tags` (JSON string array)

### `relationships` (Generic Relationship Engine)
- `id` (text, primary key): `rel_${timestamp}_${rand}`
- `sourceType` (text, e.g. `photo`, `movie`, `microblog`, `person`, `trip`)
- `sourceId` (text)
- `targetType` (text, e.g. `location`, `project`, `trip`, `person`)
- `targetId` (text)
- `relationship` (text, e.g. `taken_at`, `watched_at`, `belongs_to`, `mentions`, `contains`, `references`, `includes_location`)

### `attachments` (Reusable Media Attachment System)
- `id` (text, primary key): `att_${timestamp}_${rand}`
- `entityType` (text), `entityId` (text)
- `kind` (text: `screenshot` | `poster` | `cover` | `hero` | `gallery_ref` | `video` | `pdf` | `file`)
- `url` (text, not null), `mime`, `width`, `height`, `metadataJson`

### `jobs` (Background Task Queue)
- `id` (text, primary key): `job_${timestamp}_${rand}`
- `type` (text: `sync_provider` | `image_processing` | `search_indexing` | `deploy_site`)
- `payloadJson`, `status` (`queued` | `running` | `completed` | `failed` | `cancelled`)
- `progress` (0-100), `errorMessage`, `resultJson`, `attempts`, `maxAttempts`

### `projects` and `todos`
- `projects`: `id`, unique `name`, `slug`, `description`, `repositoryUrl`, `websiteUrl`, `status` (`active` | `completed` | `archived` | `on_hold` | `planned`), `technologies` (JSON array), `startDate`, `completedDate`, `visibility` (`public` | `private` | `unlisted`).
- `todos`: `id`, required `title`, optional `description` and `dueDate`, priority (`low` | `medium` | `high`), `completed` flag, `projectId`, JSON-string `tags`.

### Core Content Tables & Relationships
- `microblogs`: `id`, `slug`, `contentMarkdown`, `status`, `tags`, `coverImageUrl`, `images`, `shortUrl`, `locationId`, `tripId`, `createdAt`, `updatedAt`, `publishedAt`.
- `gallery`: `id`, `title`, `slug`, `description`, `originalUrl`, `largeUrl`, `mediumUrl`, `thumbnailUrl`, `width`, `height`, `fileSize`, `mimeType`, `camera`, `lens`, `focalLength`, `aperture`, `shutterSpeed`, `iso`, `takenAt`, `latitude`, `longitude`, `locationName`, `locationId`, `tripId`, `visibility`, `featured`, `tags`, `album`, `shortUrl`.
- `movieMetadata`: `traktId`, `favorite`, `personalRating`, `review`, `notes`, `tags`, `visibility`, `featured`, `watchedWith`, `watchLocation`, `locationId`, `tripId`, `relatedPhotos`, `relatedMicroblogs`.
- **Public REST Content Adapter Endpoints**:
  - `/api/microblogs`: Serves published microblogs with resolved `location` and `trip` objects.
  - `/api/gallery`: Serves public gallery photos with resolved EXIF, `location` and `trip` objects.
  - `/api/movies`: Serves public movies with ratings, reviews, `location` and `trip` objects.

---

## 4. Universal Search & Command Palette (`Ctrl+K`)

- Accessible via the top header or keyboard shortcut `Ctrl+K`.
- Executes fuzzy multi-table searches across Microblogs, Gallery, Movies, TV Shows, Music, Projects, Locations, Trips, Collections, Notes, Bookmarks, Quotes.
- Offers instant Quick Actions: Create Microblog, Upload Photos, Open Locations, Create Project/Task, Sync Providers, System Settings.

---

## 5. Event Bus & Activity Stream Architecture

- **Internal Event Bus** (`src/lib/event-bus.ts`): Allows modules to publish system events (`entity.created`, `photo.uploaded`, `sync.completed`, etc.) without hard coupling dependencies.
- **Universal Activity Log** (`src/features/activity/`): Logs user and system activity events automatically for dashboard widgets, timeline feeds, and audit trails.

---

## 6. How to Run Commands & Tests

- **Development Server**: `npm run dev`
- **Build Verification**: `npm run build`
- **Execute Tests**: `npm run test`
- **Type Check**: `npx tsc --noEmit`
- **Drizzle DB Schema Push**: `npm run db:push`
