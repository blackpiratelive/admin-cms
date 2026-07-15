# Feature: People Module (Personal Contacts)

## Objective

Build a **People** module for the Personal CMS.

This module is **not** intended to store public figures (artists, actors, directors, authors, etc.). Those remain part of their respective domains and external providers.

The purpose of this module is to manage **people I personally know** and to connect them with my memories, photos, trips, locations, projects and notes.

The module should function as a **private personal relationship and memory manager**, not a CRM.

Most records will remain private.

---

# Design Philosophy

The People module should answer questions like:

* Who did I travel with?
* Who appears in this photo?
* Which projects have I worked on with someone?
* Which places have I visited with a particular person?
* What notes do I have about someone?
* What important dates should I remember?

The goal is to preserve context and memories—not to replace a contacts application.

---

# Navigation

```text
Dashboard

Content

Libraries

People

Locations

Trips

Projects

Collections

Sync Center

Settings
```

Route:

```text
/people
```

---

# Privacy

Every person supports:

* Private
* Unlisted
* Public (rare)

Default:

```text
Private
```

The public website should never expose private people.

---

# Person Record

Store only information that is useful for a personal knowledge platform.

## Identity

```text
First Name

Last Name

Display Name

Nickname

Slug

Avatar

Visibility
```

---

## Relationship

```text
Relationship Type

Examples:

Family

Friend

Partner

Relative

Colleague

Classmate

Neighbor

Mentor

Custom
```

Allow custom relationship types.

---

## Important Dates

Support multiple dates.

Examples:

Birthday

Anniversary

Met On

Wedding

Graduation

Custom

Each date supports:

Title

Date

Reminder Enabled

Notes

Future reminders can be implemented later.

---

## Personal Notes

Free-form markdown notes.

Examples:

* Things they like
* Gift ideas
* Food preferences
* Shared hobbies
* Things to remember
* Funny stories
* Conversation notes

Private by default.

---

## Interests

Simple tags.

Examples:

Photography

Cycling

Anime

Music

Books

Travel

Programming

Cooking

Gaming

---

## Social Links


Examples:

Instagram

GitHub

LinkedIn

Website

Avoid storing unnecessary personal information.

---

# Do NOT Store

Do not attempt to become a contact management application.

Avoid making phone numbers, addresses, emails and other sensitive contact information central to the design.

If support is added later, it should be optional, encrypted where appropriate, and hidden by default.

The focus is relationships and memories.

---

# Avatar

Support:

Upload image

Choose from Media Library

Remove avatar

Store through the existing media system.

---

# Person Detail Page

Display:

Avatar

Name

Relationship

Important Dates

Interests

Notes

Recent Activity

Connections

---

# Connections

This is the most important part of the module.

A person should connect to many other entities.

Examples:

## Photos

Show all gallery images where this person appears.

Support manual tagging.

---

## Locations

Display:

Places visited together.

Examples:

Tokyo

Darjeeling

Victoria Memorial

---

## Trips

Display:

Trips shared.

Example:

Japan 2028

Sikkim Road Trip

Weekend in Kolkata

---

## Microblogs

Show all related microblogs.

Examples:

Birthday post

Trip updates

Funny memories

---

## Blog Posts

Optional.

Show blog posts mentioning the person.

---

## Projects

Show projects worked on together.

Examples:

Open Source Project

Photography Exhibition

Hackathon

---

## Collections

Allow adding people to collections.

Examples:

Family

School Friends

Photography Group

Travel Friends

Developers

---

## Notes

Allow standalone notes related to a person.

Future feature.

---

# Relationship Engine

Do not create dedicated join tables for every module.

Use the generic Relationship Engine.

Examples:

Person

↓

appears_in

↓

Photo

Person

↓

visited

↓

Location

Person

↓

joined

↓

Trip

Person

↓

mentioned_in

↓

Microblog

Person

↓

worked_on

↓

Project

This allows future entity types without redesign.

---

# Search

Support searching by:

Name

Nickname

Relationship

Tags

Notes

Interests

Keyboard shortcut:

Ctrl + K

People should appear in global search results.

---

# Filters

Relationship

Birthday Month

Recently Added

Recently Updated

Favorites

Has Notes

Has Trips

Has Photos

Visibility

---

# Favorites

Allow marking important people as favorites.

Examples:

Immediate family

Close friends

Frequently referenced people

---

# Timeline

Generate a timeline for each person.

Examples:

2026

Trip to Darjeeling

Uploaded 43 Photos

Mentioned in 6 Microblogs

Birthday

Started Project

The timeline should be powered by Activities.

---

# Activity Integration

Creating or updating a person generates activities.

Examples:

Created Person

Updated Notes

Added Birthday

Tagged in Photo

Added to Trip

Connected to Project

Activities integrate with the global activity system.

---

# Dashboard Widgets ( plug in with the dashboard cache system)

Future widgets:

Upcoming Birthdays

Recently Added People

Recently Active

People with Recent Trips

Favorite People

---

# Collections

People can belong to collections.

Examples:

Family

Friends

Photography Friends

College

Developers

Travel Buddies

Collections are generic and reusable across the CMS.

---

# Future Reminders

Design for future support.

Examples:

Birthday Reminder

Anniversary Reminder

Gift Reminder

Travel Reminder

Reminder architecture should remain generic.

---

# Future Timeline ( add this )

Eventually each person page should become a memory hub.

Example:

John

↓

Trips Together

↓

Photos Together

↓

Projects

↓

Locations

↓

Microblogs

↓

Important Dates

↓

Notes

↓

Activity Timeline

The page should tell the story of the relationship over time.

---

# UI

Follow the cms theme
Large avatar.

Relationship badge.

Timeline layout.

Connection cards.

Markdown notes.

Responsive.

Minimal.

Fast search.

Keyboard friendly.

---

# Technical Requirements

Use:

* Next.js App Router
* TypeScript
* Turso
* Drizzle ORM

Integrate with:

* Media Library
* Relationship Engine
* Activity System
* Global Search
* Collections
* Locations
* Trips
* Projects

The module should not duplicate relationship logic.

Use shared abstractions wherever possible.

---

# Deliverables

Implement:

* People module
* Person detail page
* Relationship types
* Important dates
* Notes
* Interests
* Avatar support
* Favorites
* Search
* Filters
* Collections integration
* Relationship Engine integration
* Activity integration
* Timeline foundation
* Dashboard widget hooks
* Future reminder support

The People module should become the central place for managing personal relationships and memories, connecting the people in my life with the places I've been, the photos I've taken, the projects I've worked on, and the experiences I've recorded throughout the CMS.
