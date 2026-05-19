/**
 * Supabase clients are split to keep `next/headers` out of Client Components:
 *
 * - Browser / Client Components: `@/lib/supabase/client`
 * - Server Components / API routes: `@/lib/supabase/server`
 * - CI & rotation (bypass RLS): `@/lib/supabase-admin`
 */

export { createBrowserSupabaseClient } from "@/lib/supabase/client";
export { createServerSupabaseClient } from "@/lib/supabase/server";
