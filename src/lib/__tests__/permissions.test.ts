import { describe, expect, it } from "vitest";
import { ROLES, allowed, canVisit, moneyAccess, normalizeRole, type Op, type Resource } from "../permissions";

const RESOURCES: Resource[] = ["students", "parents", "staff", "inventory", "expenses", "grades", "settings", "payments", "invoices"];
const OPS: Op[] = ["create", "edit", "delete", "approve"];

describe("Owner role", () => {
  it("is named Owner and replaces Headmaster/Proprietor", () => {
    expect(ROLES.owner.label).toBe("Owner"); expect(ROLES.headmaster).toBeUndefined(); expect(ROLES.proprietor).toBeUndefined();
  });
  it("can create, edit, delete and approve on every resource", () => {
    for (const r of RESOURCES) for (const o of OPS) expect(allowed("owner", r, o), `${r}.${o}`).toBe(true);
  });
  it("sees every module, including Invoices and Extra Classes", () => { expect(ROLES.owner.nav).toHaveLength(16); expect(ROLES.owner.nav).toEqual(expect.arrayContaining(["invoices", "extra-classes"])); });
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

describe("Administrator: follows up on balances but never sees money coming in", () => {
  it("has balances-only money access", () => { expect(moneyAccess("admin")).toBe("balances"); });
  it("can open the billing modules (outstanding + reminders) and parents, but not finance", () => {
    for (const p of ["/fees", "/extra-classes", "/parents", "/students/s1"]) expect(canVisit("admin", p), p).toBe(true);
    expect(canVisit("admin", "/finance")).toBe(false); expect(canVisit("admin", "/settings")).toBe(false);
  });
  it("cannot record payments or issue invoices", () => { expect(allowed("admin", "payments", "create")).toBe(false); expect(allowed("admin", "invoices", "create")).toBe(false); });
});
describe("Accountant", () => {
  it("has School Fees and Extra Classes, and full money access", () => {
    expect(ROLES.bursar.nav).toEqual(expect.arrayContaining(["fees", "extra-classes", "invoices"])); expect(moneyAccess("bursar")).toBe("full");
  });
  it("can record payments and issue invoices/receipts", () => { expect(allowed("bursar", "payments", "create")).toBe(true); expect(allowed("bursar", "invoices", "create")).toBe(true); });
});
describe("Route guard", () => {
  it("blocks pages outside a role's modules", () => {
    expect(canVisit("teacher", "/fees")).toBe(false); expect(canVisit("storekeeper", "/students")).toBe(false); expect(canVisit("auditor", "/extra-classes")).toBe(true); expect(ROLES.storekeeper.nav).toContain("feeding"); expect(canVisit("teacher", "/feeding")).toBe(false);
  });
  it("auditor sees money but cannot record payments", () => { expect(moneyAccess("auditor")).toBe("full"); expect(allowed("auditor", "payments", "create")).toBe(false); });
  it("teachers and storekeeper see no fee information", () => { expect(moneyAccess("teacher")).toBe("none"); expect(moneyAccess("storekeeper")).toBe("none"); });
});
