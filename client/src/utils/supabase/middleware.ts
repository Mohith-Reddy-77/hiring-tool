import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";

/**
 * Middleware helper (simplified): returns a supabase client for request-time usage.
 * This is intentionally lightweight to avoid Next.js-only runtime APIs.
 * If you need cookie synchronization in Next middleware, replace this
 * with the official `@supabase/ssr` helpers.
 */
export const createClient = (_request) => {
  return createSupabaseClient(supabaseUrl, supabaseKey);
};
