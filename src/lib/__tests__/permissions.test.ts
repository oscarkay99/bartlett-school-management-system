import { describe, expect, it } from "vitest";
import { ROLES, allowed, normalizeRole, type Op, type Resource } from "../permissions";

const RESOURCES: Resource[] = ["students", "parents", "staff", "inventory", "expenses", "grades", "settings"];
const OPS: Op[] = ["create", "edit", "delete", "approve"];

describe("Owner role", () => {
  it("is named Owner and replaces Headmaster/Proprietor", () => {
    expect(ROLES.owner.label).toBe("Owner"); expect(ROLES.headmaster).toBeUndefined(); expect(ROLES.proprietor).toBeUndefined();
  });
  it("can create, edit, delete and approve on every resource", () => {
    for (const r of RESOURCES) for (const o of OPS) expect(allowed("owner", r, o), `${r}.${o}`).toBe(true);
  });
  it("sees every module", () => { expect(ROLES.owner.nav).toHaveLength(13); });
  it("old saved roles fall back to Owner instead of breaking", () => {
    expect(normalizeRole("headmaster")).toBe("owner"); expect(normalizeRole("proprietor")).toBe("owner"); expect(normalizeRole(null)).toBe("owner"); expect(normalizeRole("bursar")).toBe("bursar");
  });
});
describe("Other roles are restricted", () => {
  it("only the Owner can delete anything", () => {
    for (const [k] of Object.entries(ROLES)) if (k !== "owner") for (const r of RESOURCES) expect(allowed(k, r, "delete"), `${k} ${r}`).toBe(false);
  });
  it("auditors and teachers cannot create or edit records", () => {
    for (const k of ["auditor", "teacher"]) for (const r of RESOURCES) { expect(allowed(k, r, "create")).toBe(false); expect(allowed(k, r, "edit")).toBe(false); }
  });
});
