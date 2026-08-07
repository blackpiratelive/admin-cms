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
- **Publishing Workflow**: Create/Edit Post or Media -> Save to Turso -> Status set to `published` -> Non-blocking background trigger for `VERCEL_DEPLOY_HOOK` (`triggerVercelDeployHookBackground`) and asynchronous Job Queue (`jobs` table) cross-posting to Bluesky & Mastodon -> Hugo site rebuilds automatically.
- **UI & UX Highlights**: Keyboard-first Command Palette (`Ctrl+K`) for global fuzzy search across all entities and quick actions, central Settings Hub (`/settings`), Locations (`/locations` & `/locations/[slug]`), Trips (`/trips` & `/trips/[slug]`), People Memory Hubs (`/people` & `/people/[slug]`), real-time R2 usage monitors, responsive themes (HN Orange, Dark, Mono, Teal), and non-blocking background toast notifications.

---

## 2. Key Directories & Code Structure

```text
admin-cms/
├── android/                     # Flutter Cross-Platform Mobile & Tablet Application (Dart, Clean Architecture, Responsive Shell, Microblog Module, Multi-Theme)
├── .circleci/                   # CircleCI CI/CD pipeline configuration for Flutter analyze and APK build
├── src/
│   ├── app/
│   │   ├── (auth)/login/        # Password login page
│   │   ├── (dashboard)/         # Protected dashboard layout & routes
│   │   │   ├── page.tsx         # Control center overview with modular widgets
│   │   │   ├── journal/         # End-to-End Encrypted Personal Journal (/journal and /journal/editor)
│   │   │   ├── microblog/       # Microblog list & CRUD editor routes
│   │   │   ├── reading/         # Reading history, sessions & FreshRSS activity hub (/reading)
│   │   │   ├── todos/           # Todo list & Project management route
│   │   │   ├── people/          # Personal Relationship & Memory Hub routes (/people and /people/[slug])
│   │   │   ├── locations/       # Geographical locations entity page & detail hub (/locations and /locations/[slug])
│   │   │   ├── trips/           # Travel itineraries & trip grouping hub (/trips and /trips/[slug])
│   │   │   ├── analytics/       # Analytics & Memory Discovery Engine hub (/analytics & /stats)
│   │   │   ├── settings/        # Centralized Settings Hub (General, Storage, Providers, etc.)
│   │   │   ├── libraries/       # Personal Media Libraries (Movies, TV, Music, Collections)
│   │   │   └── sync/            # Sync Center integration hub (Trakt, Last.fm, FreshRSS, Bluesky, Mastodon)
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
│   │   ├── schema.ts            # Drizzle table schemas for all 52 database entities
│   │   └── index.ts             # Turso / libSQL client & auto-initializer DDL
│   ├── features/
│   │   ├── analytics/           # Modular Analytics Engine (11 providers including Reading), Memory Index scoring, timeline cache & snapshots
│   │   ├── reading/             # Reading activity server actions, Reading Influence Engine & Reading Dashboard
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
│   │   └── sync/                # Extensible Provider integration registry (Trakt, Last.fm, FreshRSS, Bluesky, Mastodon)
│   ├── lib/
│   │   ├── server-cache.ts      # Vercel Data Cache helper (createCachedQuery, purgeTag)
│   │   ├── client-cache.ts      # Client-side SWR browser cache helper (getBrowserCache, setBrowserCache)
│   │   ├── notifications.ts     # Client-side floating toast notification manager
│   │   ├── cloudinary.ts        # Direct & raw encrypted Cloudinary upload helpers
│   │   ├── event-bus.ts         # Internal event pub-sub bus
│   │   └── deploy-hook.ts       # Vercel deploy hook caller
│   └── middleware.ts            # Next.js route protection middleware
├── tests/                       # Vitest unit test suite (50 unit tests)
├── freshrss.md                  # FreshRSS Sync Provider feature specification
├── android-journal.md           # Native Android Journal Application specification
├── HUGO_CONTENT_ADAPTER.md      # Step-by-step Hugo Content Adapter setup guide
├── arch.txt                     # Architecture Evolution Plan
└── drizzle.config.ts            # Drizzle kit configuration
```

---

## 3. Database Schema Reference (`src/db/schema.ts`)

The database consists of **52 SQLite tables** managed via Drizzle ORM:

### 3.1 Core Entity Tables
- **`locations`**: Stores geographical locations. `id` (`loc_${ts}_${rand}`), `name`, `slug`, `country`, `state`, `city`, `latitude`, `longitude`, `elevation`, `timezone`, `firstVisited`, `lastVisited`, `visitCount`, `privateNotes`, `publicDescription`, `tags` (JSON string array), `visibility` (`public` | `private` | `unlisted`), `favorite`, `photographyNotes`, `parkingNotes`, `walkingDifficulty`, `weatherNotes`, `bestSeason`, `bestTimeOfDay`, `cameraRecommendations`, `personalRating`.
- **`trips`**: Travel itineraries and trip groupings. `id` (`trip_${ts}_${rand}`), `title`, `slug`, `description`, `startDate`, `endDate`, `status` (`planned` | `ongoing` | `completed` | `cancelled`), `visibility`, `favorite`, `tags`.
- **`persons`**: Personal relationship contacts & Memory Hub. `id` (`person_${ts}_${rand}`), `displayName`, `name` (legacy fallback), `firstName`, `lastName`, `nickname`, `slug`, `avatarUrl`, `relationshipType` (`Family`, `Friend`, `Partner`, `Relative`, `Colleague`, `Classmate`, `Neighbor`, `Mentor`), `importantDatesJson` (JSON array), `notesMarkdown`, `interests`, `socialLinksJson` (JSON object including Facebook, Twitter, Instagram, LinkedIn), `visibility`, `favorite`, `tags`.
- **`tags`** & **`entity_tags`**: Tag registry (`id`, `name`, `description`, `color`) and generic entity tag linkages (`id`, `tagId`, `entityType`, `entityId`).
- **`relationships`**: Generic Relationship Engine table. `id` (`rel_${ts}_${rand}`), `sourceType`, `sourceId`, `targetType`, `targetId`, `relationship` (`taken_at`, `watched_at`, `belongs_to`, `mentions`, `contains`, `related_to`, `references`, `includes_location`).
- **`attachments`**: Reusable media attachment system. `id` (`att_${ts}_${rand}`), `entityType`, `entityId`, `kind` (`screenshot`, `poster`, `cover`, `hero`, `gallery_ref`, `video`, `pdf`, `file`), `url`, `mime`, `width`, `height`, `metadataJson`.
- **`jobs`**: Background task queue. `id` (`job_${ts}_${rand}`), `type` (`sync_provider`, `image_processing`, `search_indexing`, `deploy_site`), `payloadJson`, `status` (`queued`, `running`, `completed`, `failed`, `cancelled`), `progress`, `errorMessage`, `resultJson`, `attempts`, `maxAttempts`.
- **`projects`** & **`todos`**: Projects (`name`, `slug`, `description`, `repositoryUrl`, `websiteUrl`, `status`, `technologies`, `startDate`, `completedDate`, `visibility`) and Todos (`title`, `description`, `dueDate`, `priority`, `completed`, `projectId`, `tags`).
- **`notes`**, **`bookmarks`**, **`quotes`**: Markdown notes, web bookmarks, and literary quotes with visibility and tags.

### 3.2 Media Libraries & Content Tables
- **`microblogs`** & **`related_microblogs`**: Microblog posts (`slug`, `contentMarkdown`, `status`, `tags`, `coverImageUrl`, `images`, `shortUrl`, `locationId`, `tripId`) and related microblog graph.
- **`gallery`**: Photo gallery (`title`, `slug`, `description`, `originalUrl`, `largeUrl`, `mediumUrl`, `thumbnailUrl`, `width`, `height`, `fileSize`, `mimeType`, EXIF fields `camera`, `lens`, `focalLength`, `aperture`, `shutterSpeed`, `iso`, `takenAt`, `latitude`, `longitude`, `locationName`, `locationId`, `tripId`, `visibility`, `featured`, `tags`, `album`, `shortUrl`).
- **`trakt_movies`**, **`trakt_shows`**, **`trakt_episodes`**: Provider data synced from Trakt.tv.
- **`lastfm_scrobbles`**, **`lastfm_artists`**, **`lastfm_albums`**, **`lastfm_tracks`**: Provider data synced from Last.fm.
- **`rss_articles`**, **`rss_feeds`**, **`rss_categories`**, **`rss_read_events`**, **`rss_starred_articles`**, **`rss_sync_state`**: FreshRSS reading history, starred articles, feed metadata, and incremental sync checkpoints.
- **`movie_metadata`**, **`tv_show_metadata`**, **`artist_metadata`**, **`album_metadata`**, **`track_metadata`**: CMS-owned personal metadata tables (`favorite`, `personalRating`, `review`, `notes`, `tags`, `visibility`, `watchedWith`, `watchLocation`, `locationId`, `tripId`, `relatedPhotos`, `relatedMicroblogs`).
- **`collections`** & **`collection_items`**: Generic curated collections grouping any media items (`movie`, `show`, `artist`, `album`, `track`, `book`, `project`, `photo`, `location`, `trip`, `note`, `bookmark`, `quote`).
- **`activities`**: System and user activity stream (`action`, `entityType`, `entityId`, `title`, `metadataJson`).

### 3.3 Sync & Performance Caching Tables
- **`providers`** & **`sync_logs`**: Provider integration registry (Trakt, Last.fm, FreshRSS, Bluesky, Mastodon) and execution logs.
- **`dashboard_cache`**: Precomputed snapshot key-value store for 0ms dashboard renders.
- **`search_index`**: Universal multi-table search index (`entityType`, `entityId`, `title`, `subtitle`, `keywords`, `url`).
- **`system_stats`**: Derived system statistics counters.

### 3.4 End-to-End Encrypted (E2EE) Journal Tables
- **`journal_entries`**: Encrypted journal entries (`id`, `slug`, `entryDate`, `entryType`, `mood`, `favorite`, `visibility`, `locationId`, `tripId`, `weatherId`, `encryptedContent`, `encryptionVersion`, `iv`, `salt`, `wordCount`, `readingTime`, `tags`).
- **`journal_revisions`**: Immutable revision snapshots of journal entries (`entryId`, `encryptedContent`, `iv`, `salt`).
- **`journal_settings`**: Vault settings (`salt`, `verificationPayload`, `verificationIv`, `autoLockMinutes`).
- **`journal_keys`**: Cryptographic Key Record (`encryptedDek`, `salt`, `iv`, `algorithm`, `kdf`, `argonMemory`, `argonIterations`, `argonParallelism`, `keyVersion`).
- **`journal_assets`**: Encrypted image asset metadata (`assetType`, `mimeType`, `width`, `height`, `originalSize`, `compressedSize`, `thumbnailSize`, `cloudinaryOriginalPublicId`, `cloudinaryThumbnailPublicId`, `originalIv`, `thumbnailIv`, `encryptionVersion`).
- **`journal_entry_assets`**: Linkage between journal entries and encrypted assets (`entryId`, `assetId`, `assetRole`, `position`).

### 3.5 Analytics Engine & Memory Cache Tables
- **`analytics_metrics`**: Aggregated module metrics key-value cache (`id`, `module`, `metricName`, `metricValue`, `metadataJson`, `updatedAt`).
- **`analytics_daily`**, **`analytics_monthly`**, **`analytics_yearly`**: Time-aggregated metrics cache per daily, monthly, and yearly intervals.
- **`analytics_relationships`**: Graph relationships with weights between entities.
- **`analytics_timeline`**: Unified activity timeline cache combining entries across all 11 modules.
- **`analytics_snapshots`**: Immutable historical statistics snapshots (`daily`, `monthly`, `yearly`).
- **`analytics_memory_scores`**: Memory Index scores across entities (Richness, Diversity, Longevity, Recurrence, Recency, Favorite Bonus, Pinned Bonus, Final Score, Pin status).
- **`analytics_dashboard`**: Cached analytics widget snapshots.
- **`analytics_search`**: Search ranking weights & score boosts.
- **`analytics_trends`**: Multi-period trend metrics cache.

---

## 4. Key Subsystems & Architectures

### 4.1 FreshRSS Sync Provider & Reading Subsystem
- **Canonical Source Philosophy**: FreshRSS remains canonical for RSS feed XML and unread article states. The CMS imports reading activity, starred articles, and metadata only, strictly avoiding storing article HTML body text.
- **Google Reader API Authentication**: Connects using FreshRSS GReader API compatibility layer (`/api/greader.php`) supporting `ClientLogin` (with `Passwd` parameter and `User-Agent` headers) and Basic Auth fallbacks.
- **Reading Analytics DB Caching**: Precomputes all reading metrics (total read, streaks, sessions, top categories, favorite sources, habits) into `analyticsMetrics` under key `summary_reading` for **0ms instant DB cache reads** without calculating on page loads.
- **High-Performance Chunked Sync & Batch History Mode**: Queries `user/-/state/com.google/reading-list` main stream alongside read/starred streams. Uses 100-item chunked batch database operations (`chunkArray`) and continuation-token stream pagination (`c=...`) for high-speed sync matching Last.fm. Includes UI Sync Mode selector (`Incremental` vs `Batch History (Deep Fetch)`) in `ProviderCard.tsx`.
- **Local DB Log Viewer**: Features interactive live terminal logs and local DB audit log inspector (`Local Logs` button and `/sync/logs?provider=freshrss` route) directly in the UI.
- **Reading Influence Engine**: `getReadingAroundTimeAction` surfaces articles read or published around specific dates, embedding "Reading Around This Time" context into Journal Entries, Trips, and Projects.
- **Reading Sessions & Heatmaps**: Automatically groups reading events within 30-minute windows into reading sessions with estimated reading time and word counts.

### 4.2 Performance & Multi-Layer Caching Architecture
- **Single-Batch Composite Queries**: High-traffic hub pages (`/locations/[slug]`, `/trips/[slug]`, `/people/[slug]`) execute 1 single DB roundtrip using Drizzle `inArray` queries instead of 50+ sequential database requests.
- **Granular Tag Purging over Root Revalidation**: Server Actions use targeted `purgeTag()` invalidations instead of `revalidatePath("/")`, preventing Next.js App Router from synchronously re-rendering root server components during action responses.
- **Background Microtasks for Keyword & Related Posts Matching**: Microblog keyword matching (`updateRelatedPosts`) runs asynchronously in `queueMicrotask`, allowing `saveMicroblog` to return immediately.
- **Network Resilience & Timeout Bounds**: External API integrations (e.g., `fetchFromRapidLinkApi` in `src/features/links/actions.ts`) use `AbortController` with 3,000ms timeout limits to prevent external service degradation from blocking CMS updates.
- **Optimistic Client State & Background Modal Execution**: Client components (`TodoDashboard`, `LocationFormModal`, `PersonFormModal`, `TripFormModal`) close modals and update UI state immediately (**0 ms perceived latency**), executing server actions in background worker tasks via `notify.bg(...)`.
- **Client-Side SWR Browser Caching (`getBrowserCache` / `setBrowserCache`)**: Client-side browser cache in `src/lib/client-cache.ts` providing **0ms instant initial paints** on navigation.
- **Non-Blocking Background Write Engine & Toast Notifications**: Modals and forms close instantly (0ms latency). Operations execute asynchronously in the background, presenting floating toast notifications (`src/lib/notifications.ts` & `src/components/ToastNotification.tsx`).
- **Single-Batch Schema Initialization (`ensureDbInitialized`)**: Replaced 55+ sequential individual `client.execute()` table creation calls with a single `client.executeMultiple()` DDL batch query in [src/db/index.ts](file:///home/dog/git/admin-cms/src/db/index.ts). Reduced cold start DB initialization latency from **8,000–15,000 ms down to ~9.8 ms**.
- **Analytics Bulk Insert Optimization (`rebuildAllAnalyticsCache`)**: Replaced 400+ sequential single-row inserts (`analyticsMemoryScores`, `analyticsTimeline`, `analyticsDaily`, `analyticsMonthly`, `analyticsYearly`) with chunked bulk insert queries in [src/features/analytics/core.ts](file:///home/dog/git/admin-cms/src/features/analytics/core.ts). Reduced analytics cache rebuild latency from **28,000 ms down to 245 ms**.
- **Performance Budget Enforcement**: Enforces `<50ms` latency budgets (`entityEditMaxMs: 50`) in `src/lib/telemetry.ts` across all entity edit Server Actions (`saveMicroblog`, `updateLocation`, `updatePersonAction`, `saveTodo`).

### 4.3 Universal Search & Command Palette (`Ctrl+K`)
- Accessible via header button or `Ctrl+K`.
- Queries `search_index` table using indexed SQLite queries (<100ms response time).
- Features quick actions for entity creation, provider syncing, reading stream lookup, and settings navigation.

### 4.4 End-to-End Encrypted (E2EE) Journal System
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
- **Mobile Responsiveness & Adaptive UX**:
  - Fully mobile-optimized responsive layout across Journal Hub (`/journal`) and Lexical Editor (`/journal/editor`).
  - Stacks two-column editor grid (`1fr 300px`) into 1-column on mobile viewports (<900px) so rich text editor and contextual connection panel do not overflow horizontally.
  - Horizontal swipeable/scrollable Lexical toolbar with 34px+ touch targets, preventing icon clutter and off-screen button wrapping.
  - Adaptive 2-column/1-column statistics widgets (`.journal-stats-grid`) and metadata pickers (`.journal-editor-meta-grid`) for portrait phone screens (320px–480px).
  - Responsive calendar grid (`.journal-calendar-day`) with auto-scaling entry dot indicators on small mobile viewports.

### 4.5 Analytics Engine & Memory Discovery Architecture (`src/features/analytics/`)
- **Modular Provider Architecture**:
  - 11 Independent Analytics Providers: `Journal`, `Microblog`, `Todos`, `Gallery`, `Movies`, `TV Shows`, `Music`, `People`, `Locations`, `Trips`, `Reading`.
  - Core engine combines provider calculations into 11 dedicated cache tables without executing runtime aggregations on page loads.
- **Memory Index Scoring Engine (`src/features/analytics/scoring.ts`)**:
  - Multi-dimensional ranking combining Richness, Diversity, Longevity, Recurrence, Recency, Favorite Bonus, and Pinned Bonus.
  - Drives discovery across Memory Hub, People rankings, Location significance, Trip importance, and search result ranking boost.
- **Event-Driven Non-Blocking Microtasks & Debounced Analytics Scheduler**:
  - `EventBus` (`src/lib/event-bus.ts`) executes subscriber callbacks asynchronously off the Server Action thread using `queueMicrotask`, returning in **~14 ms** instead of blocking for 3,500+ ms.
  - Analytics cache rebuilds use `scheduleBackgroundAnalyticsRebuild(5000)` (`src/features/analytics/core.ts`) with a **5-second sliding window debounce** and concurrency protection to consolidate rapid entity edits into a single background recalculation.
- **Unified Timeline Cache (`analytics_timeline`)**:
  - Aggregates activity events across all 11 modules into a single chronological stream with importance scores.
- **Historical Snapshots (`analytics_snapshots`)**:
  - Generates immutable daily, monthly, and yearly statistics snapshots enabling historical comparisons.

---

## 5. Flutter Mobile & Tablet Application (`android/`) & CircleCI Pipeline

### 5.1 Overview
The mobile app (`android/`) is a cross-platform Flutter application designed to replicate the web CMS visual aesthetics, responsive ergonomics, and theme system across Android smartphones and tablets.

### 5.2 Key Architecture Modules
- `lib/core/network/`: `api_client.dart` (REST client handling dynamic server URL connection, authentication, Microblog CRUD, location/trip pickers, and Vercel deployment hook trigger).
- `lib/core/theme/`: `app_theme.dart` (Design system tokens supporting HN Orange `#FF6600`, Dark Mode, Mono, and Teal themes).
- `lib/core/storage/`: `app_storage.dart` (Encrypted secure storage for JWT tokens, server URL, theme selection, and autosave preferences).
- `lib/core/models/`: Models for `microblog.dart`, `location.dart`, `trip.dart`, and `social_status.dart`.
- `lib/shared/widgets/`: `app_header.dart` (Header bar with `Ctrl+K` Command Palette launcher), `app_sidebar.dart` (Tablet/Desktop 16-module navigation sidebar), `app_drawer.dart` (Mobile navigation drawer), `deploy_widget.dart` (Sidebar footer Vercel deploy trigger widget), `command_palette.dart` (Fuzzy command search modal), and `toast_notification.dart`.
- `lib/modules/microblog/`: `microblog_list_screen.dart` (Feature-complete list view with search, status filters, per page pagination, batch selection & deletion, inline edit/delete, status badges) and `microblog_editor_screen.dart` (CRUD editor with 4-tab metadata panel, location/trip pickers, date-time pickers, tag chip editor, social cross-posting to Bluesky & Mastodon, cover/media manager, RapidLink short URL generator, and live markdown preview).
- `lib/modules/placeholders/`: `placeholder_module_screen.dart` (Polished "Coming Soon" placeholder views for remaining 15 CMS modules).

### 5.3 CircleCI CI/CD Pipeline (`.circleci/config.yml`)
- Automated build workflow running on `cimg/android:2026.07-ndk`.
- Clones Flutter stable channel, runs `flutter pub get`, performs `flutter analyze` static analysis check, builds `--release` APK (`flutter build apk --release`), and stores `app-release.apk` artifact.

---

## 6. How to Run Commands & Tests

- **Development Server**: `npm run dev`
- **Build Verification**: `npm run build`
- **Execute Vitest Suite**: `npm run test`
- **Type Check**: `npx tsc --noEmit`
- **Drizzle DB Push**: `npm run db:push`
- **Flutter App Static Analysis**: `cd android && flutter analyze`

---

## 7. Performance & Optimization Implementation Matrix

 #  | Optimization Directive       | Implementation Status & Details
----|------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------
 1  | Design for Read Performance  | Implemented — Precomputed statistics (`analytics_metrics`, `analytics_dashboard`), search entries (`search_index`), and snapshot tables read in 0ms without live runtime aggregations.
 2  | Never Calculate on Page Load | Implemented — `/analytics` reads directly from precomputed `analytics_dashboard` snapshot table in 1 single query.
 3  | Create Read Models           | Implemented — Operational tables are decoupled from UI tables (`analytics_metrics`, `analytics_timeline`, `analytics_memory_scores`, `analytics_snapshots`).
 4  | Build a Statistics Engine    | Implemented — Created `rebuildAllAnalyticsCache` and `eventBus` listeners so every mutation updates system statistics in background.
 5  | Snapshot Tables              | Implemented — `analytics_snapshots` stores precomputed daily, monthly, and yearly statistics snapshots.
 6  | Event-Driven Updates         | Implemented — Enhanced `eventBus` with automatic handlers listening to `entity.saved` and `entity.deleted` to update analytics caches asynchronously.
 7  | Job Queue                    | Implemented — Heavy background tasks run via background job queue (`jobs` table).
 8  | Fetch in Parallel            | Implemented — All multi-resource fetches across providers and dashboards use `Promise.all`.
 9  | Select Only Needed Columns   | Implemented — Projections select specific columns instead of fetching full body text.
 10 | Cursor Pagination            | Implemented — `src/lib/cursor-pagination.ts` provides cursor & limit params for `getUnifiedTimelineAction`.
 11 | Build Proper Indexes         | Implemented — Added Drizzle SQLite indexes on `analytics_metrics(module)`, `analytics_timeline(date)`, `analytics_memory_scores(final_score)`, and `analytics_daily(date)`.
 12 | Covering & Composite Indexes | Implemented — Composite indexes `analytics_timeline_date_score_idx`, `analytics_memory_scores_type_score_idx`, `analytics_snapshots_type_created_idx`, `analytics_metrics_module_metric_idx`.
 13 | Eliminate N+1 Queries        | Implemented — Atomic `onConflictDoUpdate` upserts for `analytics_memory_scores`, `analytics_timeline`, and `analytics_metrics` eliminate individual SELECT loops.
 14 | Cache at Multiple Layers     | Implemented — L1 in-memory TTL cache (`l1GlobalOverviewCache`), React `cache()`, and SQLite cache tables.
 15 | Server Components            | Implemented — `/analytics/page.tsx` runs as a React Server Component, hydrating client components with pre-cached payloads.
 16 | Split the Dashboard          | Implemented — Independent tab loading (Overview, Module Deep Dives, Memory Hub, Unified Timeline, Historical Snapshots).
 17 | Lazy Loading                 | Implemented — Deferred loading of module deep dive data (`getModuleAnalyticsAction`) until tab is selected.
 18 | Unified Search Index         | Implemented — Memory Index scores (`analytics_memory_scores`) integrated into `searchEverything()` to boost search rankings.
 19 | Relationship Cache           | Implemented — `analytics_relationships` lookup engine for fast 0ms entity linkages.
 20 | Attachments Engine           | Implemented — Pre-generated attachment metadata and counts in journal and gallery analytics providers.
 21 | Image Pipeline               | Implemented — Pre-generated thumbnail URLs stored directly in `analytics_timeline` cache for instant rendering.
 22 | Incremental Sync             | Implemented — Incremental snapshot updates (`generateAnalyticsSnapshot`) targeting active `periodKey`.
 23 | Derived Statistics Tables    | Implemented — Precomputed `analytics_metrics` table for per-module metric counts and aggregated JSON.
 24 | Dashboard Service            | Implemented — Centralized `getCachedGlobalOverview` service function reading precomputed `analytics_dashboard` snapshot.
 25 | Performance Layer            | Implemented — Service & Repository pattern (`src/features/analytics/core.ts` & `actions.ts`) separating UI components from Drizzle queries.
 26 | Measure Before Optimizing    | Implemented — Created `src/lib/telemetry.ts` measuring query duration and logging performance budget warnings.
 27 | Database Maintenance         | Implemented — Auto-execute `ANALYZE analytics_metrics; ANALYZE analytics_memory_scores; ANALYZE analytics_timeline; ANALYZE analytics_snapshots; PRAGMA optimize;` in `index.ts`.
 28 | Optimize Payloads            | Implemented — Light DTO projections (`MemoryScoreBreakdown`, `TimelineCacheItem`, `AnalyticsSnapshotDTO`) sending compact payloads.
 29 | Think in Views               | Implemented — Dedicated View Models (`ModuleDeepDiveView`, `GlobalOverviewStats`, `JournalAnalyticsData`).
 30 | Set Performance Budgets      | Implemented — Enforced performance budget latencies (<100ms overview/rankings, <200ms timeline, <300ms full rebuild) in `telemetry.ts`.
