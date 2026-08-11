# Google auth and LeetCode linking

## Model

- **Identity provider:** Google. A user is identified by `users.google_sub`.
- **Game profile:** LeetCode. `users.leetcode_username` is nullable and only set
  after the account is verified with a fresh Accepted Two Sum submission
  (`users.leetcode_verified_at`).
- Games, dashboard, friends and lobbies read only our DB; they never depend on
  the login provider.

Legacy username/password auth has been removed (`password_hash` column dropped
in migration `d5e6f7a8b9c0`).

## Google OAuth (authorization code flow with PKCE)

1. Frontend "Continue with Google" calls `GET /auth/google/login-url`.
2. Backend stores an `oauth_sessions` row (state, PKCE verifier, nonce) and
   returns a Google consent URL.
3. Google redirects to `{GOOGLE_REDIRECT_URI}` (default
   `{FRONTEND_URL}/auth/callback`) with `?code=...&state=...`.
4. Frontend (App.tsx) posts `{code, state}` to `POST /auth/google/code`.
5. Backend exchanges the code with `client_secret` + PKCE verifier, verifies the
   ID token (signature via Google JWKS, audience, issuer, nonce), then
   finds-or-creates the user by `google_sub` and returns our JWT.

All subsequent API calls use the app JWT (`Authorization: Bearer`), unchanged.

## LeetCode account linking

- `POST /leetcode/link/start` — creates a 15-minute pending verification for a
  username (problem `two-sum`).
- `POST /leetcode/link/verify` — checks recent accepted submissions: matches
  `titleSlug === "two-sum"` submitted between `created_at` and `expires_at`.
  On success claims `users.leetcode_username`; otherwise increments `attempts`.
- `GET /leetcode/link/status` — current link state, latest verification, cooldown.
- `DELETE /leetcode/link` — unlinks; the next account must verify again.

Rules:
- Verification window: 15 minutes. Verify cooldown: 12s. Max attempts: 10.
- A pending verification never blocks another user from starting their own for
  the same username — the username is claimed only on a successful verification
  (the unique constraint is the final arbiter in a race).
- Sync is gated: `maybe_sync_user_daily_activity`,
  `fetch_user_recent_submissions` and the background sync all short-circuit when
  `users.leetcode_verified_at IS NULL`.
- Lobby creation, joining via invite, and game start require verified players.

## Setup

Add to `backend/.env`:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# Only needed if the frontend is served under a sub-path:
GOOGLE_REDIRECT_URI=https://host/cinnamon-code/auth/callback
```

Register an OAuth 2.0 Web client in Google Cloud Console with the redirect URI
added to the authorized redirect URIs.
