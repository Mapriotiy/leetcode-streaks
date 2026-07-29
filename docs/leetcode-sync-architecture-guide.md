# LeetCode Sync Architecture Guide

This guide describes the target sync architecture for scaling the app to roughly
500 active users without overloading LeetCode or duplicating work between
dashboard and lobby screens.

## Goal

The current app syncs LeetCode activity directly from several request paths:

- Dashboard syncs the current user when `GET /api/dashboard/` is opened.
- Lobby map and bingo sync players when `POST /api/lobbies/{id}/map/sync` is called.
- Multiple open clients can trigger duplicate syncs for the same lobby.

The target architecture should make sync controlled and reusable:

```text
Dashboard -> maybe sync current user
Lobby -> maybe sync lobby players
All LeetCode requests -> shared limiter/cooldown/backoff
Frontend -> frequently reads local DB state, less frequently requests LeetCode sync
```

## Core Idea

Use two levels of protection:

```text
user-level sync guard
  one user is not synced more often than the configured cooldown

lobby-level sync guard
  one lobby does not run full game sync more often than the configured cooldown
```

Dashboard must also use the user-level guard. Otherwise dashboard traffic can
still generate too many LeetCode requests even if lobby sync is optimized.

## Sync Scopes

Lobby gameplay and dashboard need different LeetCode data. Do not treat every
sync as a full profile sync.

```text
recent sync
  fetches LeetCode recent accepted submissions
  updates user_solved
  used by lobby map and bingo
  suggested cooldown: 60 seconds

profile sync
  fetches LeetCode profile, submission_calendar, avatar, ranking
  updates daily_activity and cached profile fields
  used by dashboard
  suggested cooldown: 5 minutes
```

## Database Fields

Add sync state to `users`:

```text
leetcode_recent_last_synced_at
leetcode_recent_sync_started_at
leetcode_recent_sync_error

leetcode_profile_last_synced_at
leetcode_profile_sync_started_at
leetcode_profile_sync_error

leetcode_avatar_url
leetcode_ranking
```

Add sync state to `lobbies`:

```text
last_synced_at
sync_started_at
sync_error
```

Store all timestamps in UTC.

## Backend Service Layer

Create shared services:

```text
backend/app/services/leetcode_sync.py
backend/app/services/leetcode_limiter.py
```

Suggested functions:

```py
maybe_sync_user_recent(user, db, cooldown_seconds=60)
maybe_sync_user_profile(user, db, cooldown_seconds=300)
maybe_sync_lobby(lobby, players, db, cooldown_seconds=60)
```

Each function should return sync metadata:

```json
{
  "status": "synced",
  "last_synced_at": "2026-07-30T12:00:00Z",
  "next_sync_after": "2026-07-30T12:01:00Z",
  "error": null
}
```

Supported statuses:

```text
synced
recently_synced
in_progress
rate_limited
failed
skipped
```

## LeetCode Limiter

All real LeetCode requests should go through one limiter.

Initial production-safe settings:

```text
global concurrency: 16
global rps: 5-8 requests/sec
burst: up to 20
429/403 response: global backoff for 2-5 minutes
```

The test branch can start slightly more aggressively, but production should only
increase limits after observing logs for rate limits and latency.

## Dashboard Flow

File:

```text
backend/app/api/routes/dashboard.py
```

Target behavior:

```text
GET /api/dashboard/

1. maybe_sync_user_recent(current_user)
2. maybe_sync_user_profile(current_user)
3. read daily_activity, user_solved, lobbies from DB
4. return dashboard payload with sync metadata
```

Dashboard should no longer unconditionally call full `sync_user_daily_activity`.

Suggested response extension:

```json
{
  "leetcode_username": "mapriotii",
  "avatar_url": "https://...",
  "current_streak": 1,
  "today_submissions": [],
  "activity_calendar": [],
  "lobbies": [],
  "sync": {
    "recent": { "status": "recently_synced" },
    "profile": { "status": "synced" }
  }
}
```

## Lobby Flow

File:

```text
backend/app/api/routes/lobby.py
```

Target behavior:

```text
GET /api/lobbies/{id}/map
  reads current state from DB only
  does not call LeetCode

POST /api/lobbies/{id}/map/sync
  checks lobby cooldown/lock
  if allowed, syncs lobby players
  recalculates map or bingo state
  returns fresh state with sync metadata
```

If `sync_started_at` is fresh:

```text
do not start a second sync
return current state with status = in_progress
```

If `last_synced_at` is newer than the cooldown:

```text
do not call LeetCode
return current state with status = recently_synced
```

If `sync_started_at` is older than 2-3 minutes:

```text
treat it as stale
allow a new sync
```

## Concurrent Player Sync

Files:

```text
backend/app/services/game_modes/territory.py
backend/app/services/game_modes/bingo.py
```

Current behavior is sequential:

```py
for _, user in players:
    submissions = await client.get_recent_accepted_submissions(...)
```

Target behavior:

```text
1. inspect players and skip users synced recently
2. fetch required LeetCode submissions concurrently
3. write DB results sequentially
4. apply current capture/claim logic
```

Important: do not use the same SQLAlchemy `Session` inside concurrent async
tasks. Only HTTP fetches should run concurrently. DB writes should happen after
`await gather(...)`.

## Frontend Flow

Files:

```text
frontend/src/pages/LobbyMapPage.tsx
frontend/src/pages/BingoBoardPage.tsx
```

Target behavior:

```text
on open:
  GET /map
  POST /map/sync

every 5-10 seconds:
  GET /map
  GET /events

every 60 seconds:
  POST /map/sync
```

This means the UI reads our DB frequently, while LeetCode sync is requested less
often and controlled by backend guards.

Add jitter to sync intervals:

```text
sync interval = 60 seconds + random 0-15 seconds
```

This avoids many clients hitting the backend at exactly the same moment.

## Keep-Alive

File:

```text
frontend/src/App.tsx
```

`/health` remains separate:

```text
GET /api/health
```

It must never trigger LeetCode sync. It is only for Render/UptimeRobot keep-alive.

## Logging

Add structured logs for every lobby sync:

```text
lobby_id
status
player_count
fetched_users
skipped_users
duration_ms
captured_count / claimed_count
rate_limited
error
```

Example:

```text
lobby_sync lobby=42 status=synced players=5 fetched=3 skipped=2 duration_ms=1840
```

## Implementation Order

Recommended commit sequence:

```text
feat: track leetcode sync state
feat: add leetcode request limiter
feat: guard user leetcode sync
feat: use guarded sync on dashboard
feat: collapse lobby sync requests
feat: sync lobby players concurrently
feat: separate lobby polling from sync
chore: log sync metrics
```

## Expected Result

Instead of this:

```text
500 clients
  -> each can trigger heavy LeetCode sync
  -> duplicate lobby syncs
  -> duplicate user syncs
```

The app should behave like this:

```text
500 clients
  -> frequently read state/events from Postgres
  -> occasionally request sync

Backend
  -> collapses sync by lobby
  -> collapses sync by user
  -> limits LeetCode request rate globally

LeetCode
  -> receives controlled traffic instead of duplicated bursts
```

This is the best next step before introducing Redis, background workers, Docker,
or Kubernetes. A worker can be added later behind the same service layer without
rewriting the business logic.
