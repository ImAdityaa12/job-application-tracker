# Job Application Tracker — Claude Code Spec

## What to build

A full-stack Next.js web app that connects to the user's Gmail, automatically
detects job application emails, tracks every application's status, surfaces
real responses vs. auto-confirmations, and shows interview dates on a calendar.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | Use `src/app` directory |
| Auth + Gmail OAuth | Better Auth + Google provider | Gmail scope included |
| Database | PostgreSQL via NeonDB | Drizzle ORM |
| UI | shadcn/ui + Tailwind CSS | |
| Background sync | Next.js Route Handler + cron trigger | `/api/sync/gmail` |
| Email parsing | Gmail REST API (via Google OAuth token) | No third-party library needed |
| Calendar | `react-big-calendar` + `date-fns` | |
| State | Zustand (client), React Query (server state) | |

---

## Auth & Gmail Access

Use **Better Auth** with the **Google provider**. Request these OAuth scopes:

```
openid
email
profile
https://www.googleapis.com/auth/gmail.readonly
```

Store the Google `access_token` and `refresh_token` in the Better Auth session
so the app can call the Gmail API on behalf of the user at any time.

In `auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scopes: [
        "openid", "email", "profile",
        "https://www.googleapis.com/auth/gmail.readonly"
      ],
    },
  },
});
```

---

## Database Schema (Drizzle)

```ts
// schema.ts

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("applied"),
  // status values: applied | screening | interview | offer | rejected | withdrawn
  appliedAt: timestamp("applied_at"),
  lastActivityAt: timestamp("last_activity_at"),
  jobUrl: text("job_url"),
  notes: text("notes"),
  salaryRange: text("salary_range"),
  location: text("location"),
  gmailThreadIds: text("gmail_thread_ids").array().default([]),
  // array of Gmail thread IDs linked to this application
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const interviews = pgTable("interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  // type values: phone_screen | technical | hr | assignment | final | offer_call
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").default(60),
  location: text("location"), // Zoom link, office address, etc.
  notes: text("notes"),
  outcome: text("outcome"), // pending | passed | failed
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailThreads = pgTable("email_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  gmailThreadId: text("gmail_thread_id").notNull().unique(),
  applicationId: uuid("application_id").references(() => applications.id),
  subject: text("subject").notNull(),
  fromEmail: text("from_email"),
  fromName: text("from_name"),
  snippet: text("snippet"),
  category: text("category").notNull().default("unclassified"),
  // category values: confirmation | signal | interview | offer | rejection | unclassified
  priority: text("priority").default("low"),
  // priority values: high | medium | low
  isRead: boolean("is_read").default(false),
  receivedAt: timestamp("received_at"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  syncedAt: timestamp("synced_at").defaultNow(),
  threadsFound: integer("threads_found").default(0),
  newThreads: integer("new_threads").default(0),
  status: text("status").default("success"), // success | error
  errorMessage: text("error_message"),
});
```

---

## Gmail Sync Logic

### Route: `POST /api/sync/gmail`

This is the core of the app. When called, it should:

1. Get the current user's Google `access_token` from the session (refresh it
   if expired using the `refresh_token`).
2. Call the Gmail API to search for threads matching job application keywords.
3. For each new thread (not already in `emailThreads`), call Claude API to
   classify it.
4. Save new threads to `emailThreads`.
5. Auto-create or update `applications` records based on classified threads.
6. Save a `syncLogs` entry.

**Gmail API search queries to run (run all, deduplicate by threadId):**

```
"your application" OR "thank you for applying" newer_than:60d
"interview" OR "technical assessment" OR "coding challenge" newer_than:60d
"offer letter" OR "job offer" newer_than:60d
"unfortunately" OR "not moving forward" OR "other candidates" newer_than:60d
```

**Gmail API call:**

```ts
const res = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}&maxResults=50`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
const { threads } = await res.json();
```

**For each thread, fetch full details:**

```ts
const thread = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
).then(r => r.json());
```

### Claude Classification (called per thread)

Send a batch of up to 20 threads to Claude in one API call. Prompt:

```
You are classifying job application emails for a developer job-hunting tracker.

For each thread, return a JSON array. Each item must have:
- threadId: string (the Gmail thread ID)
- company: string (extract company name, or "" if unclear)
- role: string (extract job title, or "" if unclear)  
- category: "confirmation" | "signal" | "interview" | "offer" | "rejection"
  - confirmation: auto-reply, ATS receipt, "we got your application"
  - signal: real human reply, follow-up question, any non-automated response
  - interview: explicitly schedules or proposes an interview/call
  - offer: job offer
  - rejection: rejection notice
- priority: "high" | "medium" | "low"
  - high: interview, offer
  - medium: signal (human reply)
  - low: confirmation, rejection
- interviewDate: ISO datetime string if an interview date is mentioned, else null
- summary: one sentence describing this email

Threads:
${JSON.stringify(threadBatch)}

Return ONLY a JSON array. No markdown, no extra text.
```

Use `claude-sonnet-4-20250514` for classification.

### Auto-create Applications

After classification, for each thread with a known `company`:
- Check if an application for that company already exists for this user
- If yes: update `status` and `lastActivityAt`, add threadId to `gmailThreadIds`
- If no and category is not `confirmation`: create a new `applications` row
- If category is `interview` and `interviewDate` is not null: create an
  `interviews` row automatically

---

## Pages & Routes

### `/` — Dashboard

Show:
- Stats row: Total Applications | Active | Interviews Upcoming | Offers
- "Sync Gmail" button (calls `/api/sync/gmail`, shows last synced time)
- Recent activity feed: last 10 email threads classified as signal/interview/offer
- Upcoming interviews (next 7 days)

### `/applications` — Application Board

Kanban board with columns:
```
Applied → Screening → Interview → Offer → Rejected
```

Each card shows: company, role, days since applied, last email snippet.

Drag-and-drop between columns to manually update status (use `@dnd-kit/core`).

Click a card → opens a side sheet (`shadcn Sheet`) with:
- Full application detail
- All linked Gmail threads (list with subject, date, category badge)
- Interview history
- Notes textarea (auto-saved)
- "Add interview" button

### `/calendar` — Interview Calendar

Full month/week/day view using `react-big-calendar`.

Each event shows: company name, role, interview type (phone/technical/HR).

Click event → shows interview detail with location/link, outcome field.

### `/inbox` — Smart Inbox

The filtered Gmail view (similar to what we built in the artifact).

Two tabs: **Needs attention** | **Auto-confirmations**

Each row shows: company, subject, received date, category badge, priority badge.

Click a row → links to the application it belongs to (or prompts to create one
if unlinked).

### `/settings` — Settings

- Connected Google account info
- Sync frequency (manual / every hour — use Vercel Cron for hourly)
- Notification preferences (browser notifications for new signals)
- Re-connect Gmail button

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/sync/gmail` | POST | Run Gmail sync for current user |
| `/api/applications` | GET, POST | List / create applications |
| `/api/applications/[id]` | GET, PATCH, DELETE | Single application |
| `/api/applications/[id]/interviews` | GET, POST | Interviews for an application |
| `/api/interviews/[id]` | PATCH, DELETE | Update/delete interview |
| `/api/threads` | GET | List email threads (with filters) |
| `/api/threads/[id]` | PATCH | Link thread to application |
| `/api/stats` | GET | Dashboard stats |

---

## Environment Variables

```env
# Database
DATABASE_URL=

# Better Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Anthropic
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Google Cloud Console Setup (do this manually before running Claude Code)

1. Go to https://console.cloud.google.com
2. Create a new project (e.g. "Job Tracker")
3. Enable **Gmail API** under APIs & Services → Library
4. Go to APIs & Services → OAuth consent screen
   - User type: External
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
5. Go to Credentials → Create credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
6. Copy `Client ID` and `Client Secret` → paste into `.env`

---

## Project Structure

```
src/
  app/
    (auth)/
      login/page.tsx
    (dashboard)/
      layout.tsx          # sidebar nav
      page.tsx            # dashboard
      applications/page.tsx
      calendar/page.tsx
      inbox/page.tsx
      settings/page.tsx
    api/
      auth/[...all]/route.ts
      sync/gmail/route.ts
      applications/route.ts
      applications/[id]/route.ts
      applications/[id]/interviews/route.ts
      interviews/[id]/route.ts
      threads/route.ts
      threads/[id]/route.ts
      stats/route.ts
  lib/
    auth.ts               # Better Auth config
    db/
      index.ts            # Drizzle client
      schema.ts           # All tables
    gmail.ts              # Gmail API helper functions
    classify.ts           # Claude classification logic
  components/
    ui/                   # shadcn components
    KanbanBoard.tsx
    InterviewCalendar.tsx
    SmartInbox.tsx
    ApplicationSheet.tsx
    SyncButton.tsx
```

---

## Key Implementation Notes for Claude Code

1. **Token refresh**: Better Auth stores the Google refresh token. Before every
   Gmail API call, check if the access token is expired and refresh it:
   ```ts
   // Use the refresh_token to get a new access_token via:
   // POST https://oauth2.googleapis.com/token
   ```

2. **Batch classification**: Don't call Claude once per email. Batch up to 20
   threads per Claude call to save tokens and time.

3. **Incremental sync**: Track `lastSyncedAt` per user. On sync, only fetch
   Gmail threads newer than that timestamp (use `after:` in Gmail query).

4. **Duplicate prevention**: Before inserting into `emailThreads`, always check
   `gmailThreadId` uniqueness.

5. **Rate limits**: Gmail API has a quota of 250 units/second. Add a 100ms
   delay between thread detail fetches if fetching more than 20 at once.

6. **Sidebar layout**: The `(dashboard)/layout.tsx` should have a fixed left
   sidebar (240px) with nav links to all pages. Main content scrolls.

7. **Empty state**: On first login before any sync, show a big "Connect Gmail
   & Sync" CTA on the dashboard.

8. **Date parsing**: Interview dates extracted by Claude may be relative ("next
   Tuesday") — store the raw string and also parse to ISO using `date-fns`.

---

## How to run this prompt with Claude Code

1. Create a new folder: `mkdir job-tracker && cd job-tracker`
2. Create a `CLAUDE.md` file in the root with this entire spec
3. Run: `claude` to open Claude Code
4. First message: `Read CLAUDE.md and build this project from scratch. Start with
   the database schema, auth setup, and Gmail sync logic, then build the UI pages.`
5. Let it scaffold — it will ask you to fill in `.env` values
6. Set up Google Cloud Console (see section above) and paste credentials
7. Run `npx drizzle-kit push` to create tables
8. Run `npm run dev` and sign in with Google

---

## Nice-to-haves (tell Claude Code after the core is done)

- Browser push notifications when a new signal email arrives (use Web Push API)
- Export applications to CSV
- Dark mode toggle
- Weekly summary email (send via Resend/Nodemailer)
- Auto-fill company logo using Clearbit logo API: `https://logo.clearbit.com/{domain}`