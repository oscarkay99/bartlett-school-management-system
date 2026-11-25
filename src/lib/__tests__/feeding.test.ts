import { describe, expect, it } from "vitest";
import { addPlan, applyFeeding, currentPlan, expectedByToday, feedingStatus, periodsElapsed, perPeriod, planStatus, schoolDays, termPeriods, validatePlan, readExceptions, recordMeals, setException, studentFeedingRate, validateException, type FeedingException } from "../feeding";
import { buildTermInvoices } from "../generated-invoices";
import { findTerm } from "../fees";
import * as Q from "../data/queries";
import { ghs } from "../money";

const ex = (p: Partial<FeedingException>): FeedingException => ({ studentId: "s1", term: "2026/2027|Term 2", onFeeding: false, reason: "Brings lunch", ...p });

describe("Feeding module", () => {
  it("everyone is on feeding at the class rate unless an exception says otherwise", () => {
    expect(studentFeedingRate(ghs(600), undefined)).toBe(ghs(600));
    expect(studentFeedingRate(ghs(600), ex({ onFeeding: true, rate: ghs(300) }))).toBe(ghs(300));
    expect(studentFeedingRate(ghs(600), ex({ onFeeding: false }))).toBe(0);
    expect([feedingStatus(undefined), feedingStatus(ex({ onFeeding: true, rate: 1 })), feedingStatus(ex({}))]).toEqual(["On feeding", "Different rate", "Not on feeding"]);
  });
  it("needs a reason, and an opted-out student cannot have a rate", () => {
    expect(validateException(ex({ reason: " " }))).toMatch(/reason/);
    expect(validateException(ex({ rate: 5 }))).toMatch(/cannot have a rate/);
    expect(validateException(ex({}))).toBe("");
    expect(readExceptions([ex({}), ex({ reason: "" }), null, "x"])).toHaveLength(1);
  });
  it("one exception per student per term; removing returns to the class rate", () => {
    let list = setException([], "s1", "T", ex({ term: "T" }));
    list = setException(list, "s1", "T", ex({ term: "T", onFeeding: true, rate: 10 }));
    expect(list).toHaveLength(1); expect(list[0].rate).toBe(10);
    expect(setException(list, "s1", "T", null)).toEqual([]);
  });
  it("meal register keeps one count per class per day", () => {
    const m = recordMeals(recordMeals([], "2026-10-01", { c1: 10, c2: 12 }), "2026-10-01", { c1: 11 });
    expect(m.filter((x) => x.date === "2026-10-01").map((x) => [x.classId, x.served]).sort()).toEqual([["c1", 11], ["c2", 12]]);
  });
  it("invoices follow it: opted-out students get no Feeding line; different rates are applied", () => {
    expect(applyFeeding([{ label: "Tuition", amount: 5 }, { label: "Feeding", amount: 600 }], 0)).toEqual([{ label: "Tuition", amount: 5 }]);
    const t2 = findTerm(Q.feeSchedule, "2026/2027", "Term 2")!; const classes = Q.classes.map((c) => ({ id: c.id, name: c.name, level: c.level }));
    const c3 = classes.find((c) => c.name === "Primary 3")!.id;
    const cand = (id: string) => ({ id, name: id, adm: id, classId: c3, scholarship: false });
    const [a, b, c] = buildTermInvoices([cand("a"), cand("b"), cand("c")], classes, t2, "2027-01-11", 0, (sid) => ({ a: undefined, b: 0, c: ghs(300) })[sid]);
    expect(a.items.find((i) => i.label === "Feeding")!.amount).toBe(ghs(600));
    expect(b.items.some((i) => i.label === "Feeding")).toBe(false);
    expect(c.items.find((i) => i.label === "Feeding")!.amount).toBe(ghs(300));
  });
  it("feeding payments: never more feeding paid than billed; paying in full pays feeding in full", () => {
    for (const st of Q.students) { const f = Q.feedingAccount(st.id); expect(f.paid, st.admissionNo).toBeLessThanOrEqual(f.billed); }
    // Families paying feeding WITH the school fees: settling the invoice settles feeding too.
    const withFees = (id: string) => Q.invoicesOf(id, "fees").some((i) => i.items.some((x) => x.label === "Feeding"));
    const fullPayers = Q.students.filter((s) => Q.feeSummary(s.id).balance === 0 && withFees(s.id));
    expect(fullPayers.length).toBeGreaterThan(0);
    for (const s of fullPayers) { const f = Q.feedingAccount(s.id); expect(f.paid, s.admissionNo).toBe(f.billed); }
  });
  it("some families pay feeding on its own, daily / weekly / monthly, on school days; it never touches school fees", () => {
    const own = Q.payments.filter((p) => p.feedingPeriod);
    expect(new Set(own.map((p) => p.feedingPeriod))).toEqual(new Set(["Daily", "Weekly", "Monthly"]));
    for (const p of own) { expect(p.account).toBe("fees"); expect(p.feeding).toBe(p.amount); }
    for (const p of own.filter((x) => x.feedingPeriod === "Daily")) expect([0, 6], p.receiptNo).not.toContain(new Date(p.date + "T00:00:00Z").getUTCDay());
    const ama = Q.students.find((s) => s.first === "Ama" && s.last === "Mensah")!;
    const fa = Q.feedingAccount(ama.id); expect([fa.billed, fa.paid, fa.balance, fa.separate]).toEqual([ghs(600), ghs(300), ghs(300), true]);
    expect(fa.payments[0].feedingPeriod).toBe("Monthly");
  });
  it("everyone is enrolled in extracurricular", () => {
    for (const s of Q.activeStudents()) expect(Q.invoicesOf(s.id, "extra").length, s.admissionNo).toBe(1);
  });
  describe("payment plans", () => {
    const t1 = { start: "2026-09-07", end: "2026-12-18" }; const today = "2026-10-12";
    it("Term 1 has 75 school days, 15 weeks and 4 months", () => {
      expect(schoolDays(t1.start, t1.end)).toBe(75);
      expect([termPeriods(t1, "Daily"), termPeriods(t1, "Weekly"), termPeriods(t1, "Monthly"), termPeriods(t1, "Term")]).toEqual([75, 15, 4, 1]);
    });
    it("GH₵ 600 a term is GH₵ 8 a school day, GH₵ 40 a week, GH₵ 150 a month", () => {
      expect([perPeriod(ghs(600), t1, "Daily"), perPeriod(ghs(600), t1, "Weekly"), perPeriod(ghs(600), t1, "Monthly")]).toEqual([ghs(8), ghs(40), ghs(150)]);
      expect(perPeriod(ghs(450), t1, "Weekly")).toBe(ghs(30));
    });
    it("expected by 12 Oct: daily 208, weekly 240, monthly 300, termly 600; with school fees only after the due date", () => {
      expect(periodsElapsed(t1, "Daily", today)).toBe(26);
      expect([expectedByToday(ghs(600), t1, "Daily", today), expectedByToday(ghs(600), t1, "Weekly", today), expectedByToday(ghs(600), t1, "Monthly", today), expectedByToday(ghs(600), t1, "Term", today)])
        .toEqual([ghs(208), ghs(240), ghs(300), ghs(600)]);
      expect(expectedByToday(ghs(600), t1, "With school fees", today, "2026-10-30")).toBe(0);
      expect(expectedByToday(ghs(600), t1, "With school fees", "2026-11-02", "2026-10-30")).toBe(ghs(600));
      expect(expectedByToday(ghs(600), t1, "Weekly", "2027-01-05")).toBe(ghs(600)); // never more than the term's feeding
    });
    it("status: behind, on track, paid in full", () => {
      expect(planStatus(ghs(600), ghs(100), ghs(240))).toEqual({ label: "Behind", behind: ghs(140) });
      expect(planStatus(ghs(600), ghs(240), ghs(240)).label).toBe("On track");
      expect(planStatus(ghs(600), ghs(600), ghs(240)).label).toBe("Paid in full");
      expect(planStatus(0, 0, 0).label).toBe("Not on feeding");
    });
    it("switching daily → weekly keeps the history; the plan in force depends on the date", () => {
      let plans = addPlan([], { studentId: "s", term: "T", frequency: "Daily", from: "2026-09-07" });
      plans = addPlan(plans, { studentId: "s", term: "T", frequency: "Weekly", from: "2026-10-12" });
      expect(currentPlan(plans, "s", "T", "2026-10-01")!.frequency).toBe("Daily");
      expect(currentPlan(plans, "s", "T", "2026-10-12")!.frequency).toBe("Weekly");
      expect(plans).toHaveLength(2);
      plans = addPlan(plans, { studentId: "s", term: "T", frequency: "Monthly", from: "2026-10-12" });   // same start day replaces
      expect(plans).toHaveLength(2); expect(currentPlan(plans, "s", "T", "2026-10-12")!.frequency).toBe("Monthly");
      expect(validatePlan({ studentId: "s", term: "T", frequency: "Weekly", from: "2027-02-01" }, t1)).toMatch(/within the term/);
    });
    it("demo: every family paying feeding separately has the matching plan; Ama (monthly, paid 300) is on track", () => {
      for (const p of Q.payments.filter((x) => x.feedingPeriod)) expect(currentPlan(Q.feedingPlans, p.studentId, "2026/2027|Term 1", p.date)?.frequency, p.receiptNo).toBe(p.feedingPeriod);
      const ama = Q.students.find((x) => x.first === "Ama" && x.last === "Mensah")!;
      const plan = currentPlan(Q.feedingPlans, ama.id, "2026/2027|Term 1", Q.TODAY)!; expect(plan.frequency).toBe("Monthly");
      const fa = Q.feedingAccount(ama.id);
      expect(planStatus(fa.billed, fa.paid, expectedByToday(fa.billed, t1, plan.frequency, Q.TODAY)).label).toBe("On track");
    });
  });
  describe("feeding paid small small is not part of school fees", () => {
    const planPayers = Q.activeStudents().filter((s) => Q.feedingPlans.some((p) => p.studentId === s.id && p.frequency !== "With school fees"));
    it("plan families have no Feeding line on their school fees invoice; everyone else does", () => {
      expect(planPayers.length).toBeGreaterThanOrEqual(3);
      for (const s of Q.activeStudents()) {
        const hasLine = Q.invoicesOf(s.id, "fees").some((i) => i.items.some((x) => x.label === "Feeding"));
        expect(hasLine, s.admissionNo).toBe(!planPayers.includes(s));
      }
    });
    it("feeding plan payments never count towards school fees", () => {
      for (const s of planPayers) {
        const feesPaid = Q.payments.filter((p) => p.studentId === s.id && p.account === "fees" && !p.feedingPeriod && p.status === "Confirmed").reduce((a, p) => a + p.amount, 0);
        expect(Q.feeSummary(s.id).paid, s.admissionNo).toBe(feesPaid);
      }
    });
    it("school fees paid in full shows Paid in full, even when feeding is not fully paid", () => {
      const cases = planPayers.filter((s) => Q.feeSummary(s.id).balance <= 0 && Q.feedingAccount(s.id).balance > 0);
      expect(cases.length).toBeGreaterThan(0);
      for (const s of cases) expect(Q.feeSummary(s.id).status, s.admissionNo).toBe("Paid in Full");
    });
    it("plan families' feeding is billed at the class rate and tracked separately", () => {
      for (const s of planPayers) { const f = Q.feedingAccount(s.id); expect(f.separate).toBe(true); expect(f.billed, s.admissionNo).toBe(Q.feeStructure.find((x) => x.classId === s.classId)!.feeding); }
    });
  });
});
