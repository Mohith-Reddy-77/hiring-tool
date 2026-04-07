import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";

/**
 * Server helper: returns a Supabase client.
 * Note: original Next.js cookie-aware helpers were removed to avoid
 * Next-specific imports in this Vite project. If you migrate to Next,
 * replace this with `@supabase/ssr` or the official auth helpers.
 */
export const createClient = (_cookieStore) => {
  return createSupabaseClient(supabaseUrl, supabaseKey);
};
