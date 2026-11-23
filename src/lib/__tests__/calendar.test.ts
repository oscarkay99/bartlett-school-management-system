import { describe, expect, it } from "vitest";
import { addTerm, addYear, mergeCalendar, suggestTerm, suggestYear, validateTerm, validateYear } from "../calendar";
import { SCHOOL } from "../data/seed";

const cal = SCHOOL.calendar;
describe("Academic calendar — adding a year", () => {
  it("seed has 2026/2027 and 2025/2026 with three terms each, newest first", () => {
    expect(cal.map((y) => y.name)).toEqual(["2026/2027", "2025/2026"]);
    for (const y of cal) { expect(y.terms).toHaveLength(3); for (const t of y.terms) expect(validateTerm(t, { ...y, terms: y.terms.filter((x) => x !== t) })).toBe(""); }
  });
  it("suggests the next year with last year's term dates shifted forward, and it is valid", () => {
    const s = suggestYear(cal);
    expect(s.name).toBe("2027/2028"); expect(s.start).toBe("2027-09-07"); expect(s.terms.map((t) => t.start)).toEqual(["2027-09-07", "2028-01-11", "2028-05-03"]);
    expect(validateYear(s, cal)).toBe("");
    const next = addYear(cal, s); expect(next[0].name).toBe("2027/2028"); expect(next).toHaveLength(3);
  });
  it("rejects bad names, duplicates, reversed or overlapping dates", () => {
    expect(validateYear({ name: "2027", start: "2027-09-01", end: "2028-07-01" }, cal)).toMatch(/format/);
    expect(validateYear({ name: "2027/2029", start: "2027-09-01", end: "2028-07-01" }, cal)).toMatch(/follow/);
    expect(validateYear({ name: "2026/2027", start: "2026-09-01", end: "2027-07-01" }, cal)).toMatch(/already exists/);
    expect(validateYear({ name: "2027/2028", start: "2028-07-01", end: "2027-09-01" }, cal)).toMatch(/after/);
    expect(validateYear({ name: "2027/2028", start: "2027-07-01", end: "2028-07-01" }, cal)).toMatch(/overlap 2026\/2027/);
  });
});
describe("Academic calendar — adding a term", () => {
  const blank = { name: "2027/2028", start: "2027-09-06", end: "2028-07-21", terms: [] };
  it("suggests Term 1 at the start of an empty year, then Term 2 after it", () => {
    const t1 = suggestTerm(blank); expect(t1.name).toBe("Term 1"); expect(t1.start).toBe(blank.start); expect(validateTerm(t1, blank)).toBe("");
    const y = addTerm([blank], blank.name, t1)[0]; const t2 = suggestTerm(y);
    expect(t2.name).toBe("Term 2"); expect(t2.start > t1.end).toBe(true); expect(validateTerm(t2, y)).toBe("");
  });
  it("rejects duplicates, terms outside the year and overlapping terms", () => {
    const y = cal[0];
    expect(validateTerm({ name: "term 1", start: "2027-07-24", end: "2027-07-25" }, y)).toMatch(/already has/);
    expect(validateTerm({ name: "Term 4", start: "2027-07-01", end: "2027-08-30" }, y)).toMatch(/within/);
    expect(validateTerm({ name: "Mid-term", start: "2026-12-01", end: "2027-01-20" }, y)).toMatch(/overlap Term 1/);
    expect(validateTerm({ name: "", start: "2027-04-10", end: "2027-04-20" }, y)).toMatch(/name/);
    expect(validateTerm({ name: "Easter school", start: "2027-04-10", end: "2027-04-20" }, y)).toBe("");
  });
  it("keeps terms in date order", () => {
    const y = addTerm(cal, "2026/2027", { name: "Easter school", start: "2027-04-10", end: "2027-04-20" })[0];
    expect(y.terms.map((t) => t.name)).toEqual(["Term 1", "Term 2", "Easter school", "Term 3"]);
  });
});
describe("Saved additions", () => {
  it("merges saved years/terms onto the seed and drops anything invalid", () => {
    const saved = [...cal, { ...suggestYear(cal) }, { name: "junk", start: "x", end: "y", terms: [] }, { name: "2026/2027", start: cal[0].start, end: cal[0].end, terms: [{ name: "Term 2", start: "2027-01-11", end: "2027-04-08" }, { name: "Vacation class", start: "2027-04-12", end: "2027-04-23" }] }];
    const m = mergeCalendar(cal, saved);
    expect(m.map((y) => y.name)).toEqual(["2027/2028", "2026/2027", "2025/2026"]);
    expect(m[1].terms.map((t) => t.name)).toEqual(["Term 1", "Term 2", "Vacation class", "Term 3"]);
    expect(mergeCalendar(cal, "garbage")).toBe(cal);
  });
});
