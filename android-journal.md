# Feature Specification: Android Journal Application (Offline-First, End-to-End Encrypted)

## Objective

Build a native Android application for my Personal CMS.

The Android app is **not** intended to expose the entire CMS. The initial release focuses exclusively on the **Journal module**.

The Journal is a private, offline-first, end-to-end encrypted writing application that synchronizes with my Personal CMS when connectivity is available.

The application should feel like a polished, premium Android app rather than a web application wrapped in a WebView.

Do **not** use a WebView.

Use native Android technologies throughout.
This environment contains all the android sdk software, if not you have to download it. 

---

# Technology Stack

Implement using:

* Kotlin
* Jetpack Compose
* Material 3
* Room Database
* WorkManager
* Kotlin Coroutines
* Kotlin Flow
* Android Keystore
* Web Crypto equivalent for Android (AndroidX Security / javax.crypto as appropriate)
* Coil for image loading
* Ktor or Retrofit for networking
* Hilt for dependency injection
* MVVM + Repository architecture

The app should be modular and maintainable.

---

# Design Philosophy

The application should be:

* Offline First
* Privacy First
* Fast
* Responsive
* Tablet Friendly
* Keyboard Friendly
* Landscape Friendly
* Material 3 compliant

The server should be treated only as a synchronization endpoint.

Everything should work without internet.

---

# Instance Configuration

**Do NOT hardcode the CMS URL.**

The application must support self-hosted instances.

During first launch present an onboarding flow.

User enters:

CMS Base URL

Example:

```
https://cms.example.com
```

Validate:

* HTTPS
* Reachable
* API compatibility

Store securely.

Allow changing the instance later.

Settings should include:

* Change Instance URL
* Test Connection
* API Version
* Sync Status

Do not assume localhost.

Do not assume any fixed domain.

Every API request must use the configured base URL.

---

# Authentication

Support authentication against the existing CMS.

The app should use the same authentication mechanism as the web application.

Do not create a second authentication system.

After login:

Store authentication tokens securely.

Support automatic refresh.

Logout clears:

* Tokens
* Session
* Encryption keys

---

# Journal Encryption

The Android app must implement the exact same encryption model as the web application.

The Journal uses:

DEK / KEK architecture.

Do not invent a second implementation.

Workflow:

Journal Password

↓

Argon2id

↓

KEK

↓

Decrypt encrypted DEK

↓

Use DEK

↓

Encrypt/Decrypt Entries

The app must be fully compatible with journals created on the website.

---

# Offline First

The Journal should work without internet.

Workflow:

Create Entry

↓

Encrypt

↓

Store Locally

↓

Queue Sync

↓

Internet Available

↓

Sync Server

Users should never notice whether they are online.

---

# Local Storage

Use Room.

Store:

Encrypted Journal Entries

Encrypted Assets

Sync Queue

Metadata

Never store plaintext journal content.

---

# Background Sync

Use WorkManager.

Features:

Automatic Retry

Exponential Backoff

Battery Aware

Network Aware

Resume after reboot

Support:

Create

Update

Delete

Asset Upload

Asset Download

Conflict Resolution

---

# Conflict Resolution

Use:

updated_at

device_id

revision

Last-write-wins is acceptable for the first version.

Future conflict UI can be added later.

---

# Rich Text Editor

Do NOT use Lexical.

Do NOT use WebView.

Build a native Compose editor.

However...

The editor MUST support every node currently supported by the web application.

The Android application should treat **Lexical JSON as the canonical document format**.

The Android editor is responsible for reading, editing and writing valid Lexical JSON.

---

# Lexical Compatibility

The Android editor must support **every node implemented by the web application**, including all custom nodes.

Do not implement only a subset.

The parser, renderer and editor must remain compatible with the current web implementation.

If the web application adds a new node in the future, the architecture should make it straightforward to implement on Android.

The Android editor should be designed around extensible node renderers rather than hardcoded conditionals.

---

# Supported Features

The Android editor must support every formatting feature available on the website.

Including (but not limited to):

Paragraphs

Headings

Bold

Italic

Underline

Strikethrough

Inline Code

Code Blocks

Quotes

Lists

Numbered Lists

Checklists

Tables

Horizontal Rules

Links

Text Colors

Highlights

Alignment

Indentation

Nested Lists

Markdown Shortcuts

Slash Commands

Undo

Redo

Clipboard

Drag & Drop (where supported)

Mentions

Custom Nodes

Inline Images

Attachments

Future Nodes

---

# Custom Nodes

Support every custom node from the web app.

Examples:

JournalImageNode

PersonMentionNode

LocationMentionNode

TripMentionNode

ProjectMentionNode

CollectionMentionNode

Future custom nodes

The node system should be extensible.

---

# Inline Images

Inline images must work exactly like the website.

Workflow:

Insert

↓

Compress

↓

Remove EXIF

↓

Generate Thumbnail

↓

Encrypt Original

↓

Encrypt Thumbnail

↓

Upload to Cloudinary

↓

Insert JournalImageNode

↓

Continue Editing

Image uploads should never block writing.

---

# Journal Attachments

Support:

Image Attachments

Future:

Videos

Audio

PDF

Documents

Attachment gallery should appear below the editor.

---

# Image Viewing

Support:

Encrypted Thumbnail

Encrypted Original

Fullscreen Viewer

Zoom

Pan

Swipe

Download

Delete

---

# Search

Search is performed locally.

Workflow:

Unlock Journal

↓

Recover DEK

↓

Decrypt Entries

↓

Build Search Index

↓

Search

No plaintext search index should exist on the server.

---

# Calendar

Provide:

Month View

Year View

Day Selection

Writing Heatmap (future)

---

# Timeline

Support:

Today

Yesterday

This Week

This Month

Infinite Scrolling

Grouping

---

# Dashboard

Show:

Recent Entries

Writing Streak

Longest Streak

Entries This Month

Mood Summary

Favorite Entries

Sync Status

---

# Tablet Support

The application **must be fully tablet optimized**.

Do not simply stretch the phone layout.

Implement responsive layouts.

Examples:

Phones:

Single-pane navigation.

Tablets:

Navigation Rail

↓

Entry List

↓

Editor

Landscape tablets should support a three-column layout.

Example:

Navigation

↓

Journal List

↓

Editor

Large screens should use adaptive layouts instead of oversized phone UI.

Support:

Portrait

Landscape

Foldables

ChromeOS

External Keyboard

Mouse

Trackpad

Stylus

Resizable Windows

Split Screen

Multi Window

---

# Keyboard Support

Support:

Ctrl+B

Ctrl+I

Ctrl+U

Ctrl+Z

Ctrl+Shift+Z

Ctrl+K

Tab

Shift+Tab

Arrow Navigation

Escape

Desktop-class keyboard behaviour should work on tablets.

---

# Material 3

Implement Material 3 correctly.

Support:

Dynamic Color

Dark Mode

Light Mode

System Theme

Adaptive Components

Large Screen Components

---

# Performance

Large journals should remain responsive.

Implement:

Lazy Lists

Incremental Rendering

Background Parsing

Background Encryption

Background Image Processing

Memory Management

---

# Accessibility

Support:

TalkBack

Large Fonts

High Contrast

Keyboard Navigation

Accessible Touch Targets

Content Descriptions

---

# Settings

Implement:

Instance URL

Authentication

Journal Password

Biometric Unlock

Sync

Theme

Cache

Storage Usage

About

Diagnostics

Export Logs (non-sensitive only)

---

# Biometrics

Support optional biometric unlock.

Biometrics unlock access to the locally protected encryption material but do not replace the Journal Password.

Use Android Keystore.

Never weaken the DEK/KEK architecture.

---

# Notifications

Support optional reminders.

Examples:

Morning Journal

Evening Reflection

Weekly Review

Notifications remain local.

---

# Architecture

Use clean architecture.

Presentation

↓

Domain

↓

Data

↓

Repositories

↓

Networking

↓

Database

↓

Encryption

Avoid business logic inside UI components.

---

# Deliverables

Implement:

* Native Android Journal application
* Offline-first architecture
* Room database
* WorkManager synchronization
* Configurable CMS instance URL
* Secure authentication
* DEK/KEK compatible encryption
* Native rich-text editor
* Full Lexical JSON compatibility
* Support for every node implemented by the web application
* Inline encrypted images
* Encrypted attachments
* Calendar
* Timeline
* Dashboard
* Tablet-optimized adaptive UI
* Foldable support
* Keyboard shortcuts
* Material 3 implementation
* Biometric unlock
* Responsive layouts
* Clean architecture
* Extensible editor and node system
* High-performance rendering

The finished application should feel like a premium native Android journaling application while remaining completely compatible with the web application's encrypted Journal, Lexical JSON document format, synchronization protocol, and future feature additions.:::
