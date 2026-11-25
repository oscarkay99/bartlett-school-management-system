// Connection to the live school database (self-hosted Supabase on the VPS). The site talks to it when built with
// NEXT_PUBLIC_DATA_MODE=live; otherwise it runs on the built-in demo data. Keys and test logins come from build-time
// settings (GitHub repository secrets / a local .env.local), never from the repository.
export const LIVE = process.env.NEXT_PUBLIC_DATA_MODE === "live";
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://school-api.51-170-137-199.sslip.io";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export interface QaLogin { role: string; email: string; password: string }
/**
 * QA ONLY: one sign-in per role so testers can tap a role on the sign-in page. Supplied as JSON in
 * NEXT_PUBLIC_QA_LOGINS at build time. Whatever is supplied ships in the website, so anyone could use it:
 * before real school data goes in, remove that setting (the buttons disappear), run
 * `sudo python3 role_logins.py --remove` on the server, and create real staff logins.
 */
export const QA_LOGINS: QaLogin[] = (() => {
  try {
    const v = JSON.parse(process.env.NEXT_PUBLIC_QA_LOGINS ?? "null");
    if (Array.isArray(v)) return v.filter((x) => x && typeof x.role === "string" && typeof x.email === "string" && typeof x.password === "string");
    if (v && typeof v === "object") return Object.entries(v as Record<string, { email: string; password: string }>).map(([role, x]) => ({ role, email: x.email, password: x.password }));
  } catch {}
  return [];
})();
