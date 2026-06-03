// ============================================
// FILE: lib/supabase/server.ts
// Server-side Supabase Client (for API routes)
// ============================================

import "server-only"; // Enforce server-only boundary
import { createClient as createServerClient } from "@supabase/supabase-js";
import { Database } from "./types"; // Import from types.ts

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase server environment variables");
}

/**
 * Server client with elevated privileges
 * ONLY use in API routes - never expose to client
 */
export const supabaseAdmin = createServerClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
