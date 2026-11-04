# Classroom connection test: findings

Date: 2026-11-04. Account: the owner's student account. Google OAuth client status: Testing.

## Result

The gate passed: the API lists all six modules, with no API errors.

**Limits of that result:** only modules 0 and 1 have content (26 items). Modules 2 to 5 return nothing, and their Classwork pages in Classroom are also empty, so the data is consistent. The import has not yet been seen working on those four modules or on any announcement.

## Data by module

| Module | Topics | Coursework | Materials | Announcements |
|---|---|---|---|---|
| 0 Start and Completion | 3 | 6 | 7 | 0 |
| 1 AI Software Engineering Foundations | 3 | 8 | 5 | 0 |
| 2 to 5 | 0 | 0 | 0 | 0 |

## What this means for the design

- **Materials are a large share.** 12 of the 26 items are materials, which the Classroom to-do list does not contain. All 8 open to-do items were found in coursework. This supports the dashboard's purpose.
- **Due dates can't drive the to-do list.** Only 1 of 14 coursework items has one. Kurspool needs its own statuses, as the spec says.
- **Topics are reliable so far.** All 26 items have a `topicId`, so modules → topics → items works. The schema must still allow items without a topic.
- **Module order must come from the name.** The API returned courses in no useful order, so sort by the leading number in the course name.
- **Links back are available.** Courses, coursework and materials all have `alternateLink`.
- **Attachments seen:** `link` (28) and `driveFile` (18). No `youtubeVideo` or `form` appeared, though the schema should support all four, because the API defines them.
- **Announcements:** none returned so far. The field list is unknown from real data, so the import should store only what the Phase 2 tests confirm.

## Fields seen

- **Course:** `id`, `name`, `section`, `courseState`, `alternateLink`, `updateTime`
- **Topic:** `courseId`, `topicId`, `name`, `updateTime`
- **Coursework:** `id`, `courseId`, `title`, `description`, `materials`, `state`, `alternateLink`, `creationTime`, `updateTime`, `workType`, `topicId`, `dueDate`, `dueTime`, `maxPoints`
- **Material:** `id`, `courseId`, `title`, `description`, `materials`, `state`, `alternateLink`, `creationTime`, `updateTime`, `topicId`

All 14 coursework items have `workType` `ASSIGNMENT` and `state` `PUBLISHED`.

## Category rules

| Category | Items |
|---|---|
| Session | 7 |
| Other | 8 |
| Feedback | 4 |
| Further reading | 4 |
| Recording | 3 |

The 8 in "other" are too many for the rules as written:
- Most are organizational, using 📆, 🗓, 📋 and 🎁 or plain text such as a trainer note or an upload request.
- One is a session-like item that starts with 🇬🇧 but lacks 👨🏼‍💻.

**Proposed for Phase 2:** add an "Organization" category for 📆, 🗓 and 📋, and treat 🇬🇧 titles as sessions when no other rule matches. Test these against all 26 real titles.

## Token lifetime

- A refresh token was issued, with `refresh_token_expires_in` = 604799 seconds, which is 7 days. This confirms the limit for an app in Testing status.
- The current token stops working around 2026-11-11 unless the app's status changes or the owner reconnects.
- Task 6 decides whether publishing the sync client removes this limit.

## Scope labels and publishing

- **Labels:** after being saved on the Data Access page, all five scopes are listed under "non-sensitive", including after a reload. This differs from Google's Classroom add-on guide, which calls Classroom scopes sensitive. The console will be rechecked when publishing.
- **Scope name:** the console shows `classroom.coursework.me.readonly` as `classroom.student-submissions.me.readonly`, described as "View your course work and grades". Kurspool does not import grades or `maxPoints`.
- **Publishing:** "Publish app" became available after the Branding page received the real home page, privacy page and authorized domain. The sync client has been In production since 2026-11-04, and the scopes stayed non-sensitive.
- **Section names:** real courses of one batch differ by spacing, so section matching ignores whitespace differences.

## Not yet confirmed

- Whether publishing removes the 7-day limit. The production connection was made on 2026-11-04. If the daily import still succeeds after 2026-11-12, the limit is gone. If not, the maintainer page asks for a reconnect.
- Whether import handles real announcements and real content in modules 2 to 5, which were empty on 2026-11-04.
- Whether the scopes are sufficient for announcements with real content. The announcements call returned no error, but also no items.
