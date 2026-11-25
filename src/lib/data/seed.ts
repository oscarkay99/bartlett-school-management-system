import { ghs, type Minor } from "../money";
import type * as T from "./types";
import { activitiesFor, type Activity } from "../accounts";
import type { AcademicYear } from "../calendar";
import { classFees, feedingRate, findTerm, termBillLines, type LevelFees, type TermFees } from "../fees";
import { perPeriod, type FeedingPlan } from "../feeding";

// Deterministic PRNG so server & client agree and screenshots are stable.
let s = 20261012;
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <A,>(a: A[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n: number, w: number) => String(n).padStart(w, "0");
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (isoD: string, n: number) => { const d = new Date(isoD + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

export const TODAY = "2026-10-12";
export const SCHOOL = {
  name: "Bartlett Montessori School", short: "BMS", city: "Kumasi, Ashanti Region", phone: "+233 32 202 4410",
  email: "accounts@bartlett.edu.gh", currency: "GHS", timezone: "Africa/Accra", year: "2026/2027", term: "Term 1",
  termStart: "2026-09-07", termEnd: "2026-12-18", reopening: "2027-01-11",
  terms: ["Term 1", "Term 2", "Term 3"], years: ["2026/2027", "2025/2026"],
  // Newest first. More years and terms can be added in Settings → Academic calendar.
  calendar: [
    { name: "2026/2027", start: "2026-09-07", end: "2027-07-23", terms: [{ name: "Term 1", start: "2026-09-07", end: "2026-12-18" }, { name: "Term 2", start: "2027-01-11", end: "2027-04-08" }, { name: "Term 3", start: "2027-05-03", end: "2027-07-23" }] },
    { name: "2025/2026", start: "2025-09-08", end: "2026-07-24", terms: [{ name: "Term 1", start: "2025-09-08", end: "2025-12-19" }, { name: "Term 2", start: "2026-01-12", end: "2026-04-09" }, { name: "Term 3", start: "2026-05-04", end: "2026-07-24" }] },
  ] as AcademicYear[],
};

const maleF = ["Kofi", "Kwame", "Yaw", "Kwabena", "Kwesi", "Nana", "Kojo", "Daniel", "Samuel", "Emmanuel", "Joshua", "Prince", "Isaac", "Michael", "Ebenezer", "Caleb"];
const femaleF = ["Ama", "Abena", "Akua", "Adwoa", "Efua", "Esi", "Yaa", "Afia", "Grace", "Abigail", "Priscilla", "Naana", "Selina", "Gifty", "Mavis", "Joyce"];
const lasts = ["Mensah", "Owusu", "Boateng", "Asante", "Agyeman", "Osei", "Appiah", "Darko", "Addo", "Quaye", "Amoah", "Ofori", "Tetteh", "Danso", "Ankrah", "Frimpong", "Badu", "Sarpong", "Acheampong", "Antwi"];
const houses = ["Nkrumah", "Aggrey", "Yaa Asantewaa", "Sutherland"];
const places = ["Ahodwo, Kumasi", "Nhyiaeso, Kumasi", "Asokwa, Kumasi", "Bantama, Kumasi", "Atonsu, Kumasi", "Santasi, Kumasi", "Ejisu", "Kwadaso, Kumasi"];

export const classes: T.SchoolClass[] = [
  ["KG 1", "Kindergarten"], ["KG 2", "Kindergarten"], ["Primary 1", "Primary"], ["Primary 2", "Primary"], ["Primary 3", "Primary"],
  ["Primary 4", "Primary"], ["Primary 5", "Primary"], ["Primary 6", "Primary"], ["JHS 1", "JHS"], ["JHS 2", "JHS"], ["JHS 3", "JHS"],
].map(([name, level], i) => ({ id: `c${i + 1}`, name, level: level as T.SchoolClass["level"], teacherId: `t${i + 1}` }));

export const subjectsByLevel: Record<string, string[]> = {
  Kindergarten: ["Literacy", "Numeracy", "Creative Arts", "Our World Our People"],
  Primary: ["English Language", "Mathematics", "Science", "Ghanaian Language", "Computing", "Creative Arts"],
  JHS: ["English Language", "Mathematics", "Integrated Science", "Social Studies", "RME", "Computing", "French"],
};

// ---------- Fee schedule (per academic year + term, minor units) ----------
// School fees invoice: tuition, books, levies, PTA and feeding. The school has no boarders. Extra classes are billed on their own standalone invoice.
// The school does not charge the ICT & Development Levy yet (planned in about two years): it is kept at 0 so invoices show "—".
// Fees are set per level; a class can override or add lines (see `overrides`). Edited in Settings → Fee schedule.
const lvl = (tuition: number, books: number, levy: number, feeding: number): LevelFees => ({
  items: [{ label: "Tuition", amount: ghs(tuition) }, { label: "Books", amount: ghs(books) }, { label: "ICT & Development Levy", amount: ghs(levy) }, { label: "PTA", amount: ghs(50) }],
  feeding: ghs(feeding),
});
const acts = (piano: number, extra: number): Record<Activity, Minor> => ({ "Music (Piano)": ghs(piano), "Extra Classes": ghs(extra) });
const lastYear = (term: string): TermFees => ({ year: "2025/2026", term, levels: { Kindergarten: lvl(1650, 150, 0, 420), Primary: lvl(2200, 250, 0, 560), JHS: lvl(2750, 350, 0, 560) }, overrides: {}, activities: acts(380, 320) });
export const feeSchedule: TermFees[] = [
  lastYear("Term 1"), lastYear("Term 2"), { ...lastYear("Term 3"), overrides: { c11: [{ label: "BECE Registration", amount: ghs(300) }] } },
  { year: "2026/2027", term: "Term 1", levels: { Kindergarten: lvl(1800, 150, 0, 450), Primary: lvl(2400, 250, 0, 600), JHS: lvl(3000, 350, 0, 600) }, overrides: {}, activities: acts(400, 350) },
  // Term 2: books are bought once a year (Term 1), Primary 6 pays a mock-exam fee, JHS 3 pays BECE registration.
  { year: "2026/2027", term: "Term 2", levels: { Kindergarten: lvl(1800, 0, 0, 450), Primary: lvl(2400, 0, 0, 600), JHS: lvl(3000, 0, 0, 600) }, overrides: { c8: [{ label: "Mock Examination", amount: ghs(120) }], c11: [{ label: "BECE Registration", amount: ghs(320) }] }, activities: acts(400, 350) },
  // Term 3 of 2026/2027 has no fees yet — set it up in Settings → Fee schedule.
];
const billingTerm = findTerm(feeSchedule, "2026/2027", "Term 1")!;
// What goes on a student's school fees invoice: the class's lines, then feeding (every student).
const feeFor = (cls: T.SchoolClass) => termBillLines(billingTerm, cls);
const feedingFor = (cls: T.SchoolClass) => feedingRate(billingTerm, cls);
/** The current term's fees per class (derived from the schedule). */
export const feeStructure = classes.map((c) => ({ classId: c.id, className: c.name, day: classFees(billingTerm, c), feeding: feedingFor(c) }));
export const activityFees = billingTerm.activities as Record<Activity, Minor>;

// ---------- Guardians & students ----------
export const guardians: T.Guardian[] = [];
export const students: T.Student[] = [];
const guardianStudents = new Map<string, string[]>();

const mkGuardian = (last: string, i: number): T.Guardian => {
  const male = rnd() > 0.45;
  const first = male ? pick(maleF) : pick(femaleF);
  const phone = `+233 ${pick(["24", "54", "55", "20", "50", "27"])} ${pad(int(100, 999), 3)} ${pad(int(1000, 9999), 4)}`;
  return {
    id: `g${i}`, title: male ? "Mr." : "Mrs.", name: `${first} ${last}`, phone, whatsapp: rnd() > 0.2 ? phone : undefined,
    email: rnd() > 0.35 ? `${first}.${last}${i}@mail.com`.toLowerCase() : undefined, address: pick(places), occupation: pick(["Trader", "Teacher", "Engineer", "Nurse", "Civil Servant", "Businessperson", "Driver", "Banker"]),
    preferred: pick<T.Channel>(["WhatsApp", "WhatsApp", "SMS", "SMS", "Email"]), language: pick(["English", "English", "Twi"]),
    consent: { SMS: rnd() > 0.06, WhatsApp: rnd() > 0.12, Email: rnd() > 0.1 }, hasAccount: rnd() > 0.35,
  };
};

let sn = 0, gn = 0;
classes.forEach((cls) => {
  // Kept small so the school can find its way around: 1 student per KG class, 2 per Primary/JHS class (20 in all).
  const count = cls.level === "Kindergarten" ? 1 : 2;
  for (let k = 0; k < count; k++) {
    const male = rnd() > 0.5;
    sn++;
    const siblingOf = rnd() < 0.22 && guardians.length > 4 ? pick(guardians.slice(-15).filter((x) => x.id !== "g1")) : undefined;
    let g: T.Guardian;
    let last: string;
    if (siblingOf) { g = siblingOf; last = g.name.split(" ").pop()!; }
    else { last = pick(lasts); g = mkGuardian(last, ++gn); guardians.push(g); }
    const second = !siblingOf && rnd() < 0.4 ? (() => { const g2 = mkGuardian(last, ++gn); g2.title = g.title === "Mr." ? "Mrs." : "Mr."; guardians.push(g2); return g2; })() : undefined;
    const idx = classes.indexOf(cls);
    const ageBase = 4 + idx;
    const year = 2026 - ageBase - (rnd() > 0.5 ? 0 : 1);
    rnd(); // was the day/boarding draw (the school has no boarders); kept so the rest of the demo data stays the same
    const st: T.Student = {
      id: `s${sn}`, admissionNo: `BMS/${pad(2026 - Math.min(idx, 5), 4).slice(2)}/${pad(sn, 4)}`,
      first: male ? pick(maleF) : pick(femaleF), middle: rnd() > 0.5 ? pick(["Nana", "Kwaku", "Yaa", "Owusua", "Fiifi"]) : undefined, last,
      dob: `${year}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`, gender: male ? "Male" : "Female", classId: cls.id,
      house: pick(houses), status: "Active", nationality: "Ghanaian", address: g.address,
      admittedOn: `${pick([2021, 2022, 2023, 2024, 2025, 2026])}-09-${pad(int(1, 20), 2)}`,
      previousSchool: rnd() > 0.5 ? pick(["Bright Start Academy", "Faith Preparatory", "Garden City School", "Hillcrest Prep"]) : undefined,
      medicalAlert: rnd() < 0.08 ? pick(["Asthma", "Peanut allergy", "Sickle cell trait", "Epilepsy"]) : undefined,
      scholarship: rnd() < 0.05 ? "Merit Scholarship (25%)" : undefined,
      guardians: [{
        guardianId: g.id, relationship: g.title === "Mr." ? "Father" : "Mother", primary: true, legal: true, emergency: true, pickup: true,
        financial: true, financialShare: second ? 50 : 100, receivesFeeReminders: true, receivesAcademic: true, verified: true,
      }],
    };
    if (second) st.guardians.push({
      guardianId: second.id, relationship: second.title === "Mr." ? "Father" : "Mother", primary: false, legal: true, emergency: true, pickup: true,
      financial: rnd() > 0.2, financialShare: 50, receivesFeeReminders: rnd() > 0.3, receivesAcademic: true, verified: true,
    });
    // a couple of cases: unverified / restricted guardian
    if (sn === 7) st.guardians.push({ guardianId: g.id === "g5" ? "g6" : "g5", relationship: "Uncle", primary: false, legal: false, emergency: false, pickup: false, financial: false, receivesFeeReminders: false, receivesAcademic: false, verified: false, restriction: "No pickup without written consent from primary guardian." });
    if (sn === 9) { st.status = "Withdrawn"; }
    students.push(st);
    guardianStudents.set(g.id, [...(guardianStudents.get(g.id) ?? []), st.id]);
  }
});
// Make the headline demo family: Mensah with three children
const mensah = guardians[0];
mensah.name = "Kwabena Mensah"; mensah.title = "Mr."; mensah.preferred = "WhatsApp"; mensah.consent = { SMS: true, WhatsApp: true, Email: true }; mensah.hasAccount = true; mensah.email = "kwabena.mensah@mail.com";
const demoKids: [string, string, string, "Male" | "Female"][] = [["Ama", "Mensah", "c5", "Female"], ["Kofi", "Mensah", "c3", "Male"], ["Abena", "Mensah", "c1", "Female"]];
demoKids.forEach(([f, l, c], i) => {
  // Any student of that class who is not already a Mensah child (their guardians are replaced just below).
  const st = i === 2 ? students[0] : students.find((x) => x.classId === c && !x.guardians.some((g) => g.guardianId === mensah.id))!;
  st.first = f; st.last = l; st.gender = f === "Kofi" ? "Male" : "Female"; st.middle = undefined; st.status = "Active"; st.scholarship = undefined; st.classId = c;
  st.guardians = [{ guardianId: mensah.id, relationship: "Father", primary: true, legal: true, emergency: true, pickup: true, financial: true, financialShare: 100, receivesFeeReminders: true, receivesAcademic: true, verified: true }];
});

// Students were generated class by class; mix them so lists and invoice numbers don't run KG → JHS.
// Own PRNG so the shuffle doesn't change any other generated value.
{
  let k = 7; const r = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
  for (let i = students.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [students[i], students[j]] = [students[j], students[i]]; }
}

// ---------- Invoices & payments (balance is DERIVED from these) ----------
export const invoices: T.Invoice[] = [];
export const payments: T.Payment[] = [];
const staffNames = ["Efua Quansah (Bursar)", "Daniel Ofori (Accounts)", "Esi Tetteh (Accounts)"];
let inv = 0, pay = 0, rc = 0;
// Feeding payment plans, decided before invoicing: families who pay feeding "small small" (daily / weekly / monthly)
// do NOT have feeding on their school fees invoice; everyone else pays it with the school fees. Own PRNG (r3) so this
// does not reshuffle the rest of the demo data. Ama Mensah (monthly) is set up in the demo block below.
let k3 = 4242; const r3 = () => { k3 = (k3 * 48271) % 2147483647; return k3 / 2147483647; };
const mensahKids = new Set(students.filter((x) => x.guardians.some((g) => g.guardianId === guardians[0].id)).map((x) => x.id));
const planOf = new Map<string, "Daily" | "Weekly" | "Monthly">();
for (const st of students) {
  if (mensahKids.has(st.id) || st.status !== "Active" || r3() > 0.3) continue;
  planOf.set(st.id, (["Daily", "Weekly", "Monthly"] as const)[Math.floor(r3() * 3)]);
}
students.forEach((st) => {
  const cls = classes.find((c) => c.id === st.classId)!;
  const items = feeFor(cls).filter((x) => !(planOf.has(st.id) && x.label === "Feeding"));   // plan payers: feeding billed separately
  const discount = st.scholarship ? Math.round(items[0].amount * 0.25) : 0;
  const i: T.Invoice = { id: `inv${++inv}`, no: `INV-2627-T1-${pad(inv, 4)}`, account: "fees", studentId: st.id, term: "Term 1", year: "2026/2027", items, discount, billedOn: "2026-09-01", dueOn: st.id === "s3" || inv % 5 === 0 ? "2026-10-05" : "2026-10-30" };
  invoices.push(i);
  const total = items.reduce((a, b) => a + b.amount, 0) - discount;
  // payment behaviour: 30% full, 35% partial, 20% none, rest ~ small
  const r = rnd();
  const plan: number[] = r < 0.3 ? [total] : r < 0.65 ? [Math.round(total * (0.3 + rnd() * 0.5) / 100) * 100] : r < 0.8 ? [Math.round(total * 0.4 / 100) * 100, Math.round(total * 0.3 / 100) * 100] : [];
  plan.forEach((amt, k) => {
    const day = addDays("2026-09-03", int(0, 38) + k * 10);
    const g = st.guardians[0].guardianId;
    payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, account: "fees", studentId: st.id, guardianId: g, amount: amt, method: pick<T.PayMethod>(["Mobile Money", "Mobile Money", "Cash", "Bank Transfer", "Card", "Cheque"]), date: day > TODAY ? TODAY : day, ref: `REF${int(100000, 999999)}`, status: "Confirmed", staff: pick(staffNames) });
  });
});
// Demo: Ama Mensah — pays feeding monthly, so it is NOT on her school fees invoice:
// school fees GH₵ 3,100 billed, GH₵ 2,000 paid => 1,100 outstanding; feeding GH₵ 600, GH₵ 300 paid (monthly).
const ama = students.find((x) => x.first === "Ama" && x.last === "Mensah")!;
{
  const ai = invoices.find((x) => x.studentId === ama.id)!;
  ai.items = [{ label: "Tuition", amount: ghs(2800) }, { label: "Books", amount: ghs(250) }, { label: "PTA", amount: ghs(50) }];
  ai.discount = 0; ai.dueOn = "2026-10-30";
  for (let i = payments.length - 1; i >= 0; i--) if (payments[i].studentId === ama.id) payments.splice(i, 1);
  payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, account: "fees", studentId: ama.id, guardianId: mensah.id, amount: ghs(2000), method: "Mobile Money", date: "2026-09-18", ref: "MM88241193", status: "Confirmed", staff: staffNames[0], feeding: 0 }); // school fees only
  payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, account: "fees", studentId: ama.id, guardianId: mensah.id, amount: ghs(300), method: "Cash", date: "2026-09-21", ref: "CASH-0921", status: "Confirmed", staff: staffNames[0], feeding: ghs(300), feedingPeriod: "Monthly" });
  // Ama: feeding on a monthly plan (paid separately from her school fees). Pushed once feedingPlans exists, below.
}
// Demo: Kofi and Abena Mensah each part-paid, so their father gets one reminder covering all three children.
for (const [first, paid, day, ref] of [["Kofi", 1500, "2026-09-18", "MM88241194"], ["Abena", 1000, "2026-09-25", "MM88241302"]] as const) {
  const kid = students.find((x) => x.first === first && x.last === "Mensah" && x.guardians[0].guardianId === mensah.id)!;
  for (let i = payments.length - 1; i >= 0; i--) if (payments[i].studentId === kid.id && payments[i].account === "fees") payments.splice(i, 1);
  payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, account: "fees", studentId: kid.id, guardianId: mensah.id, amount: ghs(paid), method: "Mobile Money", date: day, ref, status: "Confirmed", staff: staffNames[0] });
}
// Exceptions for reconciliation
payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, account: "fees", studentId: "s20", amount: ghs(500), method: "Online Gateway", date: "2026-10-10", ref: "GW-PENDING-7781", status: "Pending", staff: "System" });
payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, account: "fees", studentId: "s14", amount: ghs(800), method: "Online Gateway", date: "2026-10-09", ref: "GW-PENDING-7790", status: "Pending", staff: "System" });
payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, account: "fees", studentId: "s17", amount: ghs(1200), method: "Bank Transfer", date: "2026-10-02", ref: "BNK-2210", status: "Reversed", staff: staffNames[1], note: "Cheque bounced — reversal approved by Bursar" });

// ---------- Feeding payments & payment plans ----------
/** Feeding payment plans: families who pay feeding on its own (daily / weekly / monthly). Everyone else pays it with the school fees. */
export const feedingPlans: FeedingPlan[] = [];
feedingPlans.push({ studentId: ama.id, term: "2026/2027|Term 1", frequency: "Monthly", from: "2026-09-07", note: "Pays feeding monthly in cash" });
{
  const T1 = { start: "2026-09-07", end: "2026-12-18" };
  const classRate = (st: T.Student) => feedingFor(classes.find((c) => c.id === st.classId)!);
  // n-th school day (Mon–Fri) from the start of term.
  const schoolDay = (n: number) => { let d = T1.start, left = n; while (left > 0) { d = addDays(d, 1); const w = new Date(d + "T00:00:00Z").getUTCDay(); if (w !== 0 && w !== 6) left--; } return d; };
  // Plan payers pay feeding small small, separately from school fees (these payments never reduce the school fees balance).
  for (const st of students) {
    const period = planOf.get(st.id); if (!period) continue;
    const rate = classRate(st); const each = perPeriod(rate, T1, period);   // the plan's amount per period
    feedingPlans.push({ studentId: st.id, term: "2026/2027|Term 1", frequency: period, from: T1.start });
    const times = period === "Daily" ? 5 + Math.floor(r3() * 20) : period === "Weekly" ? 1 + Math.floor(r3() * 5) : 1 + Math.floor(r3() * 2);
    let left = rate;
    for (let n = 0; n < times && left >= each && each > 0; n++) {
      const day = period === "Daily" ? schoolDay(n) : addDays(T1.start, period === "Weekly" ? n * 7 : n * 30); if (day > TODAY) break;
      payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, account: "fees", studentId: st.id, guardianId: st.guardians[0].guardianId, amount: each,
        method: r3() < 0.6 ? "Cash" : "Mobile Money", date: day, ref: `FD-${pad(pay * 7, 6)}`, status: "Confirmed", staff: staffNames[Math.floor(r3() * staffNames.length)], feeding: each, feedingPeriod: period });
      left -= each;
    }
  }
  // Families who pay feeding WITH the school fees: each school fees payment covers feeding in proportion,
  // so paying the whole invoice at once pays feeding in full.
  for (const st of students) {
    const inv = invoices.find((i) => i.studentId === st.id && i.account === "fees"); if (!inv) continue;
    const rate = inv.items.find((x) => x.label === "Feeding")?.amount ?? 0; const gross = inv.items.reduce((a, x) => a + x.amount, 0) - inv.discount;
    let left = rate;
    for (const p of payments.filter((x) => x.studentId === st.id && x.account === "fees" && x.feeding === undefined).sort((a, b) => a.date.localeCompare(b.date))) {
      const share = gross > 0 ? Math.min(left, Math.round((p.amount * rate) / gross / 100) * 100) : 0;   // whole cedis
      p.feeding = Math.max(0, share); if (p.status === "Confirmed") left -= p.feeding;
    }
  }
}

// ---------- Extra Classes (standalone invoice, receipted separately) ----------
// Own PRNG so this account does not reshuffle the rest of the demo data.
let s2 = 20261123;
const rnd2 = () => { s2 |= 0; s2 = (s2 + 0x6d2b79f5) | 0; let t = Math.imul(s2 ^ (s2 >>> 15), 1 | s2); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const PAY_METHODS: T.PayMethod[] = ["Mobile Money", "Mobile Money", "Cash", "Cash", "Bank Transfer"];
let xInv = 0, xRc = 0;
const settle = (st: T.Student, total: Minor) => {
  const r = rnd2();
  const plan = r < 0.4 ? [total] : r < 0.7 ? [Math.round(total * (0.25 + rnd2() * 0.5) / 100) * 100] : r < 0.85 ? [Math.round(total * 0.3 / 100) * 100, Math.round(total * 0.3 / 100) * 100] : [];
  plan.forEach((amt, k) => {
    const day = addDays("2026-09-07", Math.floor(rnd2() * 30) + k * 7);
    payments.push({ id: `p${++pay}`, receiptNo: `XRC-${pad(++xRc, 5)}`, account: "extra", studentId: st.id, guardianId: st.guardians[0].guardianId, amount: amt, method: PAY_METHODS[Math.floor(rnd2() * PAY_METHODS.length)], date: day > TODAY ? TODAY : day, ref: `XC${100000 + Math.floor(rnd2() * 899999)}`, status: "Confirmed", staff: staffNames[Math.floor(rnd2() * staffNames.length)] });
  });
};
students.forEach((st) => {
  const cls = classes.find((c) => c.id === st.classId)!;
  // Every student is enrolled in extra classes: Kindergarten in Music (Piano), everyone else in Music and Extra Classes.
  const taken = activitiesFor(cls.level);
  {
    const items = taken.map((a) => ({ label: a, amount: activityFees[a] }));
    invoices.push({ id: `exc${++xInv}`, no: `EXC-2627-T1-${pad(xInv, 4)}`, account: "extra", studentId: st.id, term: "Term 1", year: "2026/2027", items, discount: 0, billedOn: "2026-09-08", dueOn: xInv % 5 === 0 ? "2026-10-09" : "2026-10-30" });
    settle(st, items.reduce((a, b) => a + b.amount, 0));
  }
});
const getLevel = (st: T.Student) => classes.find((c) => c.id === st.classId)!.level;
// Demo: Ama Mensah — Music (Piano) GH₵ 400 + Extra Classes GH₵ 350 on the Extra Classes invoice, unpaid.
{
  for (let i = invoices.length - 1; i >= 0; i--) if (invoices[i].studentId === ama.id && invoices[i].account !== "fees") invoices.splice(i, 1);
  for (let i = payments.length - 1; i >= 0; i--) if (payments[i].studentId === ama.id && payments[i].account !== "fees") payments.splice(i, 1);
  invoices.push({ id: `exc${++xInv}`, no: `EXC-2627-T1-${pad(xInv, 4)}`, account: "extra", studentId: ama.id, term: "Term 1", year: "2026/2027", items: activitiesFor(getLevel(ama)).map((a) => ({ label: a, amount: activityFees[a] })), discount: 0, billedOn: "2026-09-08", dueOn: "2026-10-30" });
}

// ---------- Staff ----------
const tFirst = ["Efua", "Samuel", "Gifty", "Isaac", "Mavis", "Yaw", "Abigail", "Michael", "Priscilla", "Kojo", "Joyce", "Emmanuel", "Selina", "Caleb"];
export const staff: T.Staff[] = tFirst.map((f, i) => ({
  id: `t${i + 1}`, empNo: `EMP-${pad(i + 1, 3)}`, name: `${f} ${lasts[(i * 3) % lasts.length]}`, position: i < 11 ? "Class Teacher" : i === 11 ? "Head of ICT" : i === 12 ? "Storekeeper" : "Bursar",
  department: i < 2 ? "Kindergarten" : i < 8 ? "Primary" : i < 11 ? "JHS" : "Administration", type: i % 6 === 5 ? "Contract" : "Full-time",
  phone: `+233 24 ${pad(int(100, 999), 3)} ${pad(int(1000, 9999), 4)}`, email: `${f.toLowerCase()}@bartlett.edu.gh`,
  qualification: pick(["B.Ed Basic Education", "B.Ed Mathematics", "Dip. Early Childhood", "BSc Computer Science", "M.Ed Educational Leadership"]),
  since: `${int(2015, 2025)}-0${int(1, 9)}-01`, classIds: i < 11 ? [`c${i + 1}`] : [], subjects: i < 11 ? subjectsByLevel[classes[i].level].slice(0, 2) : [], status: i === 9 ? "On leave" : "Active",
}));

// ---------- Grades (Term 1 draft→ published mix) ----------
export const grades: T.GradeRow[] = [];
students.forEach((st) => {
  const lvl = classes.find((c) => c.id === st.classId)!.level;
  const ability = 45 + rnd() * 45;
  subjectsByLevel[lvl].forEach((sub) => {
    const base = ability + (rnd() - 0.5) * 20;
    grades.push({ studentId: st.id, subject: sub, ca: Math.max(5, Math.min(40, Math.round((base / 100) * 40 + (rnd() - 0.5) * 6))), exam: Math.max(5, Math.min(60, Math.round((base / 100) * 60 + (rnd() - 0.5) * 8))) });
  });
});
export const gradeScale = [
  { grade: "A", min: 80, label: "Excellent" }, { grade: "B", min: 70, label: "Very Good" }, { grade: "C", min: 60, label: "Good" },
  { grade: "D", min: 50, label: "Credit" }, { grade: "E", min: 0, label: "Needs Support" },
];
export const gradeOf = (total: number) => gradeScale.find((g) => total >= g.min)!;

// ---------- Inventory ----------
const itemDefs: [string, string, string, string, number, number, number, T.InventoryItem["kind"]][] = [
  ["Mathematics Textbook (P4)", "Textbooks", "copy", "Main Store", 38, 40, 300, "Reusable"],
  ["English Textbook (P4)", "Textbooks", "copy", "Main Store", 36, 40, 300, "Reusable"],
  ["Exercise Book (80pg)", "Exercise Books", "pcs", "Main Store", 3.5, 500, 4000, "Consumable"],
  ["Chalk (box)", "Classroom Supplies", "box", "Main Store", 12, 40, 200, "Consumable"],
  ["Football (size 5)", "Sports Equipment", "pcs", "Sports Store", 90, 6, 30, "Reusable"],
  ["Rice (50kg bag)", "Kitchen & Feeding", "bag", "Kitchen", 520, 12, 60, "Consumable"],
  ["Cooking Oil (20L)", "Kitchen & Feeding", "jerry", "Kitchen", 380, 6, 30, "Consumable"],
  ["Beans (50kg bag)", "Kitchen & Feeding", "bag", "Kitchen", 480, 8, 40, "Consumable"],
];
export const inventory: T.InventoryItem[] = itemDefs.map(([name, category, unit, location, cost, reorder, max, kind], i) => ({
  id: `i${i + 1}`, sku: `SKU-${pad(i + 1, 4)}`, name, category, unit, location, supplier: pick(["Kumasi Books Ltd", "Ashanti Stationers", "Gold Coast Uniforms", "TechPoint Ghana", "Adom Supplies"]),
  cost: ghs(cost), reorder, max, kind, onHand: 0, expiry: name.startsWith("Paracetamol") ? "2026-11-20" : name.startsWith("Rice") ? "2027-03-01" : undefined,
}));
export const movements: T.StockMovement[] = [];
let mv = 0;
inventory.forEach((it, i) => {
  const lowish = i % 5 === 2 || i === 16;
  const open = lowish ? Math.max(1, Math.round(it.reorder * 0.7)) : Math.round(it.max * (0.35 + rnd() * 0.5));
  movements.push({ id: `m${++mv}`, date: "2026-08-25", itemId: it.id, type: "Opening", qty: open, ref: "OPENING", staff: "Kojo Danso" });
  const recv = int(0, 3) * Math.round(it.reorder);
  if (recv) movements.push({ id: `m${++mv}`, date: addDays("2026-09-01", int(0, 20)), itemId: it.id, type: "Received", qty: recv, ref: `GRN-${pad(100 + i, 4)}`, staff: "Kojo Danso" });
  const out = lowish ? 0 : Math.round(open * (0.3 + rnd() * 0.65));
  for (let k = 0; k < (lowish ? 0 : 3); k++) movements.push({ id: `m${++mv}`, date: addDays("2026-09-08", int(0, 30)), itemId: it.id, type: "Issued", qty: Math.max(1, Math.round(out / 3)), ref: `ISS-${pad(mv, 4)}`, staff: "Kojo Danso", to: pick(["Primary 4", "JHS 1", "Admin Office", "Kitchen", "Primary 2"]) });
  if (!lowish && rnd() < 0.3) movements.push({ id: `m${++mv}`, date: addDays("2026-09-15", int(0, 20)), itemId: it.id, type: "Damaged", qty: int(1, 4), ref: `DMG-${pad(mv, 4)}`, staff: "Kojo Danso" });
});
// Workflow E: 100 textbooks received, 20 issued → 80 available (item i2, isolated)
{
  const it = inventory.find((x) => x.name.startsWith("English Textbook"))!;
  for (let i = movements.length - 1; i >= 0; i--) if (movements[i].itemId === it.id) movements.splice(i, 1);
  movements.push({ id: `m${++mv}`, date: "2026-09-02", itemId: it.id, type: "Received", qty: 100, ref: "GRN-0042", staff: "Kojo Danso" });
  movements.push({ id: `m${++mv}`, date: "2026-09-14", itemId: it.id, type: "Issued", qty: 20, ref: "ISS-0310", staff: "Kojo Danso", to: "Primary 4" });
}
movements.sort((a, b) => b.date.localeCompare(a.date));
inventory.forEach((it) => {
  it.onHand = movements.filter((m) => m.itemId === it.id).reduce((a, m) => a + (["Received", "Opening", "Returned"].includes(m.type) ? m.qty : m.type === "Adjustment" ? m.qty : -m.qty), 0);
});
export const studentIssues = (() => {
  const out: { studentId: string; item: string; qty: number; date: string; returnRequired: boolean; returned: boolean; staff: string }[] = [];
  students.slice(0, 4).forEach((st) => {
    out.push({ studentId: st.id, item: "Mathematics Textbook", qty: 1, date: "2026-09-09", returnRequired: true, returned: false, staff: "Kojo Danso" });
    out.push({ studentId: st.id, item: "English Textbook", qty: 1, date: "2026-09-09", returnRequired: true, returned: false, staff: "Kojo Danso" });
    out.push({ studentId: st.id, item: "Exercise Book (80pg)", qty: 5, date: "2026-09-09", returnRequired: false, returned: false, staff: "Kojo Danso" });
  });
  return out;
})();

// ---------- Expenses & budgets ----------
const expCats: [string, string, string, number][] = [
  ["Salaries", "Payroll — September", "Administration", 9200],
  ["Utilities", "ECG Electricity", "Operations", 680],
  ["Utilities", "Ghana Water", "Operations", 190],
  ["Repairs", "Roof repair — Block B", "Operations", 840],
];
export const expenses: T.Expense[] = expCats.map(([category, vendor, department, amt], i) => ({
  id: `e${i + 1}`, no: `EXP-${pad(i + 1, 4)}`, date: addDays("2026-09-05", i * 3), category, vendor, amount: ghs(amt), method: pick(["Bank Transfer", "Cash", "Mobile Money", "Cheque"]), department,
  status: i === 3 ? "Pending Approval" : i % 2 === 0 ? "Paid" : "Approved", approver: amt > 20000 ? "Owner" : amt > 5000 ? "Administrator" : "Finance Officer", description: `${vendor} — ${category}`,
}));
export const budget: T.BudgetLine[] = [
  ["Salaries", 30000], ["Utilities", 2800], ["Internet", 500], ["Repairs", 2000], ["Stationery", 1200], ["Food Supplies", 8000], ["Transport", 2000], ["Inventory Purchases", 5000], ["Software", 800], ["Building", 6000], ["Maintenance", 900],
].map(([category, b]) => ({ category: category as string, budget: ghs(b as number), actual: expenses.filter((e) => e.category === category && e.status !== "Rejected").reduce((a, e) => a + e.amount, 0) }));

// ---------- Messaging, approvals, audit, events, applicants ----------
export const messages: T.Message[] = Array.from({ length: 4 }, (_, i) => {
  const g = guardians[(i * 5) % guardians.length];
  const sts = students.filter((x) => x.guardians.some((y) => y.guardianId === g.id));
  const status = i % 9 === 0 ? "Failed" : i % 7 === 0 ? "Awaiting Approval" : i % 5 === 0 ? "Queued" : i % 2 ? "Delivered" : "Sent";
  return { id: `msg${i}`, date: addDays("2026-09-25", Math.floor(i / 2)), guardianId: g.id, studentIds: sts.map((x) => x.id), channel: pick<T.Channel>(["SMS", "WhatsApp", "Email"]), template: i % 4 === 0 ? "Attendance Alert" : "Fee Reminder", amount: ghs(int(300, 3000)), status, sender: i % 3 === 0 ? "Automation (7 days before due)" : staffNames[i % 3], failure: status === "Failed" ? "Number not reachable" : undefined } as T.Message;
});
export const approvals: T.Approval[] = [
  { id: "a2", kind: "Expense", title: "Roof repair — Block B", requester: "Operations", amount: ghs(840), date: "2026-10-08", module: "finance" },
  { id: "a3", kind: "Refund", title: "Refund — duplicate Momo payment (Primary 2)", requester: "Esi Tetteh", amount: ghs(600), date: "2026-10-10", module: "fees" },
  { id: "a4", kind: "Grade batch", title: "JHS 2 — Mathematics (Term 1 CA)", requester: "Isaac Danso", date: "2026-10-11", module: "academics" },
];
export const audit: T.AuditEvent[] = [
  ["Efua Quansah", "Recorded payment RCT-00412 (GH₵ 2,000)", "Ama Mensah", "Fees"], ["Daniel Ofori", "Reversed payment BNK-2210", "Student s44", "Fees"], ["Adwoa Asante", "Linked guardian Kwabena Mensah", "Kofi Mensah", "Students"],
  ["Kojo Danso", "Received 100 × English Textbook (GRN-0042)", "Main Store", "Inventory"], ["Owner", "Approved grade batch Primary 6 English", "Primary 6", "Academics"], ["Esi Tetteh", "Generated invoices (Term 1)", "11 classes", "Fees"],
  ["Admin", "Changed role: Auditor → read-only finance", "User t15", "Access"], ["Kojo Danso", "Adjusted stock: damaged ×2", "Football (size 5)", "Inventory"],
].map(([actor, action, target, module], i) => ({ id: `au${i}`, at: `2026-10-${pad(12 - Math.floor(i / 3), 2)} ${pad(16 - i, 2)}:${pad(i * 7 % 60, 2)}`, actor, action, target, module }));
export const events: T.SchoolEvent[] = [
  { id: "ev1", date: "2026-10-30", title: "Fee payment deadline", kind: "Event" }, { id: "ev2", date: "2026-11-02", title: "PTA General Meeting", kind: "Meeting" },
  { id: "ev3", date: "2026-11-30", title: "End-of-term examinations begin", kind: "Exam" }, { id: "ev4", date: "2026-12-18", title: "Term 1 ends", kind: "Holiday" }, { id: "ev5", date: "2026-10-23", title: "Inter-house sports", kind: "Event" },
];
export const applicants: T.Applicant[] = [
  ["Nana Yaw Boadu", "Primary 1", "Submitted"], ["Esi Nyarko", "KG 1", "Documents Reviewed"], ["Kwame Ampofo", "JHS 1", "Assessment"],
].map(([name, classApplied, stage], i) => ({ id: `ap${i}`, name, classApplied, stage: stage as T.Applicant["stage"], date: addDays("2026-09-20", i * 2), guardian: `${pick(maleF)} ${name.split(" ").pop()}` }));

export const attendanceTrend = Array.from({ length: 20 }, (_, i) => ({ date: addDays("2026-09-14", i + Math.floor(i / 5) * 2), rate: Math.round((93 + Math.sin(i / 2.5) * 3 + (rnd() - 0.5) * 2) * 10) / 10 }));
export type _M = Minor;
