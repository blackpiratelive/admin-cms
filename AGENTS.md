# AI Assistant Guidelines & Engineering Standards — admin-cms

This file outlines the engineering standards, workflow rules, and conventions for all AI coding assistants working in the `admin-cms` repository.

---

## 1. Golden Rules for AI Assistants

1. **Always Update AI Handoff Documents**:
   - Update [`AI_HANDOFF.md`](./AI_HANDOFF.md) for any architectural, schema, backend, or full-stack updates.
   - Update [`MICROBLOG_APP_HANDOFF.md`](./MICROBLOG_APP_HANDOFF.md) whenever creating, modifying, or refactoring components in [`mobile-microblog/`](./mobile-microblog/).
   - Keep changelog sections, directory trees, and test counts accurate.

2. **Always Run Automated Tests & Static Analysis**:
   - **Mobile Flutter App (`mobile-microblog/`)**:
     ```bash
     cd mobile-microblog
     export PATH="/home/dog/flutter/bin:$PATH"
     flutter analyze   # Must report zero issues
     flutter test      # Must pass 100% of tests
     ```
   - **Next.js & Backend CMS**:
     ```bash
     npm test          # Must pass 100% of Vitest test suites
     ```

3. **Always Commit and Push Changes**:
   - After completing and verifying a task, **always** stage, commit with a concise, descriptive semantic commit message, and push directly to `origin main`:
     ```bash
     git add .
     git commit -m "feat(...) or fix(...): description"
     git push origin main
     ```

4. **Strict Subsystem Isolation**:
   - The standalone Cupertino microblog client lives in [`mobile-microblog/`](./mobile-microblog/).
   - The legacy multi-module Material client lives in [`android/`](./android/).
   - Never touch, modify, or regress [`android/`](./android/) when working on `mobile-microblog/`. Always verify that `git status android/` remains clean.

---

## 2. Architecture & Design Principles

- **Mobile Design Language**: `mobile-microblog` adheres strictly to Apple's modern **Liquid Glass** and **Cupertino** design language (`CupertinoApp`, `LiquidGlassContainer`, `AmbientMeshBackground`, `FloatingGlassHeader`). Do not introduce Material widgets (e.g. `Scaffold`, `AppBar`, `FloatingActionButton`) into `mobile-microblog`.
- **Database Access**: Single-user PKP using Drizzle ORM and Turso (libSQL). Hugo site is strictly read-only; CMS is the sole writer.
- **Publishing Pipeline**: Mutations trigger asynchronous background jobs and deploy hooks (`VERCEL_DEPLOY_HOOK`) without blocking user operations.
