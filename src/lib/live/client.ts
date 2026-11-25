"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;
/** The browser's connection to the school database. Every request carries the signed-in user's token, so the
 *  database's row-level security decides what each role can read or change. */
export function db(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "bartlett-school-auth" } });
  return client;
}

/** Turns a database error into a sentence a school user can act on. */
export function friendlyError(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return "";
  if (e.code === "42501" || /permission denied|row-level security/i.test(e.message ?? "")) return "Your role is not allowed to do this.";
  if (e.code === "23505") return "That already exists (duplicate).";
  if (/Failed to fetch|NetworkError/i.test(e.message ?? "")) return "Can't reach the school database. Check the internet connection and try again.";
  return e.message ?? "Something went wrong.";
}
