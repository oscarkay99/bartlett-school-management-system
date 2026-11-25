// UI mirror of the permission model. Real enforcement must live on the server.
export type Resource = "students" | "parents" | "staff" | "inventory" | "expenses" | "grades" | "settings" | "payments" | "invoices";
export type Op = "create" | "edit" | "delete" | "approve";
type Grants = "all" | Partial<Record<Resource, Op[]>>;

/**
 * How much money a role may see.
 * - full:     collections, revenue, dashboards, ledgers, finance.
 * - balances: only who owes what (outstanding lists + reminders) so parents can be followed up — no collections or revenue.
 * - none:     no fee information at all.
 */
export type MoneyAccess = "full" | "balances" | "none";

export interface RoleDef { label: string; person: string; nav: string[]; grants: Grants; money: MoneyAccess }
const ALL_NAV = ["dashboard", "students", "parents", "admissions", "fees", "feeding", "extracurricular", "extra-classes", "invoices", "finance", "inventory", "academics", "staff", "attendance", "comms", "reports", "settings"];
const BILLING_NAV = ["fees", "feeding", "extracurricular", "extra-classes"];

export const ROLES: Record<string, RoleDef> = {
  // The Owner has unrestricted read / create / edit / delete / approve across the whole system.
  owner: { label: "Owner", person: "Dr. Kwame Yeboah", nav: ALL_NAV, grants: "all", money: "full" },
  // Administrator: students, parents, admissions, academics and parent follow-up on balances. No view of money coming in.
  admin: { label: "School Administrator", person: "Adwoa Asante", nav: ["dashboard", "students", "parents", "admissions", ...BILLING_NAV, "academics", "attendance", "comms", "reports"], grants: { students: ["create", "edit"], parents: ["create", "edit"], grades: ["approve"] }, money: "balances" },
  // Accountant: records payments, issues invoices and receipts for school fees, feeding, extracurricular and extra classes.
  bursar: { label: "Accountant / Bursar", person: "Efua Quansah", nav: ["dashboard", "students", "parents", ...BILLING_NAV, "invoices", "finance", "comms", "reports"], grants: { payments: ["create"], invoices: ["create"], expenses: ["create", "edit", "approve"], parents: ["edit"] }, money: "full" },
  storekeeper: { label: "Storekeeper", person: "Kojo Danso", nav: ["dashboard", "feeding", "inventory", "reports"], grants: { inventory: ["create", "edit"] }, money: "none" },
  teacher: { label: "Teacher", person: "Samuel Owusu", nav: ["dashboard", "academics", "attendance", "students"], grants: {}, money: "none" },
  auditor: { label: "Auditor (read-only)", person: "Auditor", nav: ["dashboard", ...BILLING_NAV, "finance", "inventory", "reports"], grants: {}, money: "full" },
};
export const DEFAULT_ROLE = "owner";
export const normalizeRole = (r: string | null) => (r && ROLES[r] ? r : DEFAULT_ROLE); // old saved roles (headmaster/proprietor) fall back to Owner

export function allowed(role: string, resource: Resource, op: Op): boolean {
  const g = ROLES[role]?.grants; if (!g) return false; if (g === "all") return true;
  return !!g[resource]?.includes(op);
}
export const moneyAccess = (role: string): MoneyAccess => ROLES[role]?.money ?? "none";

// Which nav key guards a path. Print pages and unknown paths are not guarded here.
const ROUTE_KEYS: [string, string][] = [
  ["/students", "students"], ["/parents", "parents"], ["/admissions", "admissions"], ["/fees", "fees"], ["/feeding", "feeding"], ["/extracurricular", "extracurricular"], ["/extra-classes", "extra-classes"], ["/invoices", "invoices"],
  ["/finance", "finance"], ["/inventory", "inventory"], ["/academics", "academics"], ["/staff", "staff"], ["/attendance", "attendance"], ["/communications", "comms"], ["/reports", "reports"], ["/settings", "settings"],
];
export function routeKey(path: string): string | null {
  if (path === "/") return "dashboard";
  return ROUTE_KEYS.find(([p]) => path === p || path.startsWith(p + "/"))?.[1] ?? null;
}
export const canVisit = (role: string, path: string) => { const k = routeKey(path); return k === null || !!ROLES[role]?.nav.includes(k); };
