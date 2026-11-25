import { describe, expect, it } from "vitest";
import * as Q from "../data/queries";
import { ghs, money, moneyShort } from "../money";

describe("money", () => {
  it("formats amounts with the cedi sign and integer minor units", () => { expect(money(ghs(1500))).toBe("GH₵ 1,500.00"); /* full values on dashboards, never "k" */ expect(moneyShort(ghs(384780))).toBe("GH₵ 384,780.00"); expect(money(-ghs(5))).toBe("-GH₵ 5.00"); expect(ghs(0.1) + ghs(0.2)).toBe(30); });
});
describe("Workflow B — partial payment", () => {
  it("Ama Mensah: school fees GH₵ 3,100 billed (feeding paid monthly, not on the invoice), 2,000 paid, 1,100 outstanding", () => {
    const ama = Q.students.find((s) => s.first === "Ama" && s.last === "Mensah")!;
    const f = Q.feeSummary(ama.id);
    expect([f.billed, f.paid, f.balance]).toEqual([ghs(3100), ghs(2000), ghs(1100)]);
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

// What the client asked for: parents get the school fees invoice (with feeding on it); Extra Classes is a standalone invoice.
describe("School fees invoice: books and feeding on one invoice", () => {
  it("every school-fee invoice carries Books; Feeding only when the family pays feeding with the school fees", () => {
    for (const i of Q.invoices.filter((x) => x.account === "fees")) {
      expect(i.items.some((x) => x.label === "Books"), `${i.no} Books`).toBe(true);
      const onPlan = Q.feedingPlans.some((p) => p.studentId === i.studentId && p.frequency !== "With school fees");
      expect(i.items.some((x) => x.label === "Feeding"), `${i.no} Feeding`).toBe(!onPlan);
    }
  });
  it("there is no Examination fee on any invoice", () => {
    for (const i of Q.invoices) expect(i.items.some((x) => x.label === "Examination"), i.no).toBe(false);
  });
  it("the ICT & Development Levy is not charged yet", () => {
    for (const i of Q.invoices) expect(i.items.some((x) => x.label === "ICT & Development Levy" && x.amount > 0), i.no).toBe(false);
  });
  it("Ama's school-fee invoice totals GH₵ 3,100: Books itemised, no Feeding (paid monthly), no Examination", () => {
    const ama = Q.students.find((s) => s.first === "Ama" && s.last === "Mensah")!; const inv = Q.invoicesOf(ama.id, "fees")[0];
    expect(inv.items.reduce((a, x) => a + x.amount, 0)).toBe(ghs(3100)); expect(inv.items.some((x) => x.label === "Examination")).toBe(false); expect(inv.items.find((x) => x.label === "Books")!.amount).toBe(ghs(250));
    expect(inv.items.some((x) => x.label === "Feeding")).toBe(false);
  });
  it("feeding on each invoice = the class's feeding rate", () => {
    for (const i of Q.invoices.filter((x) => x.account === "fees")) {
      const s = Q.getStudent(i.studentId)!;
      if (!i.items.some((x) => x.label === "Feeding")) continue;   // pays feeding separately (on a plan)
      expect(i.items.find((x) => x.label === "Feeding")!.amount, i.no).toBe(Q.feeStructure.find((f) => f.classId === s.classId)!.feeding);
    }
  });
  it("feeding and books stock sections exist with positive value", () => {
    const val = (cats: string[]) => Q.inventory.filter((i) => cats.includes(i.category)).reduce((a, i) => a + i.onHand * i.cost, 0);
    expect(Q.inventory.filter((i) => i.category === "Kitchen & Feeding").length).toBeGreaterThanOrEqual(3);
    expect(Q.inventory.filter((i) => i.category === "Textbooks" || i.category === "Exercise Books").length).toBeGreaterThanOrEqual(3);
    expect(val(["Kitchen & Feeding"])).toBeGreaterThan(0); expect(val(["Textbooks", "Exercise Books"])).toBeGreaterThan(0);
    for (const i of Q.inventory) expect(i.onHand).toBeGreaterThanOrEqual(0);
  });
});

describe("Two accounts: school fees and standalone Extra Classes", () => {
  const ama = () => Q.students.find((s) => s.first === "Ama" && s.last === "Mensah")!;
  it("only school fees and Extra Classes exist; each has its own invoice and receipt numbering", () => {
    expect(Q.ACCOUNT_IDS).toEqual(["fees", "extra"]);
    const prefix = { fees: ["INV-", "RCT-"], extra: ["EXC-", "XRC-"] } as const;
    for (const i of Q.invoices) expect(i.no.startsWith(prefix[i.account][0]), i.no).toBe(true);
    for (const p of Q.payments) expect(p.receiptNo.startsWith(prefix[p.account][1]), p.receiptNo).toBe(true);
    expect(new Set(Q.invoices.map((i) => i.no)).size).toBe(Q.invoices.length);
    expect(new Set(Q.payments.map((p) => p.receiptNo)).size).toBe(Q.payments.length);
    for (const acc of Q.ACCOUNT_IDS) expect(Q.payments.some((p) => p.account === acc), acc).toBe(true);
  });
  it("Ama: Music + Extra Classes (GH₵ 750) are separate from her GH₵ 1,100 school-fee balance", () => {
    const id = ama().id;
    expect(Q.feeSummary(id).balance).toBe(ghs(1100));
    const ex = Q.accountSummary(id, "extra"); expect([ex.billed, ex.paid, ex.balance]).toEqual([ghs(750), 0, ghs(750)]);
    expect(Q.totalOwed(id)).toBe(ghs(1100)); // school fees only: Extra Classes is never added
  });
  it("a payment only reduces the balance of its own account", () => {
    for (const s of Q.students) for (const acc of Q.ACCOUNT_IDS) {
      const f = Q.accountSummary(s.id, acc);
      const paid = Q.payments.filter((p) => p.studentId === s.id && p.account === acc && p.status === "Confirmed" && !Q.isFeedingPlanPayment(p)).reduce((a, p) => a + p.amount, 0);
      expect(f.paid).toBe(paid);
    }
  });
  it("everyone has an Extra Classes invoice: KG Music only, everyone else Music and Extra Classes", () => {
    for (const i of Q.invoices.filter((x) => x.account === "extra")) {
      const kg = Q.getClass(Q.getStudent(i.studentId)!.classId).level === "Kindergarten";
      expect(i.items.map((x) => x.label), i.no).toEqual(kg ? ["Music (Piano)"] : ["Music (Piano)", "Extra Classes"]);
    }
  });
  it("Extra Classes reminders mention extra classes, not school fees", () => {
    const row = Q.reminderRows({ account: "extra" })[0];
    expect(Q.buildReminder(row, Q.SCHOOL, "extra")).toMatch(/extra classes/);
  });
  it("GL still posts feeding income to its own account (from the school fees invoice) and reconciles", () => {
    const tb = Q.trialBalance();
    const feeding = Q.invoices.filter((i) => i.account === "fees").reduce((a, i) => a + (i.items.find((x) => x.label === "Feeding")?.amount ?? 0), 0)
      + Q.payments.filter((p) => Q.isFeedingPlanPayment(p) && p.status === "Confirmed").reduce((a, p) => a + p.amount, 0);   // feeding paid small small goes straight to feeding income
    expect(feeding).toBeGreaterThan(0); expect(tb.find((t) => t.account === "4200 Feeding Fees")!.cr).toBe(feeding);
    expect(tb.some((t) => t.account === "4500 Extra Classes Fees")).toBe(true);
    expect(Q.subledgerRecon().diff).toBe(0);
  });
});

describe("Fee statuses", () => {
  it("only Paid in Full, Partially Paid and Outstanding (no Overdue or Credit Balance)", () => {
    const seen = new Set(Q.students.flatMap((s) => Q.ACCOUNT_IDS.map((a) => Q.accountSummary(s.id, a).status)));
    for (const st of seen) expect(["Paid in Full", "Partially Paid", "Outstanding"]).toContain(st);
  });
});
