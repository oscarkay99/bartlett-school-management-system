import { describe, expect, it } from "vitest";
import { blankTerm, classFees, copyTerm, termBillLines, fromGrid, toGrid, validateGrid, feedingRate, findTerm, invoiceStem, mergeSchedule, previousTermWithFees, sumItems, termKey, validateTermFees, type ClassRef } from "../fees";
import { ghs } from "../money";
import * as Q from "../data/queries";
import { buildTermInvoices, generatedTotal, readGenerated } from "../generated-invoices";

const classes: ClassRef[] = Q.classes.map((c) => ({ id: c.id, name: c.name, level: c.level }));
const cls = (name: string) => classes.find((c) => c.name === name)!;
const t1 = findTerm(Q.feeSchedule, "2026/2027", "Term 1")!;
const t2 = findTerm(Q.feeSchedule, "2026/2027", "Term 2")!;
const order = Q.SCHOOL.calendar.flatMap((y) => y.terms.map((t) => ({ year: y.name, term: t.name, start: t.start }))).sort((a, b) => a.start.localeCompare(b.start));

describe("Fee schedule — what a class pays in a term", () => {
  it("feeding goes on the school fees invoice, after the fee lines; the ICT levy is a 0 placeholder", () => {
    const lines = termBillLines(t1, cls("Primary 3"));
    expect(lines.map((l) => l.label)).toEqual(["Tuition", "Books", "PTA", "Feeding"]);
    expect(sumItems(lines)).toBe(ghs(3300));
    expect(t1.levels.Primary.items.find((i) => i.label === "ICT & Development Levy")!.amount).toBe(0);
  });
  it("every seeded term is valid", () => { for (const tf of Q.feeSchedule) expect(validateTermFees(tf, classes), termKey(tf.year, tf.term)).toBe(""); });
  it("fees differ by level: KG 2,000 · Primary 2,700 · JHS 3,400 for a day student in Term 1 (before feeding)", () => {
    expect(sumItems(classFees(t1, cls("KG 1")))).toBe(ghs(2000));
    expect(sumItems(classFees(t1, cls("Primary 3")))).toBe(ghs(2700));
    expect(sumItems(classFees(t1, cls("JHS 2")))).toBe(ghs(3400));
  });
  it("there is no boarding: no Boarding line on any invoice or in the schedule", () => {
    for (const c of classes) expect(termBillLines(t1, c).some((i) => i.label === "Boarding"), c.name).toBe(false);
    expect(Q.invoices.some((i) => i.items.some((x) => x.label === "Boarding"))).toBe(false);
    expect(Object.values(t1.levels).some((l) => "boarding" in l)).toBe(false);
  });
  it("the same class can pay different amounts in different terms", () => {
    expect(sumItems(classFees(t2, cls("Primary 3")))).toBe(ghs(2450)); // no books in Term 2
    expect(classFees(t2, cls("Primary 3")).some((i) => i.label === "Books")).toBe(false);
    expect(feedingRate(t2, cls("KG 2"))).toBe(ghs(450));
  });
  it("class adjustments replace a level line or add one for that class only", () => {
    expect(classFees(t2, cls("JHS 3")).find((i) => i.label === "BECE Registration")!.amount).toBe(ghs(320));
    expect(classFees(t2, cls("JHS 2")).some((i) => i.label === "BECE Registration")).toBe(false);
    const tf = { ...t1, overrides: { [cls("JHS 3").id]: [{ label: "Examination", amount: ghs(350) }, { label: "PTA", amount: 0 }] } };
    const j3 = classFees(tf, cls("JHS 3"));
    expect(j3.find((i) => i.label === "Examination")!.amount).toBe(ghs(350)); expect(j3.some((i) => i.label === "PTA")).toBe(false);
    expect(j3.map((i) => i.label)).toEqual(["Tuition", "Books", "Examination"]); // order kept; uncharged ICT levy and removed PTA left out
  });
  // Except Ama Mensah: her demo invoice is hand-set to exactly GHS 3,500 (see seed.ts and the acceptance tests).
  it("seeded Term 1 invoices match the schedule for every student", () => {
    const ama = Q.students.find((s) => s.first === "Ama" && s.last === "Mensah")!.id;
    for (const i of Q.invoices.filter((x) => x.account === "fees" && x.studentId !== ama)) {
      const s = Q.getStudent(i.studentId)!; const tf = findTerm(Q.feeSchedule, i.year, i.term)!;
      const onPlan = Q.feedingPlans.some((p) => p.studentId === s.id && p.frequency !== "With school fees");
      expect(i.items, i.no).toEqual(termBillLines(tf, cls(Q.getClass(s.classId).name)).filter((x) => !(onPlan && x.label === "Feeding")));
    }
  });
});

describe("Fee schedule — setting up a new term", () => {
  it("Term 3 2026/2027 has no fees yet; 'copy from' offers Term 2", () => {
    expect(findTerm(Q.feeSchedule, "2026/2027", "Term 3")).toBeUndefined();
    const prev = previousTermWithFees(Q.feeSchedule, order, "2026/2027", "Term 3")!;
    expect(termKey(prev.year, prev.term)).toBe("2026/2027|Term 2");
    const copy = copyTerm(prev, "2026/2027", "Term 3");
    expect(copy.term).toBe("Term 3"); expect(validateTermFees(copy, classes)).toBe("");
    copy.levels.Primary.items[0].amount = 1; expect(prev.levels.Primary.items[0].amount).toBe(ghs(2400)); // deep copy
  });
  it("a blank term must have amounts before it can be saved", () => {
    const b = blankTerm("2026/2027", "Term 3", ["Extra Classes"]);
    expect(validateTermFees(b, classes)).toMatch(/add up to zero/);
  });
  it("rejects unnamed, duplicate and negative entries", () => {
    const bad = (f: (tf: typeof t1) => void) => { const tf = structuredClone(t1); f(tf); return validateTermFees(tf, classes); };
    expect(bad((tf) => { tf.levels.Primary.items[1].label = " "; })).toMatch(/needs a name/);
    expect(bad((tf) => { tf.levels.Primary.items[1].label = "tuition"; })).toMatch(/appears twice/);
    expect(bad((tf) => { tf.levels.JHS.feeding = -5; })).toMatch(/zero or more/);
    expect(bad((tf) => { tf.overrides.zzz = [{ label: "X", amount: 1 }]; })).toMatch(/no longer exists/);
  });
});

describe("Fee schedule — locking and saved edits", () => {
  const locked = Q.lockedFeeTerms();
  it("Term 1 2026/2027 is locked because it has been invoiced; Term 2 is not", () => {
    expect(locked).toContain("2026/2027|Term 1"); expect(locked).not.toContain("2026/2027|Term 2");
  });
  it("saved edits apply to open terms, never to locked ones, and invalid saves are ignored", () => {
    const edT1 = structuredClone(t1); edT1.levels.Primary.items[0].amount = ghs(9999);
    const edT2 = structuredClone(t2); edT2.levels.Primary.items[0].amount = ghs(2500);
    const t3 = copyTerm(t2, "2026/2027", "Term 3");
    const broken = { ...blankTerm("2027/2028", "Term 1", []) };
    const m = mergeSchedule(Q.feeSchedule, [edT1, edT2, t3, broken, null, "junk"], locked, classes);
    expect(findTerm(m, "2026/2027", "Term 1")!.levels.Primary.items[0].amount).toBe(ghs(2400));
    expect(findTerm(m, "2026/2027", "Term 2")!.levels.Primary.items[0].amount).toBe(ghs(2500));
    expect(findTerm(m, "2026/2027", "Term 3")).toBeDefined(); expect(findTerm(m, "2027/2028", "Term 1")).toBeUndefined();
    expect(mergeSchedule(Q.feeSchedule, "nope", locked, classes)).toBe(Q.feeSchedule);
  });
  it("invoice numbers follow the term", () => {
    expect(invoiceStem("INV", "2026/2027", "Term 2")).toBe("INV-2627-T2");
    expect(invoiceStem("FDG", "2025/2026", "Term 1")).toBe("FDG-2526-T1");
    expect(Q.invoices.filter((i) => i.account === "fees").every((i) => i.no.startsWith(invoiceStem("INV", i.year, i.term)))).toBe(true);
  });
});

describe("What a parent owes for the term", () => {
  const ama = () => Q.students.find((s) => s.first === "Ama" && s.last === "Mensah")!;
  it("term total is school fees only (feeding included only if paid with the fees); Extra Classes is reported separately", () => {
    const tc = Q.termCharges(ama().id, "2026/2027", "Term 1");
    expect(tc.parts.map((p) => [p.account, p.net])).toEqual([["fees", ghs(3100)], ["extra", ghs(750)]]);
    expect(tc.total).toBe(ghs(3100)); // Ama pays feeding monthly, so it is not on her school fees invoice expect(tc.extra.net).toBe(ghs(750));
    expect(Q.termCharges(ama().id, "2026/2027", "Term 2").total).toBe(0); // nothing billed for Term 2 yet
  });
  it("a scholarship is its own named line, taken off tuition only", () => {
    const s = Q.students.find((x) => x.scholarship && Q.invoicesOf(x.id, "fees")[0].discount > 0)!;
    const inv = Q.invoicesOf(s.id, "fees")[0]; const tc = Q.termCharges(s.id);
    expect(inv.discount).toBe(Math.round(inv.items.find((i) => i.label === "Tuition")!.amount * 0.25));
    expect(tc.parts[0].net).toBe(tc.parts[0].gross - inv.discount);
    expect(Q.discountLabel(s.id)).toBe("Merit Scholarship (25%) on tuition");
    expect(Q.accountLedger(s.id, "fees").some((l) => l.desc === "Merit Scholarship (25%) on tuition" && l.credit === inv.discount)).toBe(true);
  });
  it("demo students are mixed across classes, not listed KG first", () => {
    const firstTen = new Set(Q.students.slice(0, 10).map((s) => Q.getClass(s.classId).level));
    expect(firstTen.size).toBeGreaterThan(1);
    const firstInvoices = Q.invoices.filter((i) => i.account === "fees").slice(0, 10).map((i) => Q.getClass(Q.getStudent(i.studentId)!.classId).level);
    expect(new Set(firstInvoices).size).toBeGreaterThan(1);
  });
});

describe("Fee schedule — spreadsheet editor", () => {
  const t2 = findTerm(Q.feeSchedule, "2026/2027", "Term 2")!;
  it("table round-trips a term without changing what any class pays", () => {
    const back = fromGrid(toGrid(t2), t2.year, t2.term);
    for (const c of classes) expect(classFees(back, c)).toEqual(classFees(t2, c));
    expect(back.activities).toEqual(t2.activities);
  });
  it("one row per fee; a level that doesn't pay a fee is 0 and gets no line", () => {
    const g = toGrid(t2);
    expect(g.rows.map((r) => r.label)).toEqual(["Tuition", "Books", "ICT & Development Levy", "PTA"]); // no Examination fee
    const jhsOnly = { ...g, rows: [...g.rows, { label: "Computer Lab", amounts: { Kindergarten: 0, Primary: 0, JHS: ghs(80) } }] };
    expect(fromGrid(jhsOnly, "y", "t").levels.Primary.items.some((i) => i.label === "Computer Lab")).toBe(false);
    expect(fromGrid(jhsOnly, "y", "t").levels.JHS.items.find((i) => i.label === "Computer Lab")!.amount).toBe(ghs(80));
    expect(g.exceptions).toContainEqual({ classId: cls("JHS 3").id, label: "BECE Registration", amount: ghs(320) });
  });
  it("explains what's missing in plain words", () => {
    const blank = toGrid(blankTerm("2027/2028", "Term 1", ["Extra Classes"]));
    expect(validateGrid(blank, classes)).toBe("Enter the fees for Kindergarten, Primary, JHS");
    const g = toGrid(t2); expect(validateGrid(g, classes)).toBe("");
    expect(validateGrid({ ...g, rows: [...g.rows, { label: "", amounts: { Kindergarten: 5, Primary: 0, JHS: 0 } }] }, classes)).toBe("Give every fee a name");
    expect(validateGrid({ ...g, rows: [...g.rows, { label: "", amounts: { Kindergarten: 0, Primary: 0, JHS: 0 } }] }, classes)).toBe(""); // empty extra row is ignored
    expect(validateGrid({ ...g, rows: [...g.rows, { label: "pta", amounts: { Kindergarten: 5, Primary: 0, JHS: 0 } }] }, classes)).toMatch(/listed twice/);
    expect(validateGrid({ ...g, exceptions: [{ classId: "", label: "X", amount: 1 }] }, classes)).toMatch(/Choose a class/);
  });
});

describe("Generate term invoices", () => {
  const t2 = findTerm(Q.feeSchedule, "2026/2027", "Term 2")!;
  const cand = (name: string, classId: string, scholarship = false) => ({ id: name, name, adm: "A", classId, scholarship });
  it("builds one numbered invoice per student from the fee schedule, feeding included", () => {
    const inv = buildTermInvoices([cand("a", cls("Primary 3").id), cand("b", cls("JHS 1").id)], classes, t2, "2027-01-11");
    expect(inv.map((i) => i.no)).toEqual(["INV-2627-T2-0001", "INV-2627-T2-0002"]);
    expect(generatedTotal(inv[0])).toBe(ghs(2450 + 600));
    expect(inv[1].items.map((i) => i.label)).toEqual(["Tuition", "PTA", "Feeding"]); // no Examination fee
    expect([inv[0].billedOn, inv[0].dueOn]).toEqual(["2027-01-11", "2027-02-08"]);
  });
  it("continues numbering and gives scholarship students 25% off tuition", () => {
    const [i] = buildTermInvoices([cand("c", cls("KG 1").id, true)], classes, t2, "2027-01-11", 176);
    expect(i.no).toBe("INV-2627-T2-0177"); expect(i.discount).toBe(ghs(450));
  });
  it("ignores malformed saved invoices", () => {
    const [ok] = buildTermInvoices([cand("a", cls("KG 1").id)], classes, t2, "2027-01-11");
    expect(readGenerated([ok, { no: 1 }, null])).toEqual([ok]); expect(readGenerated("x")).toEqual([]);
  });
});
