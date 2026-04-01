import { createClient } from "@supabase/supabase-js";

// Service role client — bypasses RLS, only used server-side.
// Auth is enforced by verifying the Privy JWT before every mutation.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
