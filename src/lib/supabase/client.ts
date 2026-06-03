// ============================================
// FILE: lib/supabase/client.ts
// Supabase Client Configuration
// ============================================

import { createClient } from "@supabase/supabase-js";
import { Database } from "./types"; // Import from types.ts

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

/**
 * Browser client for client-side operations
 * Uses Row Level Security (RLS) policies
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      "x-application-name": "smart-clinic",
    },
  },
});

