import Link from "next/link";
/** Shown when a record does not exist, or the signed-in role is not allowed to see it. */
export function NotFound() {
  return <div className="mx-auto max-w-md rounded-xl border border-line bg-surface p-8 text-center"><h2 className="text-lg font-semibold">Not found</h2>
    <p className="mt-1 text-sm text-muted">This record does not exist, or your role is not allowed to see it.</p><Link href="/" className="mt-4 inline-block text-sm font-medium text-info hover:underline">Back to the dashboard</Link></div>;
}
