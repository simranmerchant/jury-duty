@AGENTS.md

## Rules

- NEVER read `.env.local` under any circumstances.
- NEVER claim "all tests pass" when output shows failures.
- Keep text between tool calls to <= 25 words.
- When adding a new feature, always add test cases for it. Extract pure logic into `lib/` helpers so it can be tested without mocking Next.js or Supabase. Run `bun test` and confirm all tests pass before finishing.
