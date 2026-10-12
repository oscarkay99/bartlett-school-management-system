// UI mirror of the permission model. Real enforcement must live on the server.
export type Resource = "students" | "parents" | "staff" | "inventory" | "expenses" | "grades" | "settings";
export type Op = "create" | "edit" | "delete" | "approve";
type Grants = "all" | Partial<Record<Resource, Op[]>>;

export interface RoleDef { label: string; person: string; nav: string[]; grants: Grants }
const ALL_NAV = ["dashboard", "students", "parents", "admissions", "fees", "finance", "inventory", "academics", "staff", "attendance", "comms", "reports", "settings"];

export const ROLES: Record<string, RoleDef> = {
  // The Owner has unrestricted read / create / edit / delete / approve across the whole system.
  owner: { label: "Owner", person: "Dr. Kwame Yeboah", nav: ALL_NAV, grants: "all" },
  admin: { label: "School Administrator", person: "Adwoa Asante", nav: ["dashboard", "students", "parents", "admissions", "academics", "attendance", "comms", "reports"], grants: { students: ["create", "edit"], parents: ["create", "edit"], grades: ["approve"] } },
  bursar: { label: "Accountant / Bursar", person: "Efua Quansah", nav: ["dashboard", "students", "parents", "fees", "finance", "comms", "reports"], grants: { expenses: ["create", "edit", "approve"], parents: ["edit"] } },
  storekeeper: { label: "Storekeeper", person: "Kojo Danso", nav: ["dashboard", "inventory", "reports"], grants: { inventory: ["create", "edit"] } },
  teacher: { label: "Teacher", person: "Samuel Owusu", nav: ["dashboard", "academics", "attendance", "students"], grants: {} },
  auditor: { label: "Auditor (read-only)", person: "Auditor", nav: ["dashboard", "fees", "finance", "inventory", "reports"], grants: {} },
};
export const DEFAULT_ROLE = "owner";
export const normalizeRole = (r: string | null) => (r && ROLES[r] ? r : DEFAULT_ROLE); // old saved roles (headmaster/proprietor) fall back to Owner

export function allowed(role: string, resource: Resource, op: Op): boolean {
  const g = ROLES[role]?.grants; if (!g) return false; if (g === "all") return true;
  return !!g[resource]?.includes(op);
}
