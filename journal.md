# Feature: Journal Module (End-to-End Encrypted Personal Journal)

## Objective

Build a **Journal** module for the Personal CMS.

This is **not** a blog, note-taking app, or markdown editor.

It is a **private, end-to-end encrypted personal journal** designed for long-term journaling, reflections, memories, life events, travel journals, dreams, gratitude entries, meeting notes and personal thoughts.

The Journal is one of the few modules in the CMS where **privacy is the highest priority**.

Even if the database is compromised, the contents of journal entries must remain unreadable.

The CMS server must never receive plaintext journal content.

---

# Design Philosophy

The Journal should become the private memory archive of my life.

It should combine rich writing, encryption and contextual memories.

Unlike the rest of the CMS, this module is **not designed for publishing**.

Everything is private unless explicitly changed in the future.

The Journal should feel similar to:

* Apple Journal
* Day One
* Obsidian Daily Notes
* Notion Journal

while integrating deeply with the rest of the CMS.

---

# Core Principles

* End-to-End Encryption
* Zero-Knowledge Storage
* Rich Writing Experience
* Fast Search
* Beautiful Timeline
* Relationship-aware
* Long-term maintainability

---

# Technology

Use:

* Next.js App Router
* TypeScript
* Lexical Editor
* Turso
* Drizzle ORM
* Web Crypto API

Do NOT use server-side encryption.

Encryption and decryption must happen entirely inside the browser.

---

# Encryption Architecture

The encryption pipeline should be:

```text
Lexical JSON

↓

Serialize

↓

Encrypt in Browser

↓

Ciphertext

↓

Store in Turso

↓

Retrieve Ciphertext

↓

Decrypt in Browser

↓

Restore Lexical Editor
```

The server never receives plaintext.

---

# Encryption Algorithm

Use modern browser cryptography.

Requirements:

AES-256-GCM

Key derivation using:

Argon2id (preferred)

or

PBKDF2 (fallback if required)

Random salt per user.

Random IV per entry.

Never reuse IVs.

Store:

Salt

IV

Ciphertext

Algorithm version

Only ciphertext should be stored.

---

# Journal Password

The journal should use a dedicated encryption password.

Do NOT reuse login credentials.

Workflow:

```text
Login

↓

Open Journal

↓

Enter Journal Password

↓

Derive Key

↓

Decrypt Entries
```

The encryption key should never leave browser memory.

Never transmit it to the server.

Never store the raw key.

---

# Auto Lock

Support automatic locking.

Options:

Immediately

5 minutes

10 minutes

30 minutes

1 hour

Manual only

When locked:

Destroy the decrypted key from memory.

Require password again.

---

# Session Behaviour

After unlocking:

Keep key only in memory.

Refreshing the page should require unlocking again.

Browser restart should require unlocking again.

Logout should immediately clear all keys.

---

# Journal Entry Structure

Only metadata should remain unencrypted.

Example schema:

```text
id

created_at

updated_at

entry_date

entry_type

mood

favorite

visibility

location_id

trip_id

weather_id (future)

encrypted_content

encryption_version

iv

salt
```

The following MUST remain encrypted:

Title

Body

Lexical JSON

Private tags

Private references

Internal comments

Draft content

---

# Lexical Editor

Use the complete Lexical experience.

Support:

Rich text

Markdown shortcuts

Headings

Lists

Checklists

Tables

Blockquotes

Code blocks

Inline code

Horizontal rules

Callouts

Highlights

Text colors

Text alignment

Links

Images

Videos

File attachments

Drag & Drop

Slash commands

Keyboard shortcuts

Undo / Redo

Emoji

Mentions

Collapsible sections

Nested lists

Copy / Paste

Image resizing

Markdown import

Markdown export

Auto save

Autosave indicators

Character count

Word count

Reading time

---

# Slash Commands

Examples:

/heading

/table

/checklist

/image

/person

/location

/project

/trip

/photo

/date

/quote

/code

---

# Entry Types

Support multiple journal categories.

Examples:

Daily Journal

Reflection

Travel Journal

Dream

Meeting Notes

Ideas

Gratitude

Life Event

Health

Random Thoughts

Project Journal

Learning Journal

Custom

Each type may later have templates.

---

# Mood Tracking

Each entry supports mood.

Examples:

😁 Amazing

😊 Happy

🙂 Good

😐 Neutral

😔 Sad

😞 Bad

😭 Terrible

Future analytics should use mood history.

---

# Weather (Future)

Prepare schema.

Future support:

Temperature

Condition

Humidity

Wind

Sunrise

Sunset

No implementation required now.

---

# Relationships

Journal entries integrate with every major entity.

Support references to:

Locations

Trips

People

Projects

Collections

Photos

Microblogs

Movies

TV Shows

Books

Music

Bookmarks

Notes

Future entities

Use the generic Relationship Engine.

Do NOT create module-specific relationship tables.

---

# Mentions

Inside Lexical support mentions.

Examples:

@John

@Tokyo

@Personal CMS

@Japan Trip

@Photography

Mentions create relationships automatically.

---

# Attachments

Support attaching existing media.

Types:

Images

Videos

Audio

PDFs

Documents

Attachments should use the existing Media Library.

Do not duplicate files.

---

# Timeline

The Journal homepage should display a timeline.

Examples:

Today

Yesterday

Last Week

Last Month

This Year

Support infinite scrolling.

---

# Calendar View

Provide a calendar.

Days with entries should be highlighted.

Clicking a day opens entries.

Support:

Month

Year

Heatmap (future)

---

# Journal Dashboard

Show:

Recent Entries

Mood Summary

Writing Streak

Longest Streak

Entries This Week

Entries This Month

Favorite Entries

Recently Updated

Writing Time

Word Count

---

# Statistics

Track:

Total Entries

Words Written

Average Entry Length

Longest Entry

Writing Streak

Longest Streak

Entries Per Month

Entries Per Year

Mood Distribution

Entry Types

Most Used Locations

Most Mentioned People

Most Mentioned Projects

These statistics should be maintained by the Statistics Engine rather than calculated on every request.

---

# Search

The Journal must support searching encrypted entries.

Do NOT store plaintext searchable content on the server.

Architecture:

After unlocking:

Decrypt entries

↓

Build in-memory search index

↓

Search locally

Search should support:

Title

Content

Mentions

Tags

Dates

Entry Type

Mood

No server-side search index should contain plaintext.

---

# Drafts

Support drafts.

Autosave every few seconds.

Drafts remain encrypted.

Recover drafts after browser crash.

---

# Version History

Maintain encrypted revisions.

Example:

Entry

↓

Revision 1

↓

Revision 2

↓

Revision 3

Allow restoring previous versions.

All revisions remain encrypted.

---

# Templates

Support templates.

Examples:

Daily Reflection

Travel Day

Meeting

Gratitude

Learning

Workout Reflection

Templates insert starter content.

---

# Connections Panel

Each journal entry should display a contextual sidebar.

Examples:

📍 Location

👥 People

📷 Photos

🧳 Trip

📁 Project

🎬 Movies watched that day

🎵 Music listened that day

🏋 Workouts

💬 Microblogs

These relationships are metadata and remain outside encrypted content.

---

# Favorites

Allow marking entries as favorites.

Support filtering.

---

# Tags

Support journal-specific encrypted tags.

Also support public entity relationships through the Relationship Engine.

---

# Export

Support exporting decrypted entries.

Formats:

Markdown

JSON

HTML

PDF (future)

Encrypted Backup

---

# Backup

Support encrypted backups.

The exported backup should remain encrypted.

Restoring should require the journal password.

---

# Offline Support (Future Ready)

Design the architecture for future offline capability.

Potential flow:

Decrypt

↓

Edit

↓

IndexedDB

↓

Sync Later

No implementation required now.

---

# Security Requirements

Never transmit plaintext.

Never transmit encryption keys.

Never store raw passwords.

Never log decrypted content.

Never expose decrypted content through APIs.

Destroy encryption keys after locking.

Protect against accidental plaintext persistence.

Version encryption format for future migrations.

---

# UI


Minimal.

Distraction-free writing.

Large typography.

Focus mode.

Fullscreen writing.

Reading mode.

Resizable sidebars.

Collapsible metadata panel.

Keyboard-first.

Responsive.

Fast.

Beautiful animations.

Autosave indicator.

Word count.

Reading progress.

Writing streak display.

---

# Integration

Integrate with:

Relationship Engine

Media Library

Activity System (metadata only)

Statistics Engine

Global Search (metadata only)

Locations

People

Trips

Projects

Collections

The encrypted journal content itself must never be indexed by server-side systems.

---

# Deliverables

Implement:

* End-to-end encrypted Journal module
* Client-side encryption/decryption
* Dedicated journal password
* Lexical editor with full feature set
* Autosave
* Draft recovery
* Calendar view
* Timeline view
* Mood tracking
* Entry types
* Relationship integration
* Mentions
* Media attachments
* Encrypted search (client-side)
* Version history
* Templates
* Statistics integration
* Export
* Encrypted backup
* Auto-lock
* Security hardening
* Future offline-ready architecture

The completed Journal module should become the private, secure memory archive of my life. It should combine best-in-class writing tools, strong cryptography, rich relationships with the rest of the Personal CMS, and a beautiful user experience while guaranteeing that only I can ever read the contents of my journal entries.
