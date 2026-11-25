import { describe, expect, it } from "vitest";
import { cleanInvoice, INVOICE_TABS, invoiceTotal, isSmall, mainLines, mergeInvoices, PER_PAGE, type ClassInvoice } from "../class-invoices";
import * as Q from "../data/queries";
import { ghs } from "../money";

const inv = (title: string, amounts: number[]): ClassInvoice => ({ title, period: "Term 1", notes: "", lines: amounts.map((a, i) => ({ description: `Line ${i}`, amount: ghs(a) })) });

describe("Class invoices", () => {
  it("lists KG 1, KG 2, Class 1–6, JHS 1–3, then Extracurricular and Extra Classes as their own invoices", () => {
    expect(INVOICE_TABS.map((t) => t.label)).toEqual(["KG 1", "KG 2", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "JHS 1", "JHS 2", "JHS 3", "Extracurricular", "Extra Classes"]);
    for (const t of INVOICE_TABS.filter((x) => x.classId)) expect(Q.getClass(t.classId!).name.replace("Primary", "Class"), t.id).toBe(t.label);
    expect(INVOICE_TABS.at(-1)!.classId).toBeUndefined();
  });
  it("Extracurricular and Extra Classes are the small 10-per-A4 invoices; classes get the full invoice", () => {
    expect(PER_PAGE).toBe(10);
    expect(INVOICE_TABS.filter(isSmall).map((t) => t.label)).toEqual(["Extracurricular", "Extra Classes"]);
  });
  it("school fees invoice: fee lines, the ICT levy at 0 (not billed yet), then feeding", () => {
    const lines = mainLines([{ description: "Tuition", amount: ghs(1800) }, { description: "Books", amount: ghs(150) }, { description: "ICT & Development Levy", amount: ghs(150) }, { description: "PTA", amount: ghs(50) }], ghs(450));
    expect(lines.map((l) => [l.description, l.amount / 100])).toEqual([["Tuition", 1800], ["Books", 150], ["ICT & Development Levy", 0], ["PTA", 50], ["Feeding", 450]]);
    expect(mainLines([{ description: "Tuition", amount: 1 }, { description: "Books", amount: 1 }, { description: "PTA", amount: 1 }], 5).map((l) => l.description)).toEqual(["Tuition", "Books", "ICT & Development Levy", "PTA", "Feeding"]);
  });
  it("totals the lines", () => expect(invoiceTotal(inv("x", [1800, 150, 0, 50, 450]))).toBe(ghs(2450)));
  it("saved edits replace the default; junk and unknown tabs are ignored", () => {
    const d = { kg1: inv("KG 1", [100]), kg2: inv("KG 2", [200]) };
    const m = mergeInvoices(d, { kg1: inv("edited", [999]), kg2: { title: "bad" }, nope: inv("?", [1]) });
    expect(m.kg1.title).toBe("edited"); expect(m.kg2).toBe(d.kg2); expect("nope" in m).toBe(false);
    expect(mergeInvoices(d, "junk")).toBe(d);
  });
  it("saving drops blank lines but keeps lines at 0 (they print as a dash)", () => {
    const c = cleanInvoice({ ...inv(" School Fees ", []), lines: [{ description: " Tuition ", amount: 5 }, { description: "ICT & Development Levy", amount: 0 }, { description: "  ", amount: 9 }] });
    expect(c.title).toBe("School Fees"); expect(c.lines).toEqual([{ description: "Tuition", amount: 5 }, { description: "ICT & Development Levy", amount: 0 }]);
  });
  it("an invoice saved with the old \"Extra Classes\" line shows it as STEM", () => {
    const d = { extra: { title: "Extracurricular", period: "Term 1", notes: "", lines: [] } };
    const m = mergeInvoices(d, { extra: { title: "Extracurricular", period: "Term 1", notes: "", lines: [{ description: "Music (Piano)", amount: 1 }, { description: "Extra Classes", amount: 2 }] } });
    expect(m.extra.lines.map((l) => l.description)).toEqual(["Music (Piano)", "STEM"]);
  });
});
