# Feature Specification: FreshRSS Sync Provider

## Objective

Implement a new **FreshRSS Sync Provider** for the Personal CMS Sync Center.

The goal is **NOT** to duplicate or replace FreshRSS.

The CMS should treat FreshRSS as the canonical source for RSS feeds while importing only **reading activity and metadata** that enriches the personal knowledge graph.

The CMS should never become another RSS reader.

It should instead become a **reading history, analytics and discovery platform**.

---

# Design Principles

The FreshRSS integration should:

* Never duplicate article content unnecessarily.
* Never sync RSS feed XML.
* Never store article bodies.
* Never replace FreshRSS.
* Only sync metadata and user interactions.
* Be incremental.
* Be idempotent.
* Integrate with the Analytics Engine.
* Integrate with Timeline.
* Integrate with Search.
* Integrate with the Memory Engine.

---

# Authentication

Support connecting to a self-hosted FreshRSS instance.

The user must configure:

FreshRSS URL

Example:

```
https://rss.example.com
```

Do **not** hardcode any URLs.

Support authentication using FreshRSS API credentials.

Store credentials securely.

Support:

* Test Connection
* Disconnect
* Manual Sync
* Automatic Sync
* Last Sync Time
* Sync Status

---

# Sync Strategy

Use incremental synchronization.

Only download changes since the previous successful sync.

Never perform full imports unless explicitly requested.

Support:

Manual Sync

Scheduled Sync

Background Sync

Retry Failed Sync

---

# What To Sync

The CMS should import **reading activity**, not article content.

---

## Article Metadata

Store:

FreshRSS Article ID

Feed ID

Feed Name

Category

Title

Original URL

Publication Date

Read Date (if available)

Author (if available)

Estimated Reading Time (if available)

Language (if available)

Tags (if available)

Word Count (if available)

Thumbnail URL (optional)

Do **not** store the article body.

---

## Read Status

Track:

Unread

Read

Read Timestamp

Last Updated

This enables reading analytics.

---

## Starred Articles

Track:

Starred

Starred Timestamp

Starred articles should appear in analytics and search.

---

## Feed Metadata

Store lightweight information:

Feed ID

Feed Name

Category

Website

Icon URL

Unread Count (optional)

Feed metadata should be refreshed periodically.

---

## Categories

Store:

Category Name

Category ID

This enables category-based analytics.

---

# Database Design

Suggested tables:

rss_articles

rss_feeds

rss_categories

rss_read_events

rss_starred_articles

rss_sync_state

The schema should avoid storing duplicate article content.

---

# Timeline Integration

Every read article should appear as a timeline event.

Example:

09:32

Read Article

"SQLite 3.50 Released"

Feed:

SQLite Blog

Category:

Technology

Clicking the event should open:

Original Article URL

or

FreshRSS (optional)

---

# Analytics Integration

The FreshRSS provider should publish analytics to the Analytics Engine.

Metrics include:

Total Articles Read

Articles Today

Articles This Week

Articles This Month

Articles This Year

Lifetime Reads

Reading Streak

Longest Reading Streak

Average Articles Per Day

Average Reading Time

Estimated Time Reading

Most Active Reading Day

Most Active Reading Hour

Most Active Weekday

Most Read Feed

Most Read Category

Most Starred Feed

Most Starred Category

Total Starred Articles

Favorite Sources

Unread Count (optional)

---

# Reading Sessions

Automatically group reading activity into sessions.

Example:

Start Time

End Time

Duration

Articles Read

Estimated Reading Time

Sessions should be used for analytics only.

---

# Dashboard Integration

Display:

Articles Read Today

Articles Read This Week

Current Reading Streak

Favorite Feed

Favorite Category

Recently Read Articles

Recently Starred Articles

---

# Search Integration

Index metadata only.

Searchable fields:

Title

Feed Name

Category

Tags

Author

Publication Date

Read Date

Do not index article bodies.

Search results should link to:

Original URL

or

FreshRSS

---

# Memory Engine Integration

Reading activity should contribute to the Memory Index.

Examples:

A journal entry written shortly after reading several articles on photography should be considered connected.

Trips should be able to surface articles read during the trip.

People and Locations may also gain indirect relationships through journal entries and reading history.

The FreshRSS provider should publish reading events to the relationship engine.

---

# Relationship Engine

Automatically create relationships.

Examples:

Article

↓

Journal Entry

Based on:

* Time proximity
* Shared tags
* Shared keywords (future)
* Shared entities (future)

Article

↓

Trip

Based on read date.

Article

↓

Location

Based on journal relationships.

Article

↓

People

Indirectly through journals.

These links should initially be lightweight and non-destructive.

---

# Reading Influence

Implement a "Reading Influence" system.

When viewing a Journal Entry, Trip or Project, display a section:

"Reading Around This Time"

Example:

• SQLite 3.50 Released

• Scaling Turso

• Optimizing Vercel Functions

Suggestions should initially be based on:

Time proximity

Future versions may incorporate semantic similarity using embeddings.

---

# Statistics Module Integration

Expose statistics for:

Daily Reads

Monthly Reads

Reading Heatmap

Reading Calendar

Category Distribution

Feed Distribution

Reading Trends

Starred Trends

Reading Sessions

Average Reading Time

Favorite Publications

Favorite Categories

---

# Notifications

Integrate with the Notification Engine.

Examples:

Weekly Reading Summary

Reading Streak Milestone

Large Reading Session

New Favorite Feed

Notifications should be configurable.

---

# Sync Center Integration

The provider should appear alongside existing providers.

Example:

Sync Center

* Trakt
* Last.fm
* FreshRSS

Display:

Connection Status

Last Sync

Items Imported

Read Articles

Starred Articles

Errors

Retry Button

Manual Sync Button

Sync History

---

# Scheduling

Allow configurable automatic synchronization.

Examples:

Every 15 minutes

Hourly

Every 6 hours

Daily

Manual Only

Avoid excessive API calls.

---

# Performance

Support incremental sync.

Avoid duplicate imports.

Use batch inserts.

Maintain sync checkpoints.

Never download unnecessary metadata.

Handle tens of thousands of reading events efficiently.

---

# Future AI Integration

Design the data model to support future AI features.

Potential capabilities:

Semantic search

Reading summaries

Topic clustering

Article recommendations

Journal influence detection

Knowledge graph enrichment

The provider should store enough metadata to support these features without requiring schema changes later.

---

# Deliverables

Implement:

* FreshRSS Sync Provider
* Self-hosted instance configuration
* Secure authentication
* Incremental synchronization
* Read status synchronization
* Starred article synchronization
* Feed synchronization
* Category synchronization
* Timeline integration
* Analytics integration
* Statistics integration
* Search integration
* Memory Engine integration
* Relationship Engine integration
* Reading Influence suggestions
* Notification integration
* Background sync
* Sync scheduling
* Sync history
* Error handling
* High-performance incremental updates

The finished implementation should make FreshRSS a first-class reading activity provider within the Personal CMS, enriching timelines, analytics, memory discovery and search while intentionally avoiding duplication of RSS content or replacing FreshRSS itself.
