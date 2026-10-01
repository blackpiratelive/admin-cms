# AI Handoff & Personal Knowledge Platform Architecture Blueprint

> **Notice to Future AI Assistants**: Read this document first to immediately understand the repository structure, schema, conventions, and Personal Knowledge Platform (PKP) design philosophy without spending tokens parsing the entire codebase.
> Always update this document (`AI_HANDOFF.md`) before committing and pushing changes to GitHub!
>
> 📖 **Hugo Integration**: For instructions on plugging Hugo Content Adapters to this CMS, read [HUGO_CONTENT_ADAPTER.md](file:///home/dog/git/admin-cms/HUGO_CONTENT_ADAPTER.md).
>
> 📱 **Microblog Flutter App**: For architecture blueprint and developer handoff for the standalone Cupertino Microblog client, read [MICROBLOG_APP_HANDOFF.md](file:///home/dog/git/admin-cms/MICROBLOG_APP_HANDOFF.md).
>
> 👥 **People Flutter App**: For architecture blueprint and developer handoff for the standalone Cupertino People & Memory Hub client, read [PEOPLE_APP_HANDOFF.md](file:///home/dog/git/admin-cms/PEOPLE_APP_HANDOFF.md).

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
├── android/                     # Flutter Cross-Platform Mobile & Tablet Application (Dart, Clean Architecture, Responsive Shell, Multi-Module, Multi-Theme)
├── mobile-microblog/            # Standalone Cupertino iOS Microblog Application (Apple Cupertino Design System, Fast Modal Composer, Offline-First)
├── mobile-people/               # Standalone Cupertino iOS People & Memory Hub Application (Apple Cupertino Design System, 7-Day TTL Offline-First Cache, Persistent Image Caching, Push Reminders)
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
│   │   │   ├── people/          # People & Memory Hub REST API (CRUD, /birthdays, /pickers, /[id]/favorite, /[id]/connections)
│   │   │   ├── geocode/         # Mapbox forward-geocoding proxy for Location search autocomplete (keeps MAPBOX_TOKEN server-side)
│   │   │   └── journal/         # Journal Sync & E2EE API (/status, /keys, /settings, /entries, /sync, /assets)
│   │   ├── globals.css          # Design tokens, themes (HN Orange, Dark, Mono, Teal)
│   │   └── layout.tsx           # Root layout & ThemeProvider
│   ├── components/              # Shared UI (Header, Sidebar, CommandPalette, DeployWidget, ToastNotification, EntityCombobox, PhotoPickerModal)
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
│   │   ├── trips/               # Trip management server actions, location linkage & day-by-day journal (day-actions.ts, day-helpers.ts)
│   │   ├── pickers/             # Shared Location/Trip picker data: light option projections + server-derived recents (actions.ts, types.ts)
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
├── tests/                       # Vitest unit test suite (112 unit tests across 19 test files)
├── freshrss.md                  # FreshRSS Sync Provider feature specification
├── android-journal.md           # Native Android Journal Application specification
├── HUGO_CONTENT_ADAPTER.md      # Step-by-step Hugo Content Adapter setup guide
├── arch.txt                     # Architecture Evolution Plan
└── drizzle.config.ts            # Drizzle kit configuration
```

---

## 3. Database Schema Reference (`src/db/schema.ts`)

The database consists of **53 SQLite tables** managed via Drizzle ORM:

### 3.1 Core Entity Tables
- **`locations`**: Stores geographical locations. `id` (`loc_${ts}_${rand}`), `name`, `slug`, `country`, `state`, `city`, `latitude`, `longitude`, `elevation`, `timezone`, `firstVisited`, `lastVisited`, `visitCount`, `privateNotes`, `publicDescription`, `tags` (JSON string array), `visibility` (`public` | `private` | `unlisted`), `favorite`, `photographyNotes`, `parkingNotes`, `walkingDifficulty`, `weatherNotes`, `bestSeason`, `bestTimeOfDay`, `cameraRecommendations`, `personalRating`.
- **`trips`**: Travel itineraries and trip groupings. `id` (`trip_${ts}_${rand}`), `title`, `slug`, `description`, `startDate`, `endDate`, `status` (`planned` | `ongoing` | `completed` | `cancelled`), `visibility`, `favorite`, `tags`.
- **`trip_days`**: Per-day travel journal entries for a trip (one row per day). `id` (`tripday_${ts}_${rand}`), `tripId`, `dayNumber` (1-based ordering), `date` (ISO `YYYY-MM-DD`), `title`, `primaryLocationId` (→ `locations`) / `primaryLocationName` (free-text fallback), `transportJson` (legs: mode `walk`|`bike`|`bus`|`train`|`flight`|`car`|`taxi`|`boat`|`other`, from/to, times, cost+currency), `mealsJson` (type `breakfast`|`lunch`|`dinner`|`snack`|`drinks`, place, dishes, rating, cost), `activitiesJson`, `accommodationJson`, `photosJson` (Cloudinary URLs), `weather`, `mood` (1–5), `notesMarkdown`. Cost roll-ups are computed at read time and grouped by currency.
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
- **Markdown Bundle (.zip) Export Engine**:
  - `JournalExportModal.tsx`, `crypto-assets.ts`, and `journal-helpers.ts` package decrypted entries into individual `.md` files bundled inside a single `.zip` archive.
  - Automatically queries, downloads, and decrypts all attached and inline images via `downloadAndDecryptJournalAssetBuffer` into the `images/` directory within the `.zip` archive.
  - Converts Lexical JSON AST to clean Markdown (`lexicalStateToMarkdown`) preserving headings, checklists, lists, blockquotes, inline code, and formatting bitmasks, mapping inline `journal-image` nodes to local `images/` relative paths.
  - Generates standardized YAML frontmatter for each `.md` file containing `journal: true`, `date: YYYY-MM-DD` (e.g. `2026-12-31`), `title`, `entryType`, `mood`, `favorite`, `tags`, and `images:` list for all attachments.
  - Appends standalone attachment images under an `### Attachments` section in the markdown body.
  - Guarantees collision-free sanitized filenames inside the zip (e.g. `YYYY-MM-DD-entry-title.md`).
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

### 4.6 Responsive Web Shell (Mobile Layout)
- **Overflow-Safe App Shell**: `.app-container` and `.main-content` (`src/app/globals.css`) use `max-width: 100%` + `overflow-x: clip` so a stray wide child can never introduce horizontal page scrolling. `.main-content` padding tightens to `16px 12px` on mobile.
- **Non-Overflowing Sticky Header**: `.top-header` is a flex row with `gap` and a shrinkable left cluster (`min-width: 0; overflow: hidden`). The brand label truncates with ellipsis; `.header-right` is `flex-shrink: 0` so action buttons stay intact.
- **Adaptive Header Controls (`Header.tsx` + `@media (max-width: 768px)`)**: On phones the `HUGO + TURSO` brand badge, the "Search Everything..." label + `Ctrl+K` kbd hint (`.header-search-label` / `.header-search-kbd`), and the "Logout" label (`.header-logout-label`) are hidden, collapsing the Command Palette trigger and logout to icon-only buttons that fit narrow viewports.
- **Form Modal Mobile Optimization**: Defined the previously-missing shared `.form-input` control (`width: 100%; box-sizing: border-box; min-width: 0`) so inputs/selects/textareas in `PersonFormModal`, `LocationFormModal`, `TripFormModal` (and everywhere else the class is used) stretch to their container instead of overflowing at intrinsic browser width. Each form carries the `modal-form` class, and `@media (max-width: 640px) .modal-form [style*="grid-template-columns"]` collapses all inline two/three-column field grids to a single column on phones.

### 4.7 Location Search & Autocomplete (Mapbox Geocoding)
- **Server-Side Geocoding Proxy (`/api/geocode`)**: `GET /api/geocode?q=...` proxies Mapbox Geocoding API v6 forward geocoding server-side so `MAPBOX_TOKEN` is never exposed to the client. Returns a normalized flat `GeocodeResult[]` (`id`, `name`, `label`, `city`, `state`, `country`, `latitude`, `longitude`). Bounded by a 4s `AbortController` timeout; returns `501` when `MAPBOX_TOKEN` is unset, `502` on upstream errors, `504` on timeout, and an empty result set for queries under 2 characters.
- **Live Autocomplete in `LocationFormModal`**: A "Search for a place" field at the top of the Add/Edit Location modal debounces input (300ms), cancels in-flight requests via `AbortController`, and renders a keyboard-navigable dropdown (↑/↓/Enter/Esc). Selecting a result auto-fills name, city, state, country, latitude, and longitude — all fields remain manually editable afterward. Requires `MAPBOX_TOKEN` in the environment; when absent, manual entry still works and the UI surfaces a clear message.

### 4.8 Trip Day-by-Day Travel Journal & Pervasive Location Entity Reuse (`src/features/trips/`)
- **Data model**: A single `trip_days` table (see §3.1) holds one row per day with structured repeatable lists stored as JSON columns (transport legs, meals, activities, accommodation), following the codebase's established JSON-column idiom. Days link to the trip by `tripId` and are ordered by `dayNumber` then `date`.
- **Pervasive Location Reuse**: Day primary location, transport legs (from/to), meals, activities, and accommodation all reuse first-class Location entities via `LocationPickerField` (`src/features/locations/components/LocationPickerField.tsx`) backed by `EntityCombobox`. Custom free-text is fully supported as an inline fallback.
- **Auto-Relationship Linking**: Whenever an itinerary day is updated (`updateTripDayAction`), all referenced location entities across primary location, transport (`fromLocationId`, `toLocationId`), meals (`placeLocationId`), activities (`locationId`), and accommodation (`locationId`) are automatically connected to the trip via `addRelationship("trip", tripId, "location", locId, "includes_location")`. The trip's "Locations Visited" tab reflects all itinerary places without requiring separate manual linking.
- **Location Name Resolution & Denormalization**: `updateTripDayAction` automatically populates `primaryLocationName` from `locations.name` whenever a `primaryLocationId` is specified, ensuring backwards compatibility and 0ms fallback reads. `DayCard` resolves location IDs to live location names across primary place, transport legs, meal spots, activities, and hotels.
- **In-Picker Quick-Creation with Mapbox Geocoding**: Searching a location in `LocationPickerField` triggers a debounced forward-geocoding lookup via `/api/geocode`. Non-existent locations can be quick-created on the fly via `quickCreateLocationAction` with auto-filled city, state, country, and GPS coordinates, instantly linking to the trip and selecting in the active picker.
- **Server actions (`day-actions.ts`)**: `getTripDaysAction`, `generateTripDaysFromDatesAction` (idempotently creates one empty day per date in `[startDate, endDate]`, filling only gaps), `addTripDayAction`, `updateTripDayAction` (structured payload → JSON server-side with auto-linking and denormalization), and `deleteTripDayAction`. Writes purge `trips-list`/`trip-${id}`/`trip-${slug}`/`locations-list` and `revalidatePath('/trips/${slug}')`.
- **Pure helpers (`day-helpers.ts`)**: Non-server module holding the entry interfaces, `TRANSPORT_MODES`/`MEAL_TYPES`, `parseTripDay`, `enumerateDateRange`, and cost roll-up helpers (`computeDayCost`, `computeTripCostSummary`, `formatCostTotals`) — spend is grouped by currency and computed at read time (e.g. `₹4,500 + $30`). Reused by both the UI and unit tests.
- **UI**: First "Itinerary" tab on `/trips/[slug]` renders `TripItineraryTab` — a spend summary + day-count header with "Auto-generate days" and "Add day" buttons, and a vertical timeline of day cards. `TripDayEditorModal` provides a full multi-section editor with `LocationPickerField` across all location points. "Locations Visited" tab upgraded to `EntityCombobox` for searching and linking locations.

### 4.9 Searchable Entity Pickers (`EntityCombobox`), Trip Prioritization & Server-Derived Recents
- **Problem addressed**: Every Location/Trip association control was a native `<select>` that dumped the entire table into `<option>`s and shipped full entity rows just to render labels. This is unusable and payload-heavy as Locations/Trips scale into the 100–200+ range.
- **Shared component (`src/components/EntityCombobox.tsx`)**: A `"use client"` type-ahead combobox reused by every location/trip picker. Features search icon input, keyboard navigation (↑/↓/Enter/Esc), outside-click close, a clear (✕) button, capped result list (8), and interactive `extraActions` for quick-creation.
- **Trip Prioritization**: Supports `priorityIds` (e.g. locations already associated with the active trip via `getTripLocationIds(tripId)`), floating them to the very top with distinctive 📍 MapPin icons before recents, favorites, and the rest of the catalog.
- **Server-derived recents**: "Recently used" is computed at read time by scanning every table that references a location/trip (`microblogs`, `gallery`, `trip_days.primaryLocationId`, `movie_metadata`, `tv_show_metadata`, `journal_entries`), keeping the max `updatedAt` per id and taking the newest few. Standalone `getTripLocationIds()` allows quick trip-scoped lookup.
- **Light option projections (`src/features/pickers/actions.ts` + `types.ts`)**: `getLocationPickerData()` / `getTripPickerData()` return `{ options, recentIds }`.
- **Tests**: `tests/pickers.test.ts` (6 tests) and `tests/trip-days.test.ts` (5 tests) verify option projection, recents ordering, trip location derivation, quick-creation, and automated relationship linking.

---

## 5. Flutter Mobile & Tablet Application (`android/`) & CircleCI Pipeline

### 5.1 Overview
The mobile app (`android/`) is a cross-platform Flutter application designed to replicate the web CMS visual aesthetics, responsive ergonomics, and theme system across Android smartphones and tablets.

### 5.2 Key Architecture Modules & REST API
- **Next.js REST API Endpoints (`src/app/api/`)**:
  - `/api/microblogs` (`GET` list/search/pagination, `POST` save/update microblog)
  - `/api/microblogs/[id]` (`GET` single microblog, `DELETE` microblog)
  - `/api/microblogs/batch-delete` (`POST` batch delete microblogs)
  - `/api/locations` (`GET` location records for editor picker)
  - `/api/trips` (`GET` trip records for editor picker)
  - `/api/upload` (`POST` multipart image upload to Cloudinary)
  - `/api/upload/raw` (`POST` raw encrypted `.enc` binary blob upload to Cloudinary)
  - `/api/journal/status` (`GET` vault initialization status)
  - `/api/journal/keys` (`GET`/`POST` encrypted DEK/KEK key record)
  - `/api/journal/settings` (`GET`/`POST` vault salt & verification payload)
  - `/api/journal/entries` (`GET`/`POST` encrypted journal entries)
  - `/api/journal/entries/[id]` (`GET`/`PUT`/`DELETE` single entry)
  - `/api/journal/assets` (`GET`/`POST`/`DELETE` encrypted asset records)
  - `/api/journal/pickers` (`GET` locations, trips, people, projects for context sidebar)
  - `/api/journal/context` (`GET` movies, scrobbles, photos for "On This Day" date query)
- `lib/core/crypto/`: `journal_crypto.dart` (Argon2id KDF + AES-256-GCM DEK/KEK zero-knowledge engine, raw byte encryption/decryption for attachments, Lexical JSON AST parser and builder) and `journal_session_vault.dart` (In-memory RAM DEK retention session manager).
- `lib/core/network/`: `api_client.dart` (REST client handling dynamic server URL connection, 30-second default request timeouts, 120-second upload timeouts, authentication, Microblog CRUD, Journal E2EE CRUD, Encrypted Raw Asset uploads/downloads, location/trip/people pickers, image uploads, and Vercel deployment hook trigger).
- `lib/core/theme/`: `app_theme.dart` (Design system tokens supporting HN Orange `#FF6600`, Dark Mode, Mono, and Teal themes).
- `lib/core/storage/`: `app_storage.dart` (Encrypted secure storage for JWT tokens, server URL, theme selection, and autosave preferences) and `offline_store.dart` (Offline-first local persistent store & background sync queue manager for Journal entries and Microblogs).
- `lib/core/models/`: Models for `microblog.dart`, `location.dart`, `trip.dart`, `social_status.dart`, `journal_entry.dart`, `journal_key.dart`, `journal_settings.dart`, and `journal_asset.dart`.
- `lib/shared/widgets/`: `app_header.dart` (Header bar wrapped in `SafeArea` with live `Unsaved Changes` indicator pill, sync trigger button, and `Ctrl+K` Command Palette launcher), `app_sidebar.dart` (Tablet/Desktop 16-module navigation sidebar), `app_drawer.dart` (Mobile navigation drawer), `deploy_widget.dart` (Sidebar footer Vercel deploy trigger widget), `command_palette.dart` (Fuzzy command search modal), and `toast_notification.dart`.
- `lib/modules/journal/`: `journal_unlock_modal.dart` (Master password unlock & session vault setup dialog), `journal_main_screen.dart` (Flagship vault view with local-first instant loading, mobile-responsive 2x2 stat cards, Lexical JSON AST text extractor, decrypted fuzzy search, and sub-tabs for Timeline list, Monthly Calendar, and Mood/Streak Stats), `journal_editor_screen.dart` (CRUD entry editor with local-first saving, background sync, mobile responsive layout, Lexical JSON builder/parser, formatting toolbar, date/type/mood/template inserter, `JournalAttachmentsWidget` for E2EE blobs, and functional Context & Connections sidebar).
- `lib/modules/microblog/`: `microblog_list_screen.dart` (Feature-complete list view with local-first offline caching, search, status filters, per page pagination, batch selection & deletion, inline edit/delete, status badges) and `microblog_editor_screen.dart` (CRUD editor with local-first saving, 4-tab metadata panel, location/trip pickers, date-time pickers, tag chip editor, social cross-posting to Bluesky & Mastodon, native `image_picker` Cloudinary media uploader, RapidLink short URL generator, and live markdown preview).
- `lib/modules/placeholders/`: `placeholder_module_screen.dart` (Polished "Coming Soon" placeholder views for remaining 14 CMS modules).

### 5.3 CircleCI CI/CD Pipeline (`.circleci/config.yml`)
- Automated build workflow running on `cimg/android:2026.07-ndk`.
- Clones Flutter stable channel, runs `flutter pub get`, performs `flutter analyze` static analysis check, builds `--release` APK (`flutter build apk --release`), and stores `app-release.apk` artifact.

### 5.4 Standalone Cupertino Microblog Application (`mobile-microblog/`)
- **Philosophy**: Pure Cupertino (iOS) experience dedicated strictly to microblogging with zero bloat and instant responsive ergonomics.
- **Cupertino Primitives**: Built using `CupertinoApp`, `CupertinoSliverNavigationBar` with large collapsing title, `CupertinoSliverRefreshControl` for pull-to-refresh, `CupertinoSlidingSegmentedControl` (All, Published, Drafts), `CupertinoSearchTextField`, `CupertinoActionSheet`, and `CupertinoListSection.insetGrouped`.
- **Card Presentation**: Markdown formatting via `flutter_markdown`, multi-photo preview grid with pinch-to-zoom full-screen `ImageGalleryView`, status badges, relative time labels, tag pills, and association pills (📍 Location and ✈️ Trip).
- **Fast Modal Compose**: Autogrowing editor with real-time character & word counters, direct camera/gallery Cloudinary photo upload, tag manager, status toggle, and expandable Advanced Options drawer housing live auto-generating/editable URL slug and searchable Cupertino bottom sheet pickers for associated Locations and Trips.
- **Storage & Sync**: Encrypted credentials in `flutter_secure_storage`, offline feed caching in `shared_preferences`, and direct integration with `/api/microblogs`, `/api/locations`, `/api/trips`, and `/api/upload`.

---

## 6. How to Run Commands & Tests

- **Development Server**: `npm run dev`
- **Build Verification**: `npm run build`
- **Execute Vitest Suite**: `npm run test`
- **Type Check**: `npx tsc --noEmit`
- **Drizzle DB Push**: `npm run db:push`
- **Flutter Main App Static Analysis**: `cd android && flutter analyze`
- **Flutter Microblog App Analysis & Tests**: `cd mobile-microblog && flutter analyze && flutter test`
- **Flutter People App Analysis & Tests**: `cd mobile-people && flutter analyze && flutter test`

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

---

## 8. Standalone Apps & Release Signing Changelog

### October 2026: Trips Hub & Detail Redesign with Interactive Mapbox GL Route Visualization
- **Comprehensive Trips Redesign (`/trips` & `/trips/[slug]`)**:
  - Implemented modern travel memory and itinerary hub closely matching `trips-interactive-demo.html`.
  - Batch query optimization: single-roundtrip parallel fetching of trips, days, relationships, gallery photos, and attachments (`fetchTripsOverviewRaw`), eliminating N+1 queries.
  - Interactive toolbar with debounced search across titles/locations/tags, 4-way sorting (Recent, Oldest, Duration, Title), and Grid/List view toggle.
  - Horizontally scrolling status filter chips (All, Upcoming, Ongoing, Completed, ★ Favorites) with live counts and optimistic favoriting.
  - Featured Trip hero card deterministically spotlighting the top favorite or recently active trip with rich metadata rollups (days, stops, photos, total spend).
  - Trip detail page with tabbed views: Overview, Day-by-Day Timeline, Photo Gallery, and Map & Route.
- **Interactive Mapbox GL Route Visualization (`MapboxTripMap.tsx`)**:
  - Full client-side WebGL rendering using `mapbox-gl` with automatic token discovery (`NEXT_PUBLIC_MAPBOX_TOKEN` and `MAPBOX_TOKEN` via `getMapboxTokenAction`).
  - Graceful fallback: when Mapbox token is absent or WebGL is unsupported, seamlessly falls back to the dark vector SVG route projection with an informative setup notice.
  - Chronological route polyline with an inner dashed accent `#ff8e4d` and outer glow line `#ff6600`.
  - Custom numbered DOM pin markers (`1, 2, 3...`) with popups displaying stop names, formatted addresses, and direct links to Location Hubs (`/locations/[slug]`).
  - Interactive style switcher: Dark (`dark-v11`), Satellite Streets (`satellite-streets-v12`), and Outdoors (`outdoors-v12`), safely preserving custom GeoJSON routes across style reloads.
  - Auto-fit bounds with adaptive padding and smooth flyTo transitions when selecting pins.
- **Quality Gates**: All 112 Vitest tests pass across all 19 test files (100%), Next.js production build (`npm run build`) compiles cleanly, and `android/` subsystem remains 100% clean and untouched.

### October 2026: Location Entity — People & Photos Integration, Shared Photo Picker & Trip Photo Roll-up
- **Shared 3-Tab Photo Picker Engine (`PhotoPickerModal.tsx`)**:
  - Extracted and generalized the 3-tab photo picker into a shared UI component in `src/components/PhotoPickerModal.tsx`:
    1. Tab 1: **Gallery (Cloudflare R2)**: Multi-select existing gallery photos from R2 with instant title search.
    2. Tab 2: **Choose from Cloudinary**: Multi-select existing Cloudinary assets via `getCloudinaryResources()` with instant search.
    3. Tab 3: **Upload to Cloudinary**: Multi-file upload directly to Cloudinary with local client-side image compression (`compressImageLocally`) and auto-selection.
  - Refactored `PersonPhotoPickerModal.tsx` to delegate to `PhotoPickerModal`, ensuring 100% backwards compatibility and zero regressions across the People module.
- **Location People Linking & Unlinking**:
  - Added "Link Person to Location" action bar on the individual Location page (`/locations/[slug]`) with person selector (`getPeopleAction`), relationship role selector (`visited`, `accompanied`, `lived_at`, `local_guide`, `met_at`), and `+ Link Person` button.
  - Added `connectLocationToPersonAction` and `removeLocationPersonConnectionAction` server actions with targeted cache tag purging (`locations-list`, `location-${slug}`, `people-list`, `person-${id}`).
  - Added disconnect (`X`) button on each linked person card on the Location detail page with confirmation modal.
- **Location Photos Association & Batch Server Actions**:
  - Added `+ Add Photos` button on Location page Photos tab triggering `PhotoPickerModal`.
  - Added `connectLocationPhotosBatchAction` creating relationships for gallery photos and inserting into `attachments` table (`entityType: "location", kind: "photo"`) for Cloudinary assets.
  - Added `removeLocationPhotoConnectionAction` removing attachments, relationships, or direct gallery linkages.
- **Automatic Trip Photo Roll-up with Attribution**:
  - When trips are associated with a location, `fetchLocationHubDataRaw` automatically rolls up all photos from those trips (`gallery.tripId`, trip `attachments`, and `trip_days.photosJson`).
  - Photos rolled up from trips display a prominent badge: `from this trip: [Trip Title]` with a direct link to the trip.
  - When a trip is unlinked from the location, its photos are automatically detached from the location view.
- **Quality Gates & Isolation**:
  - 19/19 Vitest test files passing, 111/111 unit tests passing (100%).
  - Zero TypeScript compiler issues (`npx tsc --noEmit`).
  - `android/` legacy client remained 100% clean and untouched.

### October 2026: Trips Experience Complete Redesign & Interactive Productionization
- **Source of Truth Visual Parity**:
  - Implemented the complete production travel memory and itinerary hub across `/trips` and `/trips/[slug]` matching `trips-interactive-demo.html`.
  - Dark elevated surfaces, subtle borders, HN Orange accents, responsive 3/2/1-column grid and list modes, and zero layout shift.
- **High-Performance Batched Read Projections (Zero N+1 Queries)**:
  - Added `getTripsOverviewAction` (`src/features/trips/actions.ts`): Queries trips, trip days, location relationships, gallery photos, and attachments in single parallel batches.
  - Generates rich projections: durations, formatted calendar ranges, display titles with city route formatting, location counts and pills, photo counts, spend rollups, and itinerary progress bars.
  - Cached via Vercel Data Cache (`createCachedQuery`) under tag `trips-list` and browser SWR cache (`swr_trips_overview_list`).
- **Interactive Controls & Search/Sort/Filter**:
  - Search toolbar filtering trips across title, display title, description, locations, and tags with Escape key clearing.
  - Sort control supporting Recent, Oldest, Duration, and Title.
  - Horizontal scrollable filter chips: All, Upcoming, Ongoing, Completed, and ★ Favorites.
  - Deterministic Featured Trip section: prioritizes favorite + completed trips, falling back to recent trips.
- **Reusable Component Architecture (`src/features/trips/components/`)**:
  - `TripCard.tsx`, `TripCover.tsx` (deterministic fallback themes `one`, `two`, `three`, `four`), `TripStatusBadge.tsx`, `FeaturedTrip.tsx`, `TripsToolbar.tsx`, `TripFilterChips.tsx`.
  - `TripOverflowMenu.tsx` (⋯ menu with Edit, Duplicate, Delete, outside-click and Escape key handling), `DeleteTripDialog.tsx` (accessible confirmation modal).
  - `TripSkeleton.tsx` and `TripEmptyState.tsx` (initial and filtered empty states).
  - `TripFormModal.tsx` reorganized with sections, tag management, and date range validation.
- **Detail Page & Map Route Visualizer (`/trips/[slug]`)**:
  - Hero banner with cover image/art, status badge, favorite star toggle, dates, duration, places, photos, spend stats, and quick actions.
  - Tab navigation preserving all existing capabilities: Itinerary, Locations, Map & Route, Photos, Microblogs, Movies, People.
  - `TripMapTab.tsx`: Dynamic SVG route map projecting real location coordinates, connecting route path with glowing gradient lines, numbered pins, interactive labels, and clear identification of locations lacking coordinates.
  - `TripItineraryTab.tsx`: Redesigned vertical timeline with day numbers, dates, primary places, structured contextual entries (transport, meals, activities, accommodation, weather, mood, notes, photos), day cost badges, and empty-day "Add details" prompts.
- **New Server Actions**:
  - `getTripsOverviewAction`: Batched overview query with zero N+1 overhead.
  - `duplicateTripAction`: Deep cloning of trip metadata, days, and location relationships.
  - `toggleTripFavoriteAction`: Direct and optimistic toggle for favorite status.
  - `getTripMapLocationsAction`: Sequential route coordinate resolution.
- **Quality Gates & Isolation**:
  - 19/19 Vitest test files passing, 111/111 unit tests passing (100%).
  - Zero TypeScript compiler issues (`npx tsc --noEmit`).
  - Next.js production build passing (`next build`).
  - `android/` legacy client remained 100% clean and untouched.

### September 2026: People Module & Mobile People — 3-Tab Photo Connection Hub & Cloudinary Integration
- **3-Tab Photo Picker Engine**:
  - Added dedicated 3-tab photo connection popup modal on Web (`PersonPhotoPickerModal.tsx`) and Cupertino Mobile (`PhotoPickerModal.dart`):
    1. Tab 1: **Gallery (Cloudflare R2)**: Multi-select existing gallery photos from R2.
    2. Tab 2: **Choose from Cloudinary**: Multi-select existing Cloudinary assets via `GET /api/media/cloudinary`.
    3. Tab 3: **Upload to Cloudinary**: Multi-file upload directly to Cloudinary with automatic selection.
- **Unified Attachments Data Model**:
  - Cloudinary and uploaded photos are stored in the `attachments` table (`entityType: 'person'`, `kind: 'photo'`).
  - Gallery photos link via `relationships` (`targetType: 'gallery'`).
  - `fetchPersonConnectionsRaw` and `getPersonMemoryHubDataAction` query attachments in parallel and combine both sources into `connections.photos`.
  - Deletions seamlessly remove attachments or relationships based on ID prefix.
- **REST Endpoints & Batch Actions**:
  - Added `GET /api/media/cloudinary` exposing Cloudinary asset list for pickers.
  - Added `connectPersonPhotosBatchAction` and upgraded `POST /api/people/[id]/connections` to accept batch photo connections.
  - Added direct `+ Add Photos` buttons on the "Photos Together" cards on both Web and Mobile.
- **Quality Gates & Subsystem Isolation**:
  - 13/13 Vitest test files passing, 69/69 backend tests passing (100%).
  - 25/25 Flutter tests passing in `mobile-people` with 0 `flutter analyze` issues.
  - 13/13 Flutter tests passing in `mobile-microblog` with 0 `flutter analyze` issues.
  - `android/` legacy client remained 100% clean and untouched.

### September 2026: Mobile Apps Modernization — De-bloat & Clean Cupertino Modernization
- **Liquid Glass Removal**: Completely removed the Apple Liquid Glass design system (optical blur `BackdropFilter`, specular gradient highlights, living aurora mesh canvas `AmbientMeshBackground`, and floating island navigation `FloatingGlassHeader`) from both `mobile-microblog/` and `mobile-people/`.
- **Pure Apple Cupertino Experience**:
  - `mobile-microblog/`: Restored standard `CupertinoPageScaffold` and `CupertinoSliverNavigationBar` with collapsing large titles, search field, sliding segmented control, clean cards (`AppCupertinoTheme.cardBackground`), and removed the redundant settings toggle.
  - `mobile-people/`: Restored `CupertinoPageScaffold` and `CupertinoSliverNavigationBar` with large collapsing title, contact count capsule, offline pending sync badge, filter drawer toggle, and quick-add action; replaced jewel LED glowing countdowns with clean status indicators.
- **Quality Gates & Isolation**:
  - `mobile-microblog`: 0 analyze issues, 13/13 tests passing (100%).
  - `mobile-people`: 0 analyze issues, 22/22 tests passing (100%).
  - Root Next.js CMS: 13/13 test files passing, 67/67 unit tests passing (100%).
  - `git status android/` remained 100% clean and untouched throughout.

### September 2026: Mobile People v1.2.0 (Native iOS Cupertino Redesign)
- **Apple iOS Blue Brand Accent**: Switched primary tint to `#007AFF` for avatars, primary actions, selected controls, and navigation.
- **Dedicated 2-Tab Navigation Bar**: Root `MainNavigationScreen` featuring native `CupertinoTabScaffold` and `CupertinoTabBar` with `People` (`CupertinoIcons.person_2`) and `Settings` (`CupertinoIcons.gear_alt`).
- **Clean Homepage Header Hierarchy**: Large title "People", subtitle text with circle count (`X people in your circle`), and top-right refined circular `+` button. Filter and Settings removed from top header.
- **Search & Adjacent Filter Sheet**: Height 50px subtle gray search field with adjacent filter button triggering a native Cupertino bottom sheet (`_showFilterSheet`) supporting Relationship presets, Birthday month, Favorites toggle, Sorting order, and Visibility options.
- **Compact "Coming up" Cards**: Compact upcoming birthdays section with calendar date badge boxes (`SEP 21`), initials avatars, and countdown pills (`In 8 days`), plus "See all" action sheet.
- **Clean Native iOS People List**: Flat grouped list surface with inset dividers, initials avatar, name, subtitle (`Relationship · 🔒 Privacy`), optional birthday metadata, and trailing star favorite outline toggle.
- **Native iOS Settings Page**: Organized into native iOS inset-grouped sections with colorful SF Symbol icon tiles and separated destructive Sign Out row.
- **Quality Gates**: 0 `flutter analyze` issues, 22/22 unit and widget tests passing (100%), 0 regressions across repository.

### September 2026: Mobile People v1.0.0 (Apple Liquid Glass Design System & Memory Hub)
- **Standalone Cupertino Client**: Created `mobile-people/` featuring 1:1 feature parity with webapp People Memory Hub (`/people` and `/people/[slug]`), built strictly with Apple Cupertino widgets (`CupertinoApp`, `CupertinoPageScaffold`, `CupertinoNavigationBar`).
- **Living Aurora Canvas & Liquid Glass**: Reusable `AmbientMeshBackground` living aurora mesh, `LiquidGlassContainer` with specular highlights, frosted blur, multi-tiered elevation shadows, and `FloatingGlassHeader` with real-time contact count, search, filters, and quick-add actions.
- **Master-Detail Navigation**: Fluid directory grid/list with filter chips (Relationship type, Birthday month, Favorites, Search), animated transitions pushing to deep `PersonDetailScreen` featuring Memory Hub (Connected Trips, Events, Microblogs, Quotes, Activity Timeline).
- **Important Dates & Birthday Reminders**: Native device push notifications via `flutter_local_notifications`, horizontal scrollable upcoming birthday countdown tray (`UpcomingBirthdaysWidget`), glowing jewel LED countdown badges (`jewelCountdown`).
- **Entity Connection Engine**: Modal connection sheet (`ConnectEntityModal`) allowing bi-directional linkage to Locations, Trips, Projects, Microblogs, Photos, and Collections via `/api/people/pickers` and `/api/people/[id]/connections`.
- **Offline-First Resilience**: Full mutation queue with persistent background sync (`SyncService`, `LocalStore`), local cache fallback, and Hugo rebuild trigger hook.
- **Backend People REST APIs**:
  - `GET /api/people`: Query with search, relationship filter, tags, and pagination.
  - `POST /api/people`: Create or update person record with Zod validation.
  - `GET /api/people/[id]`: Returns full composite Memory Hub payload including connected entities and activity timeline.
  - `PUT /api/people/[id]` & `DELETE /api/people/[id]`: Update and delete endpoints.
  - `POST /api/people/[id]/favorite`: Quick toggle favorite endpoint.
  - `POST & DELETE /api/people/[id]/connections`: Bi-directional entity connection endpoints.
  - `GET /api/people/birthdays`: Upcoming birthdays within 60 days with age calculation and daysRemaining.
  - `GET /api/people/pickers`: Fast aggregated picker endpoint returning locations, trips, projects, microblogs, photos, collections.
- **CI/CD Automation**: Configured dual GitHub Actions (`.github/workflows/build-people-apk.yml`) and CircleCI (`.circleci/config.yml`) workflows for automated analyze, test, release keystore signing, and ARM64 APK build artifacts.
- **Quality Gates**: All 24 Flutter unit/widget tests pass (100%), 0 linter issues in `flutter analyze`, and all 67 Vitest backend tests pass cleanly. `android/` legacy client remained 100% clean and untouched.

### October 2026: People Module Cloudinary Client-Side Image Compression
- **Client-Side Canvas Compression**: Added HTML5 Canvas client-side image compression support for direct Cloudinary uploads across the People module (`PersonPhotoPickerModal` and `PersonFormModal`).
- **Configurable Quality & Dimensions**: Integrated interactive compression options enabled by default (Photos: 80% quality, 1920x1080 max dimensions; Avatars: 85% quality, 1000x1000 max dimensions) with expandable configuration panels for fine-tuning Quality sliders and Max Width/Height.
- **Visual Feedback & Savings Badges**: Upload progress shows dynamic "Compressing..." and "Uploading..." overlay states. Successfully uploaded items display compression savings badges (e.g., `-78% (320 KB)`).
- **Unit Test Coverage**: Added `tests/image-compressor.test.ts` covering file size formatting and non-image / SVG / GIF bypass logic.
- **Quality Gates**: All 93 Vitest unit tests pass across 17 test suites (100%), Next.js production build (`npm run build`) compiles with zero errors, and `android/` legacy client remained 100% clean and untouched.

### September 2026: Mobile People v1.6.0 (Sync Queue Unblocking, Temp ID Remapping, Real-Time Birthdays & Android Pull-to-Refresh)
- **Offline Sync Queue Unblocking & Temp ID Remapping**: Resolved offline mutation queue lockups. When an entity is created offline with a temporary ID (`temp_...`), upon successful creation on the backend, the optimistic cache is pruned (`LocalStore.deleteCachedPerson(tempId)`), and all subsequent mutations in the queue targeting that `tempId` have their `entityId` and payload `id`/`personId` remapped to the actual backend ID (`savedPerson.id`). Fatal non-network errors (400, 404, 422) are evicted with warnings rather than halting the sync loop indefinitely. Added periodic auto-sync timer (60s) and app-resume queue flushes.
- **Native Android & iOS Pull-to-Refresh**: Replaced outer `SafeArea` with `CustomScrollView` and wrapped internal header contents in `SliverSafeArea(top: true, bottom: false)` so `CupertinoSliverRefreshControl` properly measures overscroll offsets. Set physics to `AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics())` to enable overscroll drag bouncing on Android devices. Configured 80px pull threshold with medium impact haptic feedback.
- **Real-Time Client-Side Birthday Derivation**: Added `LocalStore.computeUpcomingBirthdays` calculating `daysRemaining` in sorted countdown order directly from local contact records. Integrated calculation into `upsertCachedPerson`, `deleteCachedPerson`, and `toggleCachedPersonFavorite` to ensure upcoming birthday trays update immediately upon creating, editing, or deleting contacts without waiting on server sync or cache expiry.
- **Quality Gates**: All 41 Flutter unit and widget tests pass (100%), 0 issues in `flutter analyze`. `mobile-microblog` (13/13) and Vitest backend (87/87 across 16 files) remain 100% passing. `android/` legacy client remains 100% clean and untouched.

### September 2026: Mobile People v1.5.0 (Offline-First Architecture, 7-Day TTL Caching, Instant Search & Persistent Disk Image Caching)
- **7-Day TTL Cache-First Network Policy**: Configured `LocalStore.defaultCacheTtl = Duration(days: 7)`. Read requests for directory contacts (`limit=500`), person details, upcoming birthdays, and pickers are served instantaneously offline from local disk storage. Network hits are bypassed entirely unless cache exceeds 7 days, the user pulls to refresh, or triggers "Force Sync All".
- **0ms Client-Side Search, Sort & Filter**: Eliminates network latency on search queries. All searching, filtering by relationship/month/favorite, and sorting are executed 100% in-memory in <1ms.
- **Instant Detail Screen Paint**: `PersonDetailScreen` renders immediately using `initialPerson` passed from the directory and cached detail payloads.
- **Persistent Disk Image Caching (90-Day Retention)**: Integrated `PeopleImageCacheManager` (extending `CacheManager`, key `'people_app_image_cache'`, 90-day retention, 2000 max files) across all `CachedNetworkImage` widgets, with automatic background pre-caching (`precacheImages`) for all contacts upon loading.
- **Optimistic Local Mutations**: Add, edit, delete, and favorite operations update the local in-memory state and disk cache immediately, queuing mutations for background sync.
- **Quality Gates**: All 35 Flutter unit and widget tests pass (100%), 0 issues in `flutter analyze`. `mobile-microblog` (13/13) and Vitest backend (69/69) remain 100% passing. `android/` legacy client remains 100% clean and untouched.

### September 2026: Travel Itinerary Pervasive Location Entity Reuse & Auto-Linking
- **Pervasive Location Entities**: Upgraded the Travel Itinerary system to reuse first-class Location entities across Day Primary Location, Transport legs (from/to), Meals (place), Activities (location), and Accommodation (hotel/stay), backed by `LocationPickerField` and `EntityCombobox` with custom text fallbacks.
- **Automated Relationship Linking**: `updateTripDayAction` dynamically scans all referenced location IDs in an itinerary day and creates `includes_location` relationships connecting them to the trip, keeping the trip's "Locations Visited" tab synced without manual intervention.
- **In-Picker Quick-Creation with Mapbox Geocoding**: Searching places surfaces Mapbox forward geocoding suggestions to create rich Location entities (with GPS coordinates, city, state, country) via `quickCreateLocationAction` or simple entities on the fly without leaving the editor modal.
- **Trip Prioritization**: `EntityCombobox` accepts `priorityIds` derived from `getTripLocationIds(tripId)` to pin this trip's existing locations at the top of dropdown lists with 📍 badges.
- **DayCard Resolution & Denormalization**: Resolves location IDs across all day summary cards and populates `primaryLocationName` denormalized fallbacks. Upgraded the "Link Location" selector on the Trip detail page to `EntityCombobox`.
- **Quality Gates**: All 87 Vitest unit tests pass (100%), Next.js production build (`npm run build`) compiles with zero errors, and `android/` legacy client remained 100% clean and untouched.

### September 2026: Mobile People v1.4.0 (3-Tab Photo Connection Popup & Cloudinary Integration)
- **3-Tab Photo Connection Modal (`PhotoPickerModal`)**: Built pure Cupertino modal sheet (`showCupertinoModalPopup`) with 3-tab segmented control for R2 Gallery, Cloudinary media, and camera/gallery multi-image upload directly to Cloudinary.
- **Unified Attachments & Relationship Engine**: Cloudinary assets persist in `attachments` (`entityType: 'person'`, `kind: 'photo'`), and gallery photos link via `relationships` (`targetType: 'gallery'`).

### September 2026: Mobile People v1.3.1 (Brand Color Restoration & Dark Mode Text Legibility Fix)
- **Brand Blue Restoration**: Restored `AppCupertinoTheme.brandAccent` from purple back to Apple iOS Blue (`#007AFF`) and `brandGradient` to Apple iOS Blue to Indigo (`[Color(0xFF007AFF), Color(0xFF6366F1)]`).
- **Complete Dark Mode Text Legibility Fix**: Fixed pitch-black text rendering in dark mode across headers, subtitles, search input, filter controls, person cards, date countdown badges, and empty states. Added `AppCupertinoTheme.label(context)`, `secondary(context)`, and `tertiary(context)` dynamic resolution helpers, and enhanced `isDark(context)` to check both `CupertinoTheme.maybeBrightnessOf` and `MediaQuery.maybePlatformBrightnessOf`.
- **Quality Gates**: All 24 Flutter unit and widget tests pass (100%), 0 issues in `flutter analyze`. `android/` legacy client remained 100% clean and untouched.

### September 2026: Mobile People v1.3.0 (Native Personal Relationship Manager UI Redesign)
- **Brand Accent & Restrained Personality**: Re-anchored to purple (`#8B5CF6`) and pink (`#EC4899`) signature palette with `brandGradient`; selected navigation tab and filter states use the purple brand accent without excessive full-screen washes or glowing shadows.
- **Profile-Oriented Edit Contact Redesign**: Transformed `PersonFormModal` from a database form into a profile editor featuring dynamic initials/photo header, clean inset-grouped Basic Information, dedicated Relationship section with disclosure picker, visually separated Privacy section with segmented control, human "Things to remember" section with notebook notes and interactive chips for Interests/Tags, compact Social Profiles, and low-priority Advanced section with URL slug and timestamps.
- **Quality Gates**: 24/24 Flutter unit and widget tests pass (100%), 0 issues in `flutter analyze`. `android/` legacy client remained 100% clean and untouched.

### September 2026: Mobile Microblog v1.2.0 (Apple Liquid Glass Design System)
- **Living Aurora Canvas**: Replaced static backgrounds with `AmbientMeshBackground`, rendering soft, dynamic glowing radial gradient auroras (Electric Indigo, Royal Violet, and Cyan in Dark Mode; Sky Blue, Lavender, Peach, and Mint in Light Mode) with real-time scroll parallax tracking.
- **5-Layer Liquid Glass Architecture**: Created `LiquidGlassContainer` and `LiquidGlassTheme` featuring `RepaintBoundary` GPU scroll isolation, optical blur (`sigma: 18-20`), continuous directional specular gradient highlights (simulating directional light striking top-left edges), multi-tiered elevation shadows, and spring scale bounce (`0.982x`) on press.
- **Floating Glass Island Header**: Implemented `FloatingGlassHeader` with pill geometry (`borderRadius: 26`), hovering over content with integrated Settings button, title, real-time count capsule, and radiant compose action button.
- **Illuminated Status Gems & Frosted Badges**: Upgraded `MicroblogCard` with glowing jewel LED dots (`jewelLed`) and frosted association pills (`systemTeal` Location and `systemPurple` Trip).
- **Adaptive Performance Mode**: Added persistent "Liquid Glass Effects" toggle in `SettingsScreen` and `LocalStore` to allow seamless switching between Full GPU blur and lightweight pre-blended translucency for low-spec Android devices.
- **Quality Gates**: All 17 Flutter unit and widget tests pass (100%), 0 linter issues in `flutter analyze`, and all 59 backend Vitest tests pass cleanly. `android/` legacy client remained untouched.

### September 2026: Mobile Microblog v1.1.0 Updates
- **Backend Projections**: `fetchMicroblogsFromDb` (`src/features/microblog/actions.ts`) updated to query `images`, `coverImageUrl`, `tags`, `locationId`, and `tripId` with left joins to `locations` and `trips` (`locationName`, `locationCity`, `tripTitle`).
- **Mobile Models & Selectors**: Created `LocationItem` and `TripItem` models in `mobile-microblog/lib/core/models/` and `AssociationPickerSheet` modal in `mobile-microblog/lib/widgets/`.
- **Editor Ergonomics**: Added real-time auto-slug generation, manual override, and expandable Advanced Options accordion drawer in `ComposeModal`.
- **Timeline Presentation**: Added 📍 Location and ✈️ Trip pill rendering to `MicroblogCard`.
- **Branding & Assets**: Generated modern Cupertino squircle app icon for Android (`mipmap-*`) and iOS (`Assets.xcassets`).
- **CI/CD Keystore Automation**: Configured release signing in `build.gradle.kts`, `.github/workflows/build-microblog-apk.yml`, and `.circleci/config.yml` using GitHub repository secrets (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`).
- **Quality Gates**: All 13 Flutter widget/unit tests and all 59 backend Vitest tests pass cleanly. `git status android/` remained untouched.

---

## 9. Workflow Guidelines for AI Assistants

> [!IMPORTANT]
> **Mandatory Workflow Standards for Every Task**:
> 1. **Update AI Handoff Documents**:
>    - Always update [`AI_HANDOFF.md`](./AI_HANDOFF.md) after making architectural, schema, or system modifications.
>    - Always update [`MICROBLOG_APP_HANDOFF.md`](./MICROBLOG_APP_HANDOFF.md) whenever touching `mobile-microblog/`.
> 2. **Run Quality & Verification Gates**:
>    - Mobile Flutter app: Run `flutter analyze` (must be 0 issues) and `flutter test` (must pass 100%).
>    - Web & Backend CMS: Run `npm test` (must pass 100%).
> 3. **Automatic Git Commit & Push**:
>    - Always commit changes with clear, descriptive semantic commit messages.
>    - Always push commits to `origin main` automatically upon task completion.
> 4. **Preserve Legacy App Isolation**:
>    - The legacy multi-module app in `android/` must remain untouched when developing features for `mobile-microblog/`. Verify with `git status android/`.

