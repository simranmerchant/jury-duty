# Changelog

All notable changes to this project will be documented in this file.

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
