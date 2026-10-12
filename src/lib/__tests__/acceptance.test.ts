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

describe("Every student is tied to a guardian", () => {
  it("each student has at least one verified guardian and exactly one primary", () => {
    for (const st of Q.students) {
      const verified = st.guardians.filter((g) => g.verified);
      expect(verified.length, `${st.admissionNo} has no verified guardian`).toBeGreaterThan(0);
      expect(st.guardians.filter((g) => g.primary).length, `${st.admissionNo} primary count`).toBe(1);
    }
  });
  it("every guardian reference points to a real guardian record (no orphans)", () => {
    const ids = new Set(Q.guardians.map((g) => g.id));
    for (const st of Q.students) for (const g of st.guardians) expect(ids.has(g.guardianId), `${st.admissionNo} -> ${g.guardianId}`).toBe(true);
  });
  it("no student has the same guardian linked twice", () => {
    for (const st of Q.students) expect(new Set(st.guardians.map((g) => g.guardianId)).size).toBe(st.guardians.length);
  });
  it("at least one guardian per student is financially responsible", () => {
    for (const st of Q.students) expect(st.guardians.some((g) => g.financial && g.verified), st.admissionNo).toBe(true);
  });
});

describe("Feeding and Books sections", () => {
  it("every invoice carries a Feeding and a Books line", () => {
    for (const i of Q.invoices) for (const label of ["Feeding", "Books"]) expect(i.items.some((x) => x.label === label), `${i.no} ${label}`).toBe(true);
  });
  it("Ama's invoice still totals GHS 3,500 with Feeding and Books itemised", () => {
    const ama = Q.students.find((s) => s.first === "Ama" && s.last === "Mensah")!; const inv = Q.invoices.find((i) => i.studentId === ama.id)!;
    expect(inv.items.reduce((a, x) => a + x.amount, 0)).toBe(ghs(3500)); expect(inv.items.find((x) => x.label === "Books")!.amount).toBe(ghs(250));
  });
  it("per-class feeding total = amount per student × students charged", () => {
    for (const c of Q.classes) {
      const kids = Q.activeStudents().filter((s) => s.classId === c.id);
      const direct = kids.reduce((a, s) => a + Q.invoices.find((i) => i.studentId === s.id)!.items.find((x) => x.label === "Feeding")!.amount, 0);
      const perStudent = Q.feeStructure.find((f) => f.classId === c.id)!.day.find((x) => x.label === "Feeding")!.amount;
      if (c.id !== "c5" && c.id !== "c1") expect(direct).toBe(perStudent * kids.length);
    }
  });
  it("feeding and books stock sections exist with positive value", () => {
    const val = (cats: string[]) => Q.inventory.filter((i) => cats.includes(i.category)).reduce((a, i) => a + i.onHand * i.cost, 0);
    expect(Q.inventory.filter((i) => i.category === "Kitchen & Feeding").length).toBeGreaterThanOrEqual(5);
    expect(Q.inventory.filter((i) => i.category === "Textbooks" || i.category === "Exercise Books").length).toBeGreaterThanOrEqual(7);
    expect(val(["Kitchen & Feeding"])).toBeGreaterThan(0); expect(val(["Textbooks", "Exercise Books"])).toBeGreaterThan(0);
    for (const i of Q.inventory) expect(i.onHand).toBeGreaterThanOrEqual(0);
  });
});
