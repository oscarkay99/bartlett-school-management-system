import { describe, expect, it } from "vitest";
import { applyFeeding, feedingStatus, readExceptions, recordMeals, setException, studentFeedingRate, validateException, type FeedingException } from "../feeding";
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
    const fullPayers = Q.students.filter((s) => Q.feeSummary(s.id).balance === 0);
    expect(fullPayers.length).toBeGreaterThan(0);
    for (const s of fullPayers) { const f = Q.feedingAccount(s.id); expect(f.paid, s.admissionNo).toBe(f.billed); }
  });
  it("some families pay feeding on its own, daily / weekly / monthly, on school days; it reduces the school fees balance", () => {
    const own = Q.payments.filter((p) => p.feedingPeriod);
    expect(new Set(own.map((p) => p.feedingPeriod))).toEqual(new Set(["Daily", "Weekly", "Monthly"]));
    for (const p of own) { expect(p.account).toBe("fees"); expect(p.feeding).toBe(p.amount); }
    for (const p of own.filter((x) => x.feedingPeriod === "Daily")) expect([0, 6], p.receiptNo).not.toContain(new Date(p.date + "T00:00:00Z").getUTCDay());
    const ama = Q.students.find((s) => s.first === "Ama" && s.last === "Mensah")!;
    const fa = Q.feedingAccount(ama.id); expect([fa.billed, fa.paid, fa.balance]).toEqual([ghs(600), ghs(300), ghs(300)]);
    expect(fa.payments[0].feedingPeriod).toBe("Monthly");
  });
  it("everyone is enrolled in extra classes", () => {
    for (const s of Q.activeStudents()) expect(Q.invoicesOf(s.id, "extra").length, s.admissionNo).toBe(1);
  });
});
