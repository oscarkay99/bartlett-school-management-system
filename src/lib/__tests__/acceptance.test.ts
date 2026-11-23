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

describe("Books stay in school fees; feeding is billed separately", () => {
  it("every school-fee invoice carries Books and no Feeding line", () => {
    for (const i of Q.invoices.filter((x) => x.account === "fees")) {
      expect(i.items.some((x) => x.label === "Books"), `${i.no} Books`).toBe(true);
      expect(i.items.some((x) => x.label === "Feeding"), `${i.no} Feeding`).toBe(false);
    }
  });
  it("Ama's school-fee invoice still totals GHS 3,500 with Books itemised", () => {
    const ama = Q.students.find((s) => s.first === "Ama" && s.last === "Mensah")!; const inv = Q.invoicesOf(ama.id, "fees")[0];
    expect(inv.items.reduce((a, x) => a + x.amount, 0)).toBe(ghs(3500)); expect(inv.items.find((x) => x.label === "Books")!.amount).toBe(ghs(250));
  });
  it("per-class feeding total = class rate × students on feeding", () => {
    for (const c of Q.classes) {
      const bills = Q.invoices.filter((i) => i.account === "feeding" && Q.getStudent(i.studentId)!.classId === c.id);
      const rate = Q.feeStructure.find((f) => f.classId === c.id)!.feeding;
      if (c.id !== "c5") expect(bills.reduce((a, i) => a + i.items[0].amount, 0)).toBe(rate * bills.length);
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

describe("Separate accounts: school fees, feeding, extracurricular", () => {
  const ama = () => Q.students.find((s) => s.first === "Ama" && s.last === "Mensah")!;
  it("each account has its own invoice and receipt numbering", () => {
    const prefix = { fees: ["INV-", "RCT-"], feeding: ["FDG-", "FRC-"], extra: ["EXC-", "XRC-"] } as const;
    for (const i of Q.invoices) expect(i.no.startsWith(prefix[i.account][0]), i.no).toBe(true);
    for (const p of Q.payments) expect(p.receiptNo.startsWith(prefix[p.account][1]), p.receiptNo).toBe(true);
    expect(new Set(Q.invoices.map((i) => i.no)).size).toBe(Q.invoices.length);
    expect(new Set(Q.payments.map((p) => p.receiptNo)).size).toBe(Q.payments.length);
    for (const acc of Q.ACCOUNT_IDS) expect(Q.payments.some((p) => p.account === acc), acc).toBe(true);
  });
  it("Ama: feeding GHS 600 (300 paid) and Music GHS 400 are separate from her GHS 1,500 school-fee balance", () => {
    const id = ama().id;
    expect(Q.feeSummary(id).balance).toBe(ghs(1500));
    const fd = Q.accountSummary(id, "feeding"); expect([fd.billed, fd.paid, fd.balance]).toEqual([ghs(600), ghs(300), ghs(300)]);
    const ex = Q.accountSummary(id, "extra"); expect([ex.billed, ex.paid, ex.balance]).toEqual([ghs(400), 0, ghs(400)]);
    expect(Q.totalOwed(id)).toBe(ghs(2200));
  });
  it("a payment only reduces the balance of its own account", () => {
    for (const s of Q.students) for (const acc of Q.ACCOUNT_IDS) {
      const f = Q.accountSummary(s.id, acc);
      const paid = Q.payments.filter((p) => p.studentId === s.id && p.account === acc && p.status === "Confirmed").reduce((a, p) => a + p.amount, 0);
      expect(f.paid).toBe(paid);
    }
  });
  it("extracurricular invoices only contain Music (Piano), STEM or Extra Classes; KG only Music", () => {
    for (const i of Q.invoices.filter((x) => x.account === "extra")) {
      const kg = Q.getClass(Q.getStudent(i.studentId)!.classId).level === "Kindergarten";
      for (const it of i.items) expect(kg ? ["Music (Piano)"] : ["Music (Piano)", "STEM", "Extra Classes"]).toContain(it.label);
    }
  });
  it("feeding reminders mention feeding, not school fees", () => {
    const row = Q.reminderRows({ account: "feeding" })[0];
    expect(Q.buildReminder(row, Q.SCHOOL, "feeding")).toMatch(/feeding/);
    for (const r of Q.reminderRows({ account: "feeding" })) for (const l of r.lines) expect(Q.accountSummary(l.student.id, "feeding").balance).toBe(l.balance);
  });
  it("GL posts feeding and extracurricular to their own income accounts and still reconciles", () => {
    const tb = Q.trialBalance();
    expect(tb.find((t) => t.account === "4200 Feeding Fees")!.cr).toBe(Q.invoices.filter((i) => i.account === "feeding").reduce((a, i) => a + i.items.reduce((x, y) => x + y.amount, 0), 0));
    expect(tb.some((t) => t.account === "4500 Extracurricular Fees")).toBe(true);
    expect(Q.subledgerRecon().diff).toBe(0);
  });
});
