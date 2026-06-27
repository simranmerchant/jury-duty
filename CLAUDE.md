@AGENTS.md

## Project overview

Next.js web app + API backend for **Jury Duty** — a social prediction app where friends bet points on personal events. The mobile frontend lives in the companion repo `jury-duty-mobile` (Expo). Deployed on Vercel at `https://juryduty.xyz`. Database is Supabase (Postgres).

**Tech stack:** Next.js (App Router), Supabase, Privy (auth), Tailwind CSS, TypeScript, Bun.

**Key pages (app/):**
- `page.tsx` — root redirect
- `e/[id]/page.tsx` — event detail: bets, create/resolve predictions
- `feed/page.tsx` — social feed of bets from people you follow
- `profile/page.tsx` — own profile: points, stats, follower/following modal, settings
- `u/[username]/page.tsx` — public profile page
- `people/page.tsx` — people discovery / search
- `notifications/page.tsx` — notification inbox
- `events/page.tsx` — home: list of events & groups
- `login/page.tsx`, `onboarding/page.tsx` — auth + first-run flow
- `how-it-works/page.tsx` — explainer carousel
- `join/[token]/page.tsx` — invite link landing

**Key API routes (app/api/v1/):**
- `me/` — get/update own profile, followers, following, history, avatar, push tokens
- `users/[id]/` — public profile, follow/unfollow, followers, following list
- `events/` — create/list events and groups
- `bets/` — create/resolve/double-down on predictions
- `feed/` — paginated social feed
- `auth/init/` — create balance row on first login (new users start at 300 pts)
- `comments/`, `reports/`, `join/`
- `posts/` — share/unshare a resolved public bet to the social feed

**Key lib files:**
- `lib/supabase.ts` — Supabase client
- `lib/privy.ts` — auth token verification
- `lib/follow.ts` — follow status logic (tested)
- `lib/payout.ts` — bet resolution payout math (tested)
- `lib/push.ts` / `lib/webpush.ts` — push notification helpers

**Database:** migrations live in `supabase/migrations/`. Latest is `035_posts.sql` (posts table for feed sharing). Apply with `npx supabase db push` after linking (`supabase link --project-ref gfcipzuqaldyebocmypw`).

**Key API routes added:**
- `posts/` — POST to share a resolved bet to feed; DELETE to unshare (by `?bet_id=`)
- `users/[id]/followers/`, `users/[id]/following/` — list followers/following for any user

**Current branch for ETHGlobal work:** `feat/ethglobal-prizes` (not merged to main).

---

## Rules

- NEVER read `.env.local` under any circumstances.
- NEVER claim "all tests pass" when output shows failures.
- Keep text between tool calls to <= 25 words.
- When adding a new feature, always add test cases for it. Extract pure logic into `lib/` helpers so it can be tested without mocking Next.js or Supabase. Run `bun test` and confirm all tests pass before finishing.
- When a change requires a DB schema alteration: notify the user first, then apply it via `npx supabase db push` using a new migration file in `supabase/migrations/`. Never silently skip DB changes.
- Always run `bun test` and confirm all tests pass before pushing to Vercel (i.e., before `git push`).

---

## Keeping this file updated

**Update this file before every `git push`.** Specifically:
- Update the pages/routes list when adding or removing routes
- Update the migrations note when adding new migrations
- Add any new rules or conventions discovered during development
- Keep this file under 250 lines — trim stale or redundant content to stay within the limit
