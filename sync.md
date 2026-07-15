# Feature: Sync Center (Provider-Based Integration System)

## Objective

Build a **Sync Center** for the Personal CMS.

This should become the central place for managing all external data providers.

The system must be **provider-based**, so adding future integrations (GitHub, Steam, Hevy, etc.) requires implementing a new provider rather than modifying the Sync Center itself.

Initial providers:

* 🎬 Trakt
* 🎵 Last.fm

---

# Design Philosophy

The CMS is the central hub for my personal website.

External services remain the **source of truth** for their own domains.

The CMS imports data, stores a local copy in Turso, enriches it with personal metadata, and Hugo generates the public website from the local database.

Never depend on external APIs during Hugo builds.

---

# Overall Architecture

```text
External Provider

↓

Sync Provider

↓

Normalize Data

↓

Turso

↓

Hugo Content Adapter

↓

Website
```

The website should only consume local data.

---

# Sync Center

Create a dedicated page:

```
/sync
```

Sidebar:

```
Dashboard

Content
Media
Gallery

Sync Center

Settings
```

---

# Provider Cards

Each provider appears as a card.

Example:

```
🎬 Trakt

Connected

Status:
Healthy

Last Sync
2 minutes ago

Movies
1,254

Shows
182

Episodes
8,542

[ Sync Now ]

View Logs
```

Another:

```
🎵 Last.fm

Connected

Status:
Healthy

Last Sync
Today

Scrobbles
98,412

Artists
2,541

Albums
8,114

Tracks
29,817

[ Sync Now ]

View Logs
```

Each provider card should be reusable.

---

# Provider Interface

Create a generic provider interface.

Every provider should implement:

```
connect()

disconnect()

sync()

getStatus()

getStatistics()

validateConfiguration()

testConnection()
```

The Sync Center must not contain provider-specific logic.

---

# Provider Registry

Create a registry.

Example:

```
providers/

trakt/

lastfm/

registry.ts
```

The Sync Center discovers providers from the registry.

Future providers should only need registration.

---

# Provider Status

Every provider supports:

Connected

Disconnected

Syncing

Error

Disabled

Display badges with clear colors.

---

# Sync Logs

Create a Sync Logs page.

Store every sync.

Schema:

```
sync_logs

id

provider

started_at

finished_at

duration

status

items_created

items_updated

items_deleted

error_message

metadata_json
```

Allow viewing previous syncs.

---

# Database

Create:

## providers

```
id

name

slug

enabled

connected

status

last_sync

last_success

configuration_json

created_at

updated_at
```

---

# Trakt Provider

Trakt is the source of truth for:

Movies

TV Shows

Episodes

Ratings

Watch History

Import into Turso.

Store:

Movie

```
trakt_id

tmdb_id

title

year

overview

runtime

rating

watched_at

genres

poster_path

backdrop_path

```

TV Show

```
trakt_id

tmdb_id

title

overview

status

year

poster_path

backdrop_path
```

Episode

```
episode_number

season_number

watched_at
```

Store only TMDB image paths.

Do NOT upload movie posters to Cloudinary or R2.

Generate image URLs at runtime.

---

# Trakt Personal Metadata

Allow CMS-only fields.

Examples:

Favorite

Notes

Visibility

Custom Tags

Review

These fields must never be overwritten by sync.

---

# Last.fm Provider

Last.fm is the source of truth for:

Scrobbles

Artists

Albums

Tracks

Import all listening history. It should be done in batches. I have over 65 thousand scrobbles there now. This project is being deployed on vercel so vercel has hard limit of 10 secs for functions. The import should be in manual batches so i can import last 1 month now.. but later import rest slowly. You have to keep track of the sync as well. 

Support incremental sync.

Do not download everything every sync.


---

# Last.fm Database

Scrobbles

```
lastfm_id

artist

album

track

played_at

duration

mbid
```

Artist

```
artist_name

play_count

last_played

first_played
```

Album

```
album_name

artist

play_count
```

Track

```
track_name

artist

play_count
```

---

# Last.fm Personal Metadata

Allow:

Favorite

Notes

Tags

Hidden

Review

Never overwrite these during sync.

---

# Sync Flow

```
User clicks Sync

↓

Provider authenticates

↓

Fetch latest changes

↓

Normalize data

↓

Upsert into Turso

↓

Update statistics

↓

Record sync log

↓

Return summary
```

---

# Upsert Rules

Never duplicate data.

Use provider IDs.

Update changed metadata.

Keep personal fields intact.

---

# Statistics

Each provider returns statistics.

Trakt:

Movies

Shows

Episodes

Ratings

Last Sync

Last Import

Last Error

Last.fm:

Artists

Albums

Tracks

Scrobbles

Last Sync

Last Import

Last Error

Display statistics on the provider cards.

---

# Authentication

Support OAuth where applicable.

Store tokens securely.

Handle:

Expired tokens

Revoked access

Reconnect flow

Disconnect flow

---

# Sync Modes

Support:

Manual Sync

Automatic Sync (future)

Incremental Sync

Full Resync

---

# Error Handling

Handle:

Network failures

API rate limits

Authentication failures

Partial imports

Malformed data

Provider downtime

Every failure should be logged.

---

# Sync History

Each provider should expose:

Recent syncs

Duration

Items imported

Items updated

Items skipped

Errors

Allow viewing details.

---

# Dashboard Widgets

Later the dashboard should display:

```
Sync Status

✓ Trakt

Synced 3 min ago

✓ Last.fm

Synced Yesterday

Recent Imports

3 Movies

42 Scrobbles

2 Albums

No Errors
```

Design the API so these widgets are easy to build later.

---

# Image Strategy

Movies & TV

Store only:

TMDB IDs

Poster paths

Backdrop paths

Do NOT host artwork on Cloudinary or R2.

Gallery images remain hosted on Cloudflare R2.

Microblog images remain hosted on Cloudinary.

---

# Future Providers

The architecture should make it easy to add:

GitHub

Steam

Hevy

OpenLibrary

Letterboxd (if API becomes available)

Garmin

Readwise

Pocket

Raindrop.io

No changes should be required in the Sync Center itself.

Only implement a new provider.

---

# UI

Modern, minimal interface.

Dark mode first.

Use cards.

Display provider logos/icons.

Animated sync progress.

Loading states.

Error banners.

Success notifications.

Manual refresh button.

Responsive layout.

---

# Code Quality

Use TypeScript.

Strong typing.

Reusable hooks.

Provider abstraction.

Separation of concerns.

Avoid provider-specific conditionals in shared components.

Follow clean architecture principles.

---

# Deliverables

Implement:

* Sync Center page
* Provider registry
* Generic provider interface
* Trakt provider
* Last.fm provider
* Database schema
* Sync logs
* Provider cards
* Sync history
* Authentication flow
* Incremental sync
* Statistics
* Error handling
* Reusable architecture for future providers

The result should feel like a professional integration hub rather than two hardcoded sync pages, and it should be capable of supporting many additional providers in the future with minimal changes.


After making all the changes update the ai handoff document and then commit and push the changes.  Make sure to verify first,


