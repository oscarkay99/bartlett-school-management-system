import { describe, expect, it } from "vitest";
import { cleanInvoice, INVOICE_TABS, invoiceTotal, mergeInvoices, type ClassInvoice } from "../class-invoices";
import * as Q from "../data/queries";
import { ghs } from "../money";

const inv = (title: string, amounts: number[]): ClassInvoice => ({ title, period: "Term 1", notes: "", lines: amounts.map((a, i) => ({ description: `Line ${i}`, amount: ghs(a) })) });

describe("Class invoices", () => {
  it("has KG 1, KG 2, Class 1–6, JHS 1–3, then Extracurricular", () => {
    expect(INVOICE_TABS.map((t) => t.label)).toEqual(["KG 1", "KG 2", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "JHS 1", "JHS 2", "JHS 3", "Extracurricular"]);
  });
  it("each class tab points at the right class", () => {
    for (const t of INVOICE_TABS.filter((x) => x.classId)) {
      const name = Q.getClass(t.classId!).name; expect(name.replace("Primary", "Class"), t.id).toBe(t.label);
    }
  });
  it("totals the lines", () => expect(invoiceTotal(inv("x", [1800, 150, 50]))).toBe(ghs(2000)));
  it("saved edits replace the default; junk and unknown tabs are ignored", () => {
    const d = { kg1: inv("KG 1", [100]), kg2: inv("KG 2", [200]) };
    const m = mergeInvoices(d, { kg1: inv("KG 1 edited", [999]), kg2: { title: "bad" }, nope: inv("?", [1]) });
    expect(m.kg1.title).toBe("KG 1 edited"); expect(m.kg2).toBe(d.kg2); expect("nope" in m).toBe(false);
    expect(mergeInvoices(d, "junk")).toBe(d);
    expect(mergeInvoices(d, { kg1: { ...inv("x", []), lines: [{ description: "a", amount: -5 }] } }).kg1).toBe(d.kg1);
  });
  it("saving drops blank lines and trims text", () => {
    const c = cleanInvoice({ title: " KG 1 ", period: " T1 ", notes: " n ", lines: [{ description: " Tuition ", amount: 5 }, { description: "  ", amount: 9 }] });
    expect(c).toEqual({ title: "KG 1", period: "T1", notes: "n", lines: [{ description: "Tuition", amount: 5 }] });
  });
});
