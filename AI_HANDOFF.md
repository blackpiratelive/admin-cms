# AI Handoff & Personal Knowledge Platform Architecture Blueprint

> **Notice to Future AI Assistants**: Read this document first to immediately understand the repository structure, schema, conventions, and Personal Knowledge Platform (PKP) design philosophy without spending tokens parsing the entire codebase.
> Always update this document (`AI_HANDOFF.md`) before committing and pushing changes to GitHub!
>
> 📖 **Hugo Integration**: For instructions on plugging Hugo Content Adapters to this CMS, read [HUGO_CONTENT_ADAPTER.md](file:///home/dog/git/admin-cms/HUGO_CONTENT_ADAPTER.md).

---

## 1. High-Level Summary

This repository is **`admin-cms`**, a private, single-user **Personal Knowledge Platform** built with Next.js 15 App Router, React 19, Drizzle ORM, and Turso (libSQL) for managing, connecting, enriching, and publishing every aspect of digital life to a Hugo website.

- **Strict Separation of Concerns**: Hugo site is read-only static; CMS is the sole writer to Turso. Provider data (Trakt, Last.fm) is owned by external providers, while CMS personal metadata (ratings, notes, tags, reviews, visibility) belongs exclusively to the CMS.
- **Entity-Driven Interconnected Architecture**: Reusable core entities (Locations, Trips, Projects, Persons, Tags, Collections) connected seamlessly via a generic Relationship Engine and Attachment System without redundant join tables.
- **Publishing Workflow**: Create/Edit Post or Media -> Save to Turso -> Status set to `published` -> Trigger `VERCEL_DEPLOY_HOOK` -> Hugo site rebuilds automatically.
- **UI & UX Highlights**: Keyboard-first Command Palette (`Ctrl+K`) for global fuzzy search across all entities and quick actions, central Settings Hub (`/settings`), Locations (`/locations` & `/locations/[slug]`), Trips (`/trips` & `/trips/[slug]`), People Memory Hubs (`/people` & `/people/[slug]`), real-time R2 usage monitors, responsive themes (HN Orange, Dark, Mono, Teal), and non-blocking background toast notifications.

---

## 2. Key Directories & Code Structure

```text
admin-cms/
├── android/                     # Native Android Journal Application (Kotlin, Jetpack Compose, Room, WorkManager, DEK/KEK E2EE, Adaptive UI)
├── src/
│   ├── app/
│   │   ├── (auth)/login/        # Password login page
│   │   ├── (dashboard)/         # Protected dashboard layout & routes
│   │   │   ├── page.tsx         # Control center overview with modular widgets
│   │   │   ├── journal/         # End-to-End Encrypted Personal Journal (/journal and /journal/editor)
│   │   │   ├── microblog/       # Microblog list & CRUD editor routes
│   │   │   ├── todos/           # Todo list & Project management route
│   │   │   ├── people/          # Personal Relationship & Memory Hub routes (/people and /people/[slug])
│   │   │   ├── locations/       # Geographical locations entity page & detail hub (/locations and /locations/[slug])
│   │   │   ├── trips/           # Travel itineraries & trip grouping hub (/trips and /trips/[slug])
│   │   │   ├── analytics/       # Analytics & Memory Discovery Engine hub (/analytics & /stats)
│   │   │   ├── settings/        # Centralized Settings Hub (General, Storage, Providers, etc.)
│   │   │   ├── libraries/       # Personal Media Libraries (Movies, TV, Music, Collections)
│   │   │   └── sync/            # Sync Center integration hub
│   │   ├── api/
│   │   │   ├── auth/login/      # Mobile & API authentication endpoint
│   │   │   ├── microblogs/      # Public REST API for Hugo adapter
│   │   │   ├── gallery/         # Public REST API for gallery photos
│   │   │   ├── movies/          # Public REST API for movies
│   │   │   └── journal/         # Journal Sync & E2EE API (/status, /keys, /settings, /entries, /sync, /assets)
│   │   ├── globals.css          # Design tokens, themes (HN Orange, Dark, Mono, Teal)
│   │   └── layout.tsx           # Root layout & ThemeProvider
│   ├── components/              # Shared UI (Header, Sidebar, CommandPalette, DeployWidget, ToastNotification)
│   ├── db/
│   │   ├── schema.ts            # Drizzle table schemas for all 46 database entities
│   │   └── index.ts             # Turso / libSQL client & auto-initializer DDL
│   ├── features/
│   │   ├── analytics/           # Modular Analytics Engine (10 providers), Memory Index scoring, timeline cache & snapshots
│   │   ├── journal/             # DEK/KEK E2EE Web Crypto API, Lexical Editor, Lexical AST Sanitizer, Zip Import & Undo
│   │   ├── activity/            # Universal Activity Engine logging & timeline stream
│   │   ├── relationships/       # Generic Relationship Engine (connects any two entities)
│   │   ├── attachments/         # Reusable Attachment System for media & files
│   │   ├── jobs/                # Background Job Queue Engine (queued, running, completed)
│   │   ├── search/              # Universal fuzzy multi-table search engine (search_index)
│   │   ├── people/              # Personal relationship server actions, Memory Hub & parallel batch query engine
│   │   ├── locations/           # Location CRUD actions, detail hub & trip associations
│   │   ├── trips/               # Trip management server actions & location linkage
│   │   ├── auth/                # Session cookies, password check, login server actions
│   │   ├── microblog/           # Microblog actions, Zod validation, Editor & List
│   │   ├── libraries/           # Personal media libraries & metadata preservation
│   │   └── sync/                # Extensible Provider integration registry (Trakt, Last.fm)
│   ├── lib/
│   │   ├── server-cache.ts      # Vercel Data Cache helper (createCachedQuery, purgeTag)
│   │   ├── client-cache.ts      # Client-side SWR browser cache helper (getBrowserCache, setBrowserCache)
│   │   ├── notifications.ts     # Client-side floating toast notification manager
│   │   ├── cloudinary.ts        # Direct & raw encrypted Cloudinary upload helpers
│   │   ├── event-bus.ts         # Internal event pub-sub bus
│   │   └── deploy-hook.ts       # Vercel deploy hook caller
│   └── middleware.ts            # Next.js route protection middleware
├── tests/                       # Vitest unit test suite (42 unit tests)
├── android-journal.md           # Native Android Journal Application specification
├── HUGO_CONTENT_ADAPTER.md      # Step-by-step Hugo Content Adapter setup guide
├── arch.txt                     # Architecture Evolution Plan
└── drizzle.config.ts            # Drizzle kit configuration
```

---

## 3. Database Schema Reference (`src/db/schema.ts`)

85: The database consists of **46 SQLite tables** managed via Drizzle ORM:
86: 
87: ### 3.1 Core Entity Tables
88: - **`locations`**: Stores geographical locations. `id` (`loc_${ts}_${rand}`), `name`, `slug`, `country`, `state`, `city`, `latitude`, `longitude`, `elevation`, `timezone`, `firstVisited`, `lastVisited`, `visitCount`, `privateNotes`, `publicDescription`, `tags` (JSON string array), `visibility` (`public` | `private` | `unlisted`), `favorite`, `photographyNotes`, `parkingNotes`, `walkingDifficulty`, `weatherNotes`, `bestSeason`, `bestTimeOfDay`, `cameraRecommendations`, `personalRating`.
89: - **`trips`**: Travel itineraries and trip groupings. `id` (`trip_${ts}_${rand}`), `title`, `slug`, `description`, `startDate`, `endDate`, `status` (`planned` | `ongoing` | `completed` | `cancelled`), `visibility`, `favorite`, `tags`.
90: - **`persons`**: Personal relationship contacts & Memory Hub. `id` (`person_${ts}_${rand}`), `displayName`, `name` (legacy fallback), `firstName`, `lastName`, `nickname`, `slug`, `avatarUrl`, `relationshipType` (`Family`, `Friend`, `Partner`, `Relative`, `Colleague`, `Classmate`, `Neighbor`, `Mentor`), `importantDatesJson` (JSON array), `notesMarkdown`, `interests`, `socialLinksJson` (JSON object including Facebook, Twitter, Instagram, LinkedIn), `visibility`, `favorite`, `tags`.
91: - **`tags`** & **`entity_tags`**: Tag registry (`id`, `name`, `description`, `color`) and generic entity tag linkages (`id`, `tagId`, `entityType`, `entityId`).
92: - **`relationships`**: Generic Relationship Engine table. `id` (`rel_${ts}_${rand}`), `sourceType`, `sourceId`, `targetType`, `targetId`, `relationship` (`taken_at`, `watched_at`, `belongs_to`, `mentions`, `contains`, `related_to`, `references`, `includes_location`).
93: - **`attachments`**: Reusable media attachment system. `id` (`att_${ts}_${rand}`), `entityType`, `entityId`, `kind` (`screenshot`, `poster`, `cover`, `hero`, `gallery_ref`, `video`, `pdf`, `file`), `url`, `mime`, `width`, `height`, `metadataJson`.
94: - **`jobs`**: Background task queue. `id` (`job_${ts}_${rand}`), `type` (`sync_provider`, `image_processing`, `search_indexing`, `deploy_site`), `payloadJson`, `status` (`queued`, `running`, `completed`, `failed`, `cancelled`), `progress`, `errorMessage`, `resultJson`, `attempts`, `maxAttempts`.
95: - **`projects`** & **`todos`**: Projects (`name`, `slug`, `description`, `repositoryUrl`, `websiteUrl`, `status`, `technologies`, `startDate`, `completedDate`, `visibility`) and Todos (`title`, `description`, `dueDate`, `priority`, `completed`, `projectId`, `tags`).
96: - **`notes`**, **`bookmarks`**, **`quotes`**: Markdown notes, web bookmarks, and literary quotes with visibility and tags.
97: 
98: ### 3.2 Media Libraries & Content Tables
99: - **`microblogs`** & **`related_microblogs`**: Microblog posts (`slug`, `contentMarkdown`, `status`, `tags`, `coverImageUrl`, `images`, `shortUrl`, `locationId`, `tripId`) and related microblog graph.
100: - **`gallery`**: Photo gallery (`title`, `slug`, `description`, `originalUrl`, `largeUrl`, `mediumUrl`, `thumbnailUrl`, `width`, `height`, `fileSize`, `mimeType`, EXIF fields `camera`, `lens`, `focalLength`, `aperture`, `shutterSpeed`, `iso`, `takenAt`, `latitude`, `longitude`, `locationName`, `locationId`, `tripId`, `visibility`, `featured`, `tags`, `album`, `shortUrl`).
101: - **`trakt_movies`**, **`trakt_shows`**, **`trakt_episodes`**: Provider data synced from Trakt.tv.
102: - **`lastfm_scrobbles`**, **`lastfm_artists`**, **`lastfm_albums`**, **`lastfm_tracks`**: Provider data synced from Last.fm.
103: - **`movie_metadata`**, **`tv_show_metadata`**, **`artist_metadata`**, **`album_metadata`**, **`track_metadata`**: CMS-owned personal metadata tables (`favorite`, `personalRating`, `review`, `notes`, `tags`, `visibility`, `watchedWith`, `watchLocation`, `locationId`, `tripId`, `relatedPhotos`, `relatedMicroblogs`).
104: - **`collections`** & **`collection_items`**: Generic curated collections grouping any media items (`movie`, `show`, `artist`, `album`, `track`, `book`, `project`, `photo`, `location`, `trip`, `note`, `bookmark`, `quote`).
105: - **`activities`**: System and user activity stream (`action`, `entityType`, `entityId`, `title`, `metadataJson`).
106: 
107: ### 3.3 Sync & Performance Caching Tables
108: - **`providers`** & **`sync_logs`**: Provider integration registry and execution logs.
109: - **`dashboard_cache`**: Precomputed snapshot key-value store for 0ms dashboard renders.
110: - **`search_index`**: Universal multi-table search index (`entityType`, `entityId`, `title`, `subtitle`, `keywords`, `url`).
111: - **`system_stats`**: Derived system statistics counters.
112: 
113: ### 3.4 End-to-End Encrypted (E2EE) Journal Tables
114: - **`journal_entries`**: Encrypted journal entries (`id`, `slug`, `entryDate`, `entryType`, `mood`, `favorite`, `visibility`, `locationId`, `tripId`, `weatherId`, `encryptedContent`, `encryptionVersion`, `iv`, `salt`, `wordCount`, `readingTime`, `tags`).
115: - **`journal_revisions`**: Immutable revision snapshots of journal entries (`entryId`, `encryptedContent`, `iv`, `salt`).
116: - **`journal_settings`**: Vault settings (`salt`, `verificationPayload`, `verificationIv`, `autoLockMinutes`).
117: - **`journal_keys`**: Cryptographic Key Record (`encryptedDek`, `salt`, `iv`, `algorithm`, `kdf`, `argonMemory`, `argonIterations`, `argonParallelism`, `keyVersion`).
118: - **`journal_assets`**: Encrypted image asset metadata (`assetType`, `mimeType`, `width`, `height`, `originalSize`, `compressedSize`, `thumbnailSize`, `cloudinaryOriginalPublicId`, `cloudinaryThumbnailPublicId`, `originalIv`, `thumbnailIv`, `encryptionVersion`).
119: - **`journal_entry_assets`**: Linkage between journal entries and encrypted assets (`entryId`, `assetId`, `assetRole`, `position`).
120: 
121: ### 3.5 Analytics Engine & Memory Cache Tables
122: - **`analytics_metrics`**: Aggregated module metrics key-value cache (`id`, `module`, `metricName`, `metricValue`, `metadataJson`, `updatedAt`).
123: - **`analytics_daily`**, **`analytics_monthly`**, **`analytics_yearly`**: Time-aggregated metrics cache per daily, monthly, and yearly intervals.
124: - **`analytics_relationships`**: Graph relationships with weights between entities.
125: - **`analytics_timeline`**: Unified activity timeline cache combining entries across all 10 modules.
126: - **`analytics_snapshots`**: Immutable historical statistics snapshots (`daily`, `monthly`, `yearly`).
127: - **`analytics_memory_scores`**: Memory Index scores across entities (Richness, Diversity, Longevity, Recurrence, Recency, Favorite Bonus, Pinned Bonus, Final Score, Pin status).
128: - **`analytics_dashboard`**: Cached analytics widget snapshots.
129: - **`analytics_search`**: Search ranking weights & score boosts.
130: - **`analytics_trends`**: Multi-period trend metrics cache.

---

## 4. Key Subsystems & Architectures

### 4.1 Performance & Multi-Layer Caching Architecture
- **Single-Batch Composite Queries**: High-traffic hub pages (`/locations/[slug]`, `/trips/[slug]`, `/people/[slug]`) execute 1 single DB roundtrip using Drizzle `inArray` queries instead of 50+ sequential database requests.
- **Vercel Data Cache (`createCachedQuery` & `purgeTag`)**: Server-side cache layer in `src/lib/server-cache.ts` serving responses in **0-1ms** with instantaneous tag invalidation on mutations.
- **Client-Side SWR Browser Caching (`getBrowserCache` / `setBrowserCache`)**: Client-side browser cache in `src/lib/client-cache.ts` providing **0ms instant initial paints** on navigation.
- **Non-Blocking Background Write Engine & Toast Notifications**: Modals and forms close instantly (0ms latency). Operations execute asynchronously in the background, presenting floating toast notifications (`src/lib/notifications.ts` & `src/components/ToastNotification.tsx`).
- **Navigation Feedback**: Global `NavigationProgressBar` (`src/components/NavigationProgressBar.tsx`) shows immediate top accent progress on internal route link clicks.

### 4.2 Universal Search & Command Palette (`Ctrl+K`)
- Accessible via header button or `Ctrl+K`.
- Queries `search_index` table using indexed SQLite queries (<100ms response time).
- Features quick actions for entity creation, provider syncing, and settings navigation.

### 4.3 End-to-End Encrypted (E2EE) Journal System
- **Cryptographic Model**:
  - **Key Encryption Key (KEK)**: Derived on demand in browser via Argon2id Wasm from user password and salt (`memorySize=65536`, `iterations=3`, `parallelism=1`). Main UI thread repaints smoothly during derivation via `deriveKEK` yielding event loop.
  - **Data Encryption Key (DEK)**: 256-bit symmetric AES-256-GCM key wrapping all entry texts and images.
  - **Zero-Knowledge**: Server and database only hold ciphertext, IVs, and wrapped DEK.
- **Lexical AST Sanitizer (`sanitizeLexicalStateJson`)**:
  - Located in `src/features/journal/lib/journal-helpers.ts`.
  - Automatically sanitizes incoming Lexical JSON ASTs before loading into `LexicalComposer` or saving to DB.
  - Converts custom/external divider nodes (`session-divider`, `session_divider`, `horizontal-rule`, `hr`) into clean paragraph nodes containing `***`.
  - Maps unrecognized element nodes to `paragraph` nodes and unrecognized inline nodes to `text` nodes, **preventing Lexical Error #17 and Error #38**.
- **Zero-Knowledge Encrypted Image Pipeline**:
  - EXIF/GPS metadata stripped via HTML5 Canvas re-draw (`processImageFile`).
  - Fallback to `image/jpeg` if WebP canvas export is unsupported (Safari/WebKit).
  - Encrypted with AES-256-GCM and uploaded directly to Cloudinary raw endpoint (`uploadRawDirectToCloudinary`).
  - Rendered inline in editor via custom `JournalImageNode` and managed via `JournalAttachments` and `JournalLightboxModal`.
- **Zip Import & Undo Engine**:
  - `JournalImportModal.tsx` parses `.zip` archives with `JSZip`.
  - Scans all nested directories for `journal.json` and image files, resolving zip wrapper parent folders (`my-export/journal.json`, `my-folder/images/1_0.webp`).
  - Normalizes stringified Lexical JSON, raw Markdown, numeric 1–10 mood scales, and location tags (`📍 location`).
  - Double-guards per-image processing so individual image upload glitches do not abort entry text or remaining image imports.
  - Stores created entry IDs and asset IDs in `localStorage` under `last_journal_import`, enabling 1-click atomic rollback via `undoJournalImportAction`.

### 4.4 Analytics Engine & Memory Discovery Architecture (`src/features/analytics/`)
- **Modular Provider Architecture**:
  - 10 Independent Analytics Providers: `Journal`, `Microblog`, `Todos`, `Gallery`, `Movies`, `TV Shows`, `Music`, `People`, `Locations`, `Trips`.
  - Core engine combines provider calculations into 11 dedicated cache tables without executing runtime aggregations on page loads.
- **Memory Index Scoring Engine (`src/features/analytics/scoring.ts`)**:
  - Multi-dimensional ranking combining Richness, Diversity, Longevity, Recurrence, Recency, Favorite Bonus, and Pinned Bonus.
  - Drives discovery across Memory Hub, People rankings, Location significance, Trip importance, and search result ranking boost.
- **Event-Driven Asynchronous Updates**:
  - `EventBus` listens to `entity.saved` and `entity.deleted` to trigger background analytics recalculations without blocking UI requests.
- **Unified Timeline Cache (`analytics_timeline`)**:
  - Aggregates activity events across all 10 modules into a single chronological stream with importance scores.
- **Historical Snapshots (`analytics_snapshots`)**:
  - Generates immutable daily, monthly, and yearly statistics snapshots enabling historical comparisons.

---

## 5. Native Android Journal Application (`android/`) & Mobile REST API

### 5.1 Overview
The native Android app ([android-journal.md](file:///home/dog/git/admin-cms/android-journal.md)) is an offline-first, E2EE companion application built with Kotlin, Jetpack Compose, Material 3, Room, WorkManager, Ktor, and BouncyCastle (Argon2id).

### 5.2 Key Architecture Modules
- `data/crypto/`: `CryptoEngine.kt` (Argon2id + AES-GCM), `KeystoreManager.kt`, `AssetEncryptor.kt`.
- `data/local/`: Room DB (`JournalDatabase.kt`), entities, DAOs.
- `data/remote/`: `JournalApiService.kt` (Ktor HTTP client).
- `data/sync/`: `JournalSyncWorker.kt` (WorkManager background sync).
- `domain/`: `LexicalDocument.kt` (AST node models), `LexicalParser.kt` (Bidirectional Lexical parser).
- `ui/`: Compose views, adaptive layouts, native editor, encrypted image viewer.

### 5.3 Mobile REST API Endpoints
- `POST /api/auth/login`: Authenticates password and returns JWT token.
- `GET /api/journal/status`: Reachability & health check.
- `GET` & `POST /api/journal/keys`: Manages wrapped DEK & Argon2 parameters.
- `GET` & `POST /api/journal/settings`: Manages verification payload and auto-lock settings.
- `GET`, `POST`, `PUT`, `DELETE /api/journal/entries`: Entry CRUD endpoints.
- `POST /api/journal/sync`: Batch incremental synchronization.
- `GET` & `POST /api/journal/assets`: Reads and creates E2EE journal assets.

---

## 6. How to Run Commands & Tests

- **Development Server**: `npm run dev`
- **Build Verification**: `npm run build`
- **Execute Vitest Suite**: `npm run test`
- **Type Check**: `npx tsc --noEmit`
- **Drizzle DB Push**: `npm run db:push`
- **Android App Compile**: `cd android && ./gradlew assembleDebug` (requires `JAVA_HOME=/home/dog/jdk-17` and `ANDROID_HOME=/home/dog/Android/Sdk`)

---

## 7. Performance & Optimization Implementation Matrix

 #  | Optimization Directive       | Implementation Status & Details
----|------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------
 1  | Design for Read Performance  | Implemented — Precomputed statistics (`system_stats`), search entries (`search_index`), and dashboard snapshots (`dashboard_cache`) are written asynchronously on events/mutations so reads are 0ms.
 2  | Never Calculate on Page Load | Implemented — Dashboard reads directly from precomputed `dashboard_cache` snapshot table in 1 single query.
 3  | Create Read Models           | Implemented — Operational tables are decoupled from UI tables (`dashboard_cache`, `system_stats`, `search_index`).
 4  | Build a Statistics Engine    | Implemented — Created `rebuildSystemStatsCache` and `eventBus` listeners so every mutation updates system statistics in background.
 5  | Snapshot Tables              | Implemented — `dashboard_cache` snapshot table stores precomputed counts, recent media, and activity stream.
 6  | Event-Driven Updates         | Implemented — Enhanced `eventBus` with automatic handlers listening to `entity.saved` and `entity.deleted` to update search index, stats, and dashboard snapshots.
 7  | Job Queue                    | Implemented — Heavy background tasks (Trakt/Last.fm sync, thumbnail processing, deploy hooks) run via background job queue (`jobs` table).
 8  | Fetch in Parallel            | Implemented — All multi-resource fetches across dashboard, search, and memory hubs use `Promise.all`.
 9  | Select Only Needed Columns   | Implemented — Projections in list queries select specific columns instead of fetching full body text.
 10 | Cursor Pagination            | Implemented — Created `cursor-pagination.ts` providing cursor & limit params alongside offset pagination.
 11 | Build Proper Indexes         | Implemented — Added Drizzle SQLite indexes on `createdAt`, `updatedAt`, `status`, `visibility`, `favorite`, `locationId`, `tripId`, `watchedAt`, `playedAt`, `artistName`, `slug`, and foreign keys.
 12 | Covering & Composite Indexes | Implemented — Added composite indexes `gallery_location_trip_idx`, `microblogs_status_created_at_idx`, `todos_completed_due_date_idx`, `relationships_source_idx`, `relationships_target_idx`, `collection_items_col_idx`, `search_index_query_idx`.
 13 | Eliminate N+1 Queries        | Implemented — Single-batch composite queries (`getLocationHubDataAction`, `getTripHubDataAction`, `getPersonMemoryHubDataAction`) use `inArray` to fetch 50+ relational items in 1 DB roundtrip.
 14 | Cache at Multiple Layers     | Implemented — React `cache()`, Vercel Data Cache (`createCachedQuery` & `purgeTag`), and browser SWR cache (`getBrowserCache` / `setBrowserCache`).
 15 | Server Components            | Implemented — All main views run as React Server Components, hydrating minimal client components.
 16 | Split the Dashboard          | Implemented — Independent widget loading and cached overview snapshot fallback.
 17 | Lazy Loading                 | Implemented — Deferred loading of entity pickers (`allLocations`, `allTrips`) and inactive tabs until focused/accessed.
 18 | Unified Search Index         | Implemented — Created `search_index` table replacing multi-table `like` queries with 1 single indexed SQLite query.
 19 | Relationship Cache           | Implemented — Indexed `relationships` lookup engine for fast 0ms entity linkages.
 20 | Attachments Engine           | Implemented — Pre-generated attachment metadata and thumbnails in `attachments` table.
 21 | Image Pipeline               | Implemented — Client-side thumbnail generation and Cloudinary / R2 direct uploads without blocking CMS server.
 22 | Incremental Sync             | Implemented — Trakt and Last.fm sync providers fetch only records newer than `lastSync`.
 23 | Derived Statistics Tables    | Implemented — Precomputed `system_stats` table for system counters, artist play counts, and location/trip media counts.
 24 | Dashboard Service            | Implemented — Centralized `getDashboardData` service function reading precomputed snapshot table.
 25 | Performance Layer            | Implemented — Service & Repository pattern (`src/features/*/actions.ts`) separating UI components from raw Drizzle query logic.
 26 | Measure Before Optimizing    | Implemented — Created `telemetry.ts` measuring query duration and logging performance budget warnings.
 27 | Database Maintenance         | Implemented — Auto-execute `ANALYZE;` and `PRAGMA optimize;` on database initialization in `index.ts`.
 28 | Optimize Payloads            | Implemented — Light DTO projections for list views (`hasNotes`, `hasReview`, `shortUrl` instead of multi-KB text fields).
 29 | Think in Views               | Implemented — Dedicated View Models (`MovieListView`, `GalleryGridView`, `PersonMemoryHubView`, `DashboardOverviewSnapshot`).
 30 | Set Performance Budgets      | Implemented — Enforced performance budget latencies (<100ms search, <200ms list, <300ms dashboard) in `telemetry.ts`.
