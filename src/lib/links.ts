// Links to a single record. The demo site has a pre-built page per demo record (/students/s1); the live site's records
// come from the database, so they open one page that reads the id from the URL (/students/view?id=…).
import { LIVE } from "./live/config";

const recordHref = (base: string, id: string, query = "") =>
  LIVE ? `${base}/view?id=${encodeURIComponent(id)}${query ? `&${query}` : ""}` : `${base}/${id}${query ? `?${query}` : ""}`;
export const studentHref = (id: string, tab?: string) => recordHref("/students", id, tab ? `tab=${tab}` : "");
export const parentHref = (id: string) => recordHref("/parents", id);
export const printHref = (kind: "receipt" | "invoice" | "statement" | "report-card", id: string) => recordHref(`/print/${kind}`, id);
