# Feature Specification: Analytics Engine, Statistics Module & Memory Index

## Objective

Design and implement a comprehensive **Analytics Engine** that powers statistics, dashboards, insights and memory discovery across the entire Personal CMS.

The analytics system must **not** execute expensive aggregations every time a page is opened.

Instead, it should continuously compute, cache and update analytics whenever underlying data changes.

The Statistics page is only one consumer of this engine.

The engine should also power:

* Dashboard
* Memory Hub
* Timeline
* Search ranking
* People pages
* Location pages
* Trip pages
* Future Android app
* Future widgets
* Future "Year in Review"
* Future "On This Day"

The architecture should be modular, extensible and event-driven.

---

# Supported Modules

The analytics engine currently supports:

* Journal
* Microblog
* Todos
* Gallery
* Movies
* TV Shows
* Music
* People
* Locations
* Trips

The architecture must allow new modules to be added without changing the core engine.

---

# Architecture

The analytics engine should consist of independent **Analytics Providers**.

Example:

```text
Journal Analytics Provider

Microblog Analytics Provider

Todo Analytics Provider

Gallery Analytics Provider

Movie Analytics Provider

TV Show Analytics Provider

Music Analytics Provider

People Analytics Provider

Location Analytics Provider

Trip Analytics Provider
```

Each provider is responsible only for computing analytics related to its own module.

The core engine combines results into unified caches.

---

# Event Driven Updates

The analytics engine should react to data changes.

Examples:

Journal Entry Created

↓

Update Journal Analytics

↓

Update Timeline Cache

↓

Update People Scores

↓

Update Location Scores

↓

Update Trip Scores

---

Photo Uploaded

↓

Update Gallery Analytics

↓

Update Related People

↓

Update Related Locations

↓

Update Related Trips

---

Movie Imported

↓

Update Movie Analytics

↓

Update Dashboard

---

Todo Completed

↓

Update Todo Statistics

↓

Update Productivity Statistics

---

The UI should never trigger heavy analytics computations directly.

---

# Cached Analytics

Create dedicated cache tables instead of recalculating statistics.

Suggested tables:

analytics_metrics

analytics_daily

analytics_monthly

analytics_yearly

analytics_relationships

analytics_timeline

analytics_snapshots

analytics_memory_scores

analytics_dashboard

analytics_search

analytics_trends

These tables should be regenerated incrementally when possible.

---

# Statistics Dashboard

Create a global statistics dashboard showing high-level metrics.

Examples:

Total Journal Entries

Total Microblogs

Total Todos

Total Photos

Total Movies

Total TV Shows

Total Music Items

Total People

Total Locations

Total Trips

Journal Streak

Most Active Module

Database Size

Storage Used

Recent Activity

Current Sync Status

---

# Module Statistics

Each module should expose rich analytics.

## Journal

Total Entries

Words Written

Characters Written

Average Entry Length

Longest Entry

Shortest Entry

Journal Streak

Longest Streak

Entries by Month

Entries by Weekday

Entries by Hour

Mood Distribution

Writing Heatmap

Writing Calendar

Inline Images

Attachments

Most Used Tags

Most Mentioned People

Most Mentioned Locations

Most Mentioned Trips

---

## Microblog

Total Posts

Drafts

Published

Average Length

Posting Frequency

Posts by Month

Posts by Weekday

Posts by Hour

Image Posts

Bluesky Sync Count

Mastodon Sync Count

Most Used Tags

---

## Todos

Total Tasks

Completed

Pending

Completion Rate

Average Completion Time

Tasks by Priority

Tasks by Tag

Tasks by Project

Overdue Tasks

Completed Today

Completed This Week

Completed This Month

---

## Gallery

Total Photos

Photos This Month

Storage Used

Average File Size

Photos by Location

Photos by Person

Photos by Trip

Most Photographed Person

Most Photographed Location

Favorite Photos

---

## Movies

Movies Watched

Average Rating

Runtime Watched

Movies by Genre

Movies by Year

Movies by Language

Movies by Country

Watch Calendar

Monthly Trend

---

## TV Shows

Shows Watching

Shows Completed

Episodes Watched

Runtime

Genres

Platforms

Average Rating

Monthly Trend

---

## Music

Artists

Albums

Tracks

Listening Hours

Top Artists

Top Albums

Top Tracks

Genres

Listening Calendar

Listening Heatmap

Monthly Trend

---

## People

Total People

Family

Friends

Colleagues

Journal Mentions

Photos Together

Trips Together

Shared Locations

Recent Interactions

---

## Locations

Countries

States

Cities

Places

Journal Entries

Photos

Trips

People

Visit Count

Most Visited Locations

---

## Trips

Total Trips

Travel Days

Countries

Cities

Photos

Journal Entries

People

Locations

Average Duration

Longest Trip

Shortest Trip

---

# Time Filters

Every statistics page must support:

Today

Yesterday

This Week

Last Week

This Month

Last Month

This Year

Last Year

Lifetime

Custom Date Range

The UI should read precomputed caches whenever possible.

---

# Unified Timeline Cache

Create a unified timeline cache.

Example timeline item:

Date

Type

Title

Related People

Related Location

Related Trip

Related Journal

Thumbnail

Importance Score

The timeline should merge activities across every supported module.

---

# Memory Index

Implement a **Memory Index** rather than a simple score.

The Memory Index is an internal ranking system used to identify meaningful memories and relationships.

It is not primarily intended to be shown as a visible score.

The Memory Index should combine multiple dimensions.

---

## Richness Score

Measures how much content exists.

Examples:

Journal Entries

Photos

Microblogs

Todos

Movies

TV Shows

Music

Attachments

Inline Images

More connected content increases the score.

---

## Diversity Score

Measures how many different modules are connected.

Example:

Trip with:

Journal

Photos

People

Locations

Music

Movies

receives a higher diversity score than a trip with only photos.

---

## Longevity Score

Measures how long a memory spans.

Examples:

One-day trip

↓

Lower

Year-long project

↓

Higher

Recurring memories should accumulate score over time.

---

## Recurrence Score

Measures how often a person, location or trip appears across the CMS.

Frequently recurring entities receive higher importance.

---

## Recency Score

Provide a small boost to recently created or recently updated memories.

This is used for discovery.

It should not dominate older meaningful memories.

---

## Favorite Bonus

If an item is explicitly marked as a favorite by the user, apply an additional weighting.

---

## Pinned Bonus

Allow users to manually pin important memories.

Pinned memories receive an additional weighting regardless of automatic analytics.

This ensures emotionally important memories are not hidden simply because they contain less content.

---

# Final Memory Index

Combine all dimensions into a weighted overall score.

Example components:

Richness

Diversity

Longevity

Recurrence

Recency

Favorite Bonus

Pinned Bonus

The exact weights should be configurable.

The scoring algorithm should be easy to adjust without changing application logic.

---

# Memory Index Usage

Use the Memory Index throughout the application.

Examples:

Memory Hub

Show:

Most Meaningful Memories

People Pages

Sort:

Most Significant Relationships

Location Pages

Show:

Most Meaningful Places

Trip Pages

Highlight:

Most Memorable Trips

Search

Boost highly ranked memories.

Timeline

Highlight important periods.

Dashboard

Show:

Richest Memory

Memory of the Week

Recently Rediscovered Memories

Future Android Widgets

Future Year in Review

Future On This Day

The Memory Index should drive discovery rather than act as a visible score.

---

# Relationship Analytics

Compute relationships between entities.

Examples:

Person ↔ Journal

Person ↔ Photos

Person ↔ Trips

Person ↔ Locations

Location ↔ Trips

Location ↔ Journal

Trip ↔ Photos

Trip ↔ Journal

Trip ↔ People

Trip ↔ Locations

The engine should maintain weighted relationship graphs.

These relationships will power future visualizations and recommendations.

---

# Snapshots

Generate immutable analytics snapshots.

Suggested intervals:

Daily

Monthly

Yearly

Snapshots enable historical comparisons without recalculating historical data.

---

# Performance

The analytics engine should be asynchronous.

Never block UI requests.

Use background jobs.

Only recompute affected analytics.

Avoid full database scans whenever possible.

Use incremental updates.

---

# Extensibility

The analytics engine should expose a provider interface.

Adding a future module should require:

1. Register Analytics Provider

2. Emit Events

3. Define Metrics

The core engine should not require modification.

---

# Deliverables

Implement:

* Modular Analytics Engine
* Event-driven analytics updates
* Cached analytics tables
* Statistics Dashboard
* Per-module analytics
* Unified timeline cache
* Relationship analytics
* Memory Index system
* Richness, Diversity, Longevity, Recurrence and Recency scoring
* Favorite and Pinned weighting
* Search ranking integration
* Dashboard integration
* Timeline integration
* Memory Hub integration
* Trip, People and Location ranking
* Snapshot generation
* Configurable score weighting
* Background analytics processing
* Incremental cache rebuilding
* Extensible provider architecture
* Responsive statistics UI with time filters

The finished system should act as the analytical foundation of the Personal CMS, transforming raw data into fast, meaningful insights while enabling intelligent discovery of the user's most significant memories, relationships and life events without requiring expensive runtime database queries.
