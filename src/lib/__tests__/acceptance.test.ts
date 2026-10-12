import { describe, expect, it } from "vitest";
import * as Q from "../data/queries";
import { ghs, money } from "../money";

describe("money", () => {
  it("formats GHS with integer minor units", () => { expect(money(ghs(1500))).toBe("GHS 1,500.00"); expect(ghs(0.1) + ghs(0.2)).toBe(30); });
});
describe("Workflow B — partial payment", () => {
  it("Ama Mensah: GHS 3,500 billed, 2,000 paid, 1,500 outstanding", () => {
    const ama = Q.students.find((s) => s.first === "Ama" && s.last === "Mensah")!;
    const f = Q.feeSummary(ama.id);
    expect([f.billed, f.paid, f.balance]).toEqual([ghs(3500), ghs(2000), ghs(1500)]);
    expect(f.status).toBe("Partially Paid");
  });
  it("pending and reversed payments are never counted as collected", () => {
    const confirmed = Q.payments.filter((p) => p.status === "Confirmed").reduce((a, p) => a + p.amount, 0);
    expect(Q.feesOverview().paid).toBeLessThanOrEqual(confirmed);
    expect(Q.unreconciled().length).toBeGreaterThan(0);
  });
});
describe("Workflow D — siblings", () => {
  it("one guardian, three children, one consolidated reminder", () => {
    const g = Q.guardians[0]; expect(Q.studentsOfGuardian(g.id)).toHaveLength(3);
    const row = Q.reminderRows().find((r) => r.guardian.id === g.id)!;
    const msg = Q.buildReminder(row);
    expect(row.lines).toHaveLength(3); expect(msg).toContain("Total Outstanding");
  });
  it("never includes students for guardians who are not financially responsible/verified", () => {
    for (const r of Q.reminderRows()) for (const l of r.lines) {
      const sg = l.student.guardians.find((x) => x.guardianId === r.guardian.id)!;
      expect(sg.financial && sg.verified && sg.receivesFeeReminders).toBe(true);
    }
  });
  it("no reminders for fully paid students", () => {
    for (const r of Q.reminderRows()) for (const l of r.lines) expect(l.balance).toBeGreaterThan(0);
  });
});
describe("Workflow E — inventory", () => {
  it("100 received, 20 issued → 80 on hand", () => { expect(Q.inventory.find((i) => i.name.startsWith("English Textbook"))!.onHand).toBe(80); });
  it("no negative stock anywhere", () => { for (const i of Q.inventory) expect(i.onHand).toBeGreaterThanOrEqual(0); });
});
describe("Workflow G — ledgers reconcile", () => {
  it("trial balance balances", () => { const tb = Q.trialBalance(); expect(tb.reduce((a, t) => a + t.dr, 0)).toBe(tb.reduce((a, t) => a + t.cr, 0)); });
  it("fee subledger equals GL fee receivables", () => { expect(Q.subledgerRecon().diff).toBe(0); });
});
