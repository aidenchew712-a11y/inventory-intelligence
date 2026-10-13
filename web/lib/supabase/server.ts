import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";

export function configured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
export async function createClient() {
  // Session validation is request-specific and must never enter a shared prerender.
  await connection();
  if (!configured()) throw new Error("Workspace authentication is not configured.");
  const jar = await cookies();
  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(items) {
        try { items.forEach(({ name, value, options }) => jar.set(name, value, options)); }
        catch { /* Session refresh cookies are written by the request proxy. */ }
      },
    },
  });
}
