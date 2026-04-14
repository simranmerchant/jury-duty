# Changelog

All notable changes to this project will be documented in this file.

## [0.1.4.0] - 2026-04-11

### Added

- Web Push notifications via VAPID + service worker (`public/sw.js`). Users can subscribe from the in-app notification panel or via the install prompt. Push is sent on bet creation, bet resolution, and overdue bet deadline.
- `web_push_subscriptions` Supabase table (migration `017_add_web_push_subscriptions.sql`) stores endpoint, p256dh, and auth keys per user.
- `lib/webpush.ts` — server-side push helper with lazy VAPID initialization (avoids build-time crash when env vars are absent).
- `POST /api/v1/me/web-push-subscription` — upsert a push subscription. `DELETE` removes it.
- Install prompt (`app/install-prompt.tsx`) — two-step flow: install card (iOS manual steps or Android native prompt) followed by a push-enable card. Only shown to authenticated users. If already installed as PWA, skips to push step.
- Gavel icon as app favicon, Apple touch icon, and OpenGraph image. OG metadata added to `app/layout.tsx`.
- Add people modal now shows mutual contacts by default, with a live debounced search overlay.
- Push notification click auto-marks all notifications as read via `?from=push` query param detected on the event detail page.

### Changed

- Notification panel rows are now clickable links navigating to the related event.
- Notification icons replaced with SVG icons in colored circles (no more emoji).
- Relative timestamps added to notification rows.
- Bet deadline cron notification copy: "the people need to know. resolve your bet."

## [0.1.2.0] - 2026-04-07

### Added

- Public profile now shows mutual context: "bets in common" (bets both you and the profile user placed non-anonymously) and "events & groups in common." A "mutual" badge appears on the header when any overlap exists.

### Changed

- Public profile no longer exposes individual bet history or tagged bets — only points, win rate, and mutual context are visible.
- Anonymous bet placement now returns a 500 error if the anonymity flag fails to persist, instead of silently succeeding.
- `/u/[username]` now requires authentication — unauthenticated visitors are redirected to login.

## [0.1.1.0] - 2026-04-07

### Fixed

- Tag picker search now works on mobile — typing a character correctly filters the guest list. The bug was `stopPropagation` on the input's `onChange` event interfering with React's synthetic event system on mobile browsers.
- Guests with no display name or username now remain visible in the picker even when you're searching — previously they'd disappear the moment you typed anything.
- Picking a guest from search results now correctly resets the search field.
- Dismissing the picker by tapping outside also clears the search field, so it starts fresh next time.
- Picker shows "no results" when your search doesn't match anyone, instead of showing a blank dropdown.
