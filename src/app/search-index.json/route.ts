import { buildSearchIndex } from "@/lib/search-index";

// Emitted once as a static file; the client fetches it the first time search is opened.
export const dynamic = "force-static";
export function GET() { return Response.json(buildSearchIndex()); }
