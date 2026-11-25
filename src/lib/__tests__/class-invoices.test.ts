import { describe, expect, it } from "vitest";
import { cleanInvoice, INVOICE_TABS, invoiceTotal, extraTotal, mainLines, mergeInvoices, type ClassInvoice } from "../class-invoices";
import * as Q from "../data/queries";
import { ghs } from "../money";

const inv = (title: string, amounts: number[], extra: number[] = []): ClassInvoice => ({ title, period: "Term 1", notes: "", extraTitle: "Extracurricular Activities",
  lines: amounts.map((a, i) => ({ description: `Line ${i}`, amount: ghs(a) })), extraLines: extra.map((a, i) => ({ description: `Act ${i}`, amount: ghs(a) })) });

describe("Class invoices", () => {
  it("has a tab for KG 1, KG 2, Class 1–6 and JHS 1–3 (extracurricular is on the back of each sheet)", () => {
    expect(INVOICE_TABS.map((t) => t.label)).toEqual(["KG 1", "KG 2", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "JHS 1", "JHS 2", "JHS 3"]);
    for (const t of INVOICE_TABS) expect(Q.getClass(t.classId).name.replace("Primary", "Class"), t.id).toBe(t.label);
  });
  it("main invoice = fees with feeding on it; the ICT levy is listed at 0 (not billed yet)", () => {
    const lines = mainLines([{ description: "Tuition", amount: ghs(1800) }, { description: "Books", amount: ghs(150) }, { description: "ICT & Development Levy", amount: ghs(150) }, { description: "PTA", amount: ghs(50) }], ghs(450));
    expect(lines.map((l) => [l.description, l.amount / 100])).toEqual([["Tuition", 1800], ["Books", 150], ["ICT & Development Levy", 0], ["PTA", 50], ["Feeding", 450]]);
    const noIct = mainLines([{ description: "Tuition", amount: 1 }, { description: "Books", amount: 1 }, { description: "PTA", amount: 1 }], 5);
    expect(noIct.map((l) => l.description)).toEqual(["Tuition", "Books", "ICT & Development Levy", "PTA", "Feeding"]);
  });
  it("totals each invoice separately", () => { const i = inv("x", [1800, 150, 0, 50, 450], [400, 350]); expect(invoiceTotal(i)).toBe(ghs(2450)); expect(extraTotal(i)).toBe(ghs(750)); });
  it("saved edits replace the default; junk, old-layout saves and unknown tabs are ignored", () => {
    const d = { kg1: inv("KG 1", [100]), kg2: inv("KG 2", [200]) };
    const { extraTitle: _x, extraLines: _y, ...old } = inv("old layout", [5]); void _x; void _y;
    const m = mergeInvoices(d, { kg1: inv("KG 1 edited", [999]), kg2: old, nope: inv("?", [1]) });
    expect(m.kg1.title).toBe("KG 1 edited"); expect(m.kg2).toBe(d.kg2); expect("nope" in m).toBe(false);
    expect(mergeInvoices(d, "junk")).toBe(d);
  });
  it("saving drops blank lines but keeps lines at 0 (they print as a dash)", () => {
    const c = cleanInvoice({ ...inv(" KG 1 ", []), lines: [{ description: " Tuition ", amount: 5 }, { description: "ICT & Development Levy", amount: 0 }, { description: "  ", amount: 9 }], extraLines: [{ description: "", amount: 1 }] });
    expect(c.title).toBe("KG 1"); expect(c.lines).toEqual([{ description: "Tuition", amount: 5 }, { description: "ICT & Development Levy", amount: 0 }]); expect(c.extraLines).toEqual([]);
  });
});
