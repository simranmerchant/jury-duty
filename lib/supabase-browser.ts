import { createClient } from "@supabase/supabase-js";

// Browser-side client — uses anon key, subject to RLS.
// Only used for client-side Supabase Auth (phone OTP sign-in).
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
