"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador. Usa la clave publica (anon) y
 * respeta las politicas de Row Level Security definidas en supabase/schema.sql.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
