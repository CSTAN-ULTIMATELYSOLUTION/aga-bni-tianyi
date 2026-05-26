import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseSchema = import.meta.env.VITE_SUPABASE_SCHEMA || "tianyi";

export const EVIDENCE_BUCKET = import.meta.env.VITE_EVIDENCE_BUCKET || "tianyi-onesystem-evidence";

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  db: {
    schema: supabaseSchema,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
