# Kurspool Phases 3 and 4: Dashboard and Personal Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students see what is new, open and finished across all modules, use the course's links in one click, and manage their own tasks and links.

**Architecture:** Pages read through row-level security with the signed-in user's client, so access rules still protect every read. Pure functions in `lib/dashboard.ts` and `lib/forms.ts` hold the logic. Server actions check input and write through the same client. Phases 3 and 4 are built together because New and To do depend on item status.

**Tech Stack:** Next.js server components and actions, shadcn/ui, Supabase, Vitest.

## Global Constraints

- Everything stays free. Private links and emails live in the database, never in Git.
- Leaving New: opening an item, setting a status, or "mark all as seen". Done and Skipped are set only by the student.
- Module progress is (Done + Skipped) / visible items.
- Links must be `http` or `https`. Done never submits anything in Classroom.
- Maintainers cannot remove their own email from the batch list.

## Tasks

- [ ] **Task 1:** Tests, then `lib/dashboard.ts` (status, progress, filters, grouping) and `lib/forms.ts` (link and email input).
- [ ] **Task 2:** Test, then a migration for `batches.last_synced_at`, updated by `runSync` when at least one module succeeded, because students cannot read `sync_runs`.
- [ ] **Task 3:** Server actions for status, seen, tasks, personal links, quick links and the batch list.
- [ ] **Task 4:** Theme, app frame, dashboard, module pages, settings, and maintainer editors.
- [ ] **Task 5:** Tests, lint and build pass. Review screenshots locally and on phone width. Run an accessibility audit.
- [ ] **Task 6:** Apply the migration in Supabase, add the batch's quick links, deploy, and verify with real data.
