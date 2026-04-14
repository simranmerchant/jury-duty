# jury duty (web)

Next.js PWA for jurydutygame.com. Social betting on real-world events with friends.

## Stack

- **Framework:** Next.js (App Router)
- **Auth:** Privy
- **Database:** Supabase (Postgres)
- **Styling:** Tailwind CSS + CSS variables
- **Deploy:** Vercel
- **Push:** Web Push API (VAPID) via `web-push` npm package

## Key features

- Create betting events, invite guests, place bets
- Anonymous bet placement option
- Public profiles with mutual context (shared events, bets in common)
- In-app notification panel with SVG icons, relative timestamps, and unread badge
- Web Push notifications (bet created, resolved, deadline overdue)
- PWA install prompt — two-step: install → push enable
- Automatic mark-as-read when opening app from a push notification

## Web Push setup

Two env vars required in Vercel:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your public key>
VAPID_PRIVATE_KEY=<your private key>
```

Generate with: `npx web-push generate-vapid-keys`

The service worker lives at `public/sw.js`. Push subscriptions are stored in the `web_push_subscriptions` Supabase table (migration `017`).

## Dev

```bash
bun dev
```

## Database migrations

```bash
npx supabase db push --linked
```

## Testing

```bash
bun test
```

Always run tests before finishing any feature.
