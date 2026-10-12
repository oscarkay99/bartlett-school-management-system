import { ghs, type Minor } from "../money";
import type * as T from "./types";

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

// ---------- Fee structure (per term, minor units) ----------
const feeFor = (level: string, boarding: boolean) => {
  const tuition = level === "Kindergarten" ? 1800 : level === "Primary" ? 2400 : 3000;
  const items: T.InvoiceItem[] = [
    { label: "Tuition", amount: ghs(tuition) },
    { label: "Feeding", amount: ghs(level === "Kindergarten" ? 450 : 600) },
    { label: "Books", amount: ghs(level === "Kindergarten" ? 150 : level === "Primary" ? 250 : 350) },
    { label: "ICT & Development Levy", amount: ghs(level === "JHS" ? 250 : 150) },
    { label: "PTA", amount: ghs(50) },
  ];
  if (level === "JHS") items.push({ label: "Examination", amount: ghs(200) });
  if (boarding) items.push({ label: "Boarding", amount: ghs(1500) });
  return items;
};
export const feeStructure = classes.map((c) => ({ classId: c.id, className: c.name, day: feeFor(c.level, false), boarding: feeFor(c.level, true) }));

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
  const count = cls.level === "Kindergarten" ? 12 : 17;
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
    const boarding = cls.level === "JHS" && rnd() < 0.35;
    const st: T.Student = {
      id: `s${sn}`, admissionNo: `BMS/${pad(2026 - Math.min(idx, 5), 4).slice(2)}/${pad(sn, 4)}`,
      first: male ? pick(maleF) : pick(femaleF), middle: rnd() > 0.5 ? pick(["Nana", "Kwaku", "Yaa", "Owusua", "Fiifi"]) : undefined, last,
      dob: `${year}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`, gender: male ? "Male" : "Female", classId: cls.id,
      category: boarding ? "Boarding" : "Day", house: pick(houses), status: "Active", nationality: "Ghanaian", address: g.address,
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
    if (sn % 37 === 0) st.guardians.push({ guardianId: g.id === "g5" ? "g6" : "g5", relationship: "Uncle", primary: false, legal: false, emergency: false, pickup: false, financial: false, receivesFeeReminders: false, receivesAcademic: false, verified: false, restriction: "No pickup without written consent from primary guardian." });
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
  const st = i === 2 ? students[0] : students.find((x) => x.classId === c && x.guardians.length === 1 && x.guardians[0].guardianId !== mensah.id)!;
  st.first = f; st.last = l; st.gender = f === "Kofi" ? "Male" : "Female"; st.middle = undefined; st.status = "Active"; st.category = "Day"; st.scholarship = undefined; st.classId = c;
  st.guardians = [{ guardianId: mensah.id, relationship: "Father", primary: true, legal: true, emergency: true, pickup: true, financial: true, financialShare: 100, receivesFeeReminders: true, receivesAcademic: true, verified: true }];
});

// ---------- Invoices & payments (balance is DERIVED from these) ----------
export const invoices: T.Invoice[] = [];
export const payments: T.Payment[] = [];
const staffNames = ["Efua Quansah (Bursar)", "Daniel Ofori (Accounts)", "Esi Tetteh (Accounts)"];
let inv = 0, pay = 0, rc = 0;
students.forEach((st) => {
  const cls = classes.find((c) => c.id === st.classId)!;
  const items = feeFor(cls.level, st.category === "Boarding");
  const discount = st.scholarship ? Math.round(items[0].amount * 0.25) : 0;
  const i: T.Invoice = { id: `inv${++inv}`, no: `INV-2627-T1-${pad(inv, 4)}`, studentId: st.id, term: "Term 1", year: "2026/2027", items, discount, billedOn: "2026-09-01", dueOn: st.id === "s3" || inv % 5 === 0 ? "2026-10-05" : "2026-10-30" };
  invoices.push(i);
  const total = items.reduce((a, b) => a + b.amount, 0) - discount;
  // payment behaviour: 30% full, 35% partial, 20% none, rest ~ small
  const r = rnd();
  const plan: number[] = r < 0.3 ? [total] : r < 0.65 ? [Math.round(total * (0.3 + rnd() * 0.5) / 100) * 100] : r < 0.8 ? [Math.round(total * 0.4 / 100) * 100, Math.round(total * 0.3 / 100) * 100] : [];
  plan.forEach((amt, k) => {
    const day = addDays("2026-09-03", int(0, 38) + k * 10);
    const g = st.guardians[0].guardianId;
    payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, studentId: st.id, guardianId: g, amount: amt, method: pick<T.PayMethod>(["Mobile Money", "Mobile Money", "Cash", "Bank Transfer", "Card", "Cheque"]), date: day > TODAY ? TODAY : day, ref: `REF${int(100000, 999999)}`, status: "Confirmed", staff: pick(staffNames) });
  });
});
// Demo: Ama Mensah — exactly GHS 3,500 billed, GHS 2,000 paid => 1,500 outstanding.
const ama = students.find((x) => x.first === "Ama" && x.last === "Mensah")!;
{
  const ai = invoices.find((x) => x.studentId === ama.id)!;
  ai.items = [{ label: "Tuition", amount: ghs(2200) }, { label: "Feeding", amount: ghs(600) }, { label: "Books", amount: ghs(250) }, { label: "ICT & Development Levy", amount: ghs(150) }, { label: "PTA", amount: ghs(50) }, { label: "Examination", amount: ghs(250) }];
  ai.discount = 0; ai.dueOn = "2026-10-30";
  for (let i = payments.length - 1; i >= 0; i--) if (payments[i].studentId === ama.id) payments.splice(i, 1);
  payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, studentId: ama.id, guardianId: mensah.id, amount: ghs(2000), method: "Mobile Money", date: "2026-09-18", ref: "MM88241193", status: "Confirmed", staff: staffNames[0] });
}
// Exceptions for reconciliation
payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, studentId: "s20", amount: ghs(500), method: "Online Gateway", date: "2026-10-10", ref: "GW-PENDING-7781", status: "Pending", staff: "System" });
payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, studentId: "s31", amount: ghs(800), method: "Online Gateway", date: "2026-10-09", ref: "GW-PENDING-7790", status: "Pending", staff: "System" });
payments.push({ id: `p${++pay}`, receiptNo: `RCT-${pad(++rc, 5)}`, studentId: "s44", amount: ghs(1200), method: "Bank Transfer", date: "2026-10-02", ref: "BNK-2210", status: "Reversed", staff: staffNames[1], note: "Cheque bounced — reversal approved by Bursar" });

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
  ["Mathematics Textbook (P4)", "Textbooks", "copy", "Main Store", 38, 40, 300, "Reusable"], ["English Textbook (P4)", "Textbooks", "copy", "Main Store", 36, 40, 300, "Reusable"],
  ["Mathematics Textbook (JHS)", "Textbooks", "copy", "Main Store", 45, 30, 200, "Reusable"], ["Exercise Book (80pg)", "Exercise Books", "pcs", "Main Store", 3.5, 500, 4000, "Consumable"],
  ["School Uniform — Shirt", "Uniforms", "pcs", "Uniform Store", 55, 60, 400, "Consumable"], ["School Uniform — Shorts/Skirt", "Uniforms", "pcs", "Uniform Store", 60, 60, 400, "Consumable"],
  ["Whiteboard Marker (box)", "Stationery", "box", "Main Store", 28, 25, 150, "Consumable"], ["A4 Photocopy Paper (ream)", "Stationery", "ream", "Main Store", 48, 30, 200, "Consumable"],
  ["Chalk (box)", "Classroom Supplies", "box", "Main Store", 12, 40, 200, "Consumable"], ["Lab Beaker Set", "Laboratory Supplies", "set", "Science Lab", 85, 10, 60, "Reusable"],
  ["Bleach (5L)", "Cleaning Materials", "can", "Janitorial", 32, 15, 80, "Consumable"], ["Liquid Soap (5L)", "Cleaning Materials", "can", "Janitorial", 40, 15, 80, "Consumable"],
  ["Football (size 5)", "Sports Equipment", "pcs", "Sports Store", 90, 6, 30, "Reusable"], ["Laptop — Lenovo ThinkPad", "ICT Equipment", "unit", "ICT Room", 4200, 2, 20, "Asset"],
  ["Projector — Epson", "ICT Equipment", "unit", "ICT Room", 3100, 1, 8, "Asset"], ["Student Desk & Chair", "Furniture", "set", "Main Store", 320, 10, 120, "Asset"],
  ["Rice (50kg bag)", "Kitchen & Feeding", "bag", "Kitchen", 520, 12, 60, "Consumable"], ["Cooking Oil (20L)", "Kitchen & Feeding", "jerry", "Kitchen", 380, 6, 30, "Consumable"],
  ["Paracetamol (blister)", "Laboratory Supplies", "pcs", "Sick Bay", 4, 50, 300, "Consumable"], ["Paint (20L, white)", "Maintenance Supplies", "tin", "Maintenance", 260, 4, 24, "Consumable"],
  ["Science Textbook (P4)", "Textbooks", "copy", "Main Store", 40, 40, 300, "Reusable"], ["English Textbook (JHS)", "Textbooks", "copy", "Main Store", 46, 30, 200, "Reusable"], ["Story Reader (KG)", "Textbooks", "copy", "Main Store", 22, 30, 150, "Reusable"],
  ["Beans (50kg bag)", "Kitchen & Feeding", "bag", "Kitchen", 480, 8, 40, "Consumable"], ["Gari (50kg bag)", "Kitchen & Feeding", "bag", "Kitchen", 210, 10, 50, "Consumable"], ["Cooking Gas (14.5kg)", "Kitchen & Feeding", "cyl", "Kitchen", 180, 4, 20, "Consumable"],
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
  students.slice(0, 40).forEach((st) => {
    out.push({ studentId: st.id, item: "Mathematics Textbook", qty: 1, date: "2026-09-09", returnRequired: true, returned: false, staff: "Kojo Danso" });
    out.push({ studentId: st.id, item: "English Textbook", qty: 1, date: "2026-09-09", returnRequired: true, returned: false, staff: "Kojo Danso" });
    out.push({ studentId: st.id, item: "Exercise Book (80pg)", qty: 5, date: "2026-09-09", returnRequired: false, returned: false, staff: "Kojo Danso" });
  });
  return out;
})();

// ---------- Expenses & budgets ----------
const expCats: [string, string, string, number][] = [
  ["Salaries", "Payroll — September", "Administration", 92000], ["Utilities", "ECG Electricity", "Operations", 6800], ["Utilities", "Ghana Water", "Operations", 1900],
  ["Internet", "Vodafone Fibre", "Operations", 1200], ["Repairs", "Roof repair — Block B", "Operations", 8400], ["Stationery", "Ashanti Stationers", "Administration", 3300],
  ["Food Supplies", "Kitchen restocking", "Kitchen", 24500], ["Transport", "Bus fuel", "Operations", 5200], ["Inventory Purchases", "Kumasi Books Ltd", "Stores", 15800],
  ["Software", "School platform subscription", "Administration", 2400], ["Building", "Perimeter fence", "Operations", 31000], ["Maintenance", "Generator service", "Operations", 2100],
];
export const expenses: T.Expense[] = expCats.map(([category, vendor, department, amt], i) => ({
  id: `e${i + 1}`, no: `EXP-${pad(i + 1, 4)}`, date: addDays("2026-09-05", i * 3), category, vendor, amount: ghs(amt), method: pick(["Bank Transfer", "Cash", "Mobile Money", "Cheque"]), department,
  status: i === 10 ? "Pending Approval" : i === 4 ? "Pending Approval" : i % 3 === 0 ? "Paid" : "Approved", approver: amt > 20000 ? "Owner" : amt > 5000 ? "Administrator" : "Finance Officer", description: `${vendor} — ${category}`,
}));
export const budget: T.BudgetLine[] = [
  ["Salaries", 300000], ["Utilities", 28000], ["Internet", 5000], ["Repairs", 20000], ["Stationery", 12000], ["Food Supplies", 80000], ["Transport", 20000], ["Inventory Purchases", 50000], ["Software", 8000], ["Building", 60000], ["Maintenance", 9000],
].map(([category, b]) => ({ category: category as string, budget: ghs(b as number), actual: expenses.filter((e) => e.category === category && e.status !== "Rejected").reduce((a, e) => a + e.amount, 0) }));

// ---------- Messaging, approvals, audit, events, applicants ----------
export const messages: T.Message[] = Array.from({ length: 24 }, (_, i) => {
  const g = guardians[(i * 5) % guardians.length];
  const sts = students.filter((x) => x.guardians.some((y) => y.guardianId === g.id));
  const status = i % 9 === 0 ? "Failed" : i % 7 === 0 ? "Awaiting Approval" : i % 5 === 0 ? "Queued" : i % 2 ? "Delivered" : "Sent";
  return { id: `msg${i}`, date: addDays("2026-09-25", Math.floor(i / 2)), guardianId: g.id, studentIds: sts.map((x) => x.id), channel: pick<T.Channel>(["SMS", "WhatsApp", "Email"]), template: i % 4 === 0 ? "Attendance Alert" : "Fee Reminder", amount: ghs(int(300, 3000)), status, sender: i % 3 === 0 ? "Automation (7 days before due)" : staffNames[i % 3], failure: status === "Failed" ? "Number not reachable" : undefined } as T.Message;
});
export const approvals: T.Approval[] = [
  { id: "a1", kind: "Expense", title: "Perimeter fence — Phase 2", requester: "Operations", amount: ghs(31000), date: "2026-10-09", module: "finance" },
  { id: "a2", kind: "Expense", title: "Roof repair — Block B", requester: "Operations", amount: ghs(8400), date: "2026-10-08", module: "finance" },
  { id: "a3", kind: "Refund", title: "Refund — duplicate Momo payment (Primary 2)", requester: "Esi Tetteh", amount: ghs(600), date: "2026-10-10", module: "fees" },
  { id: "a4", kind: "Grade batch", title: "JHS 2 — Mathematics (Term 1 CA)", requester: "Isaac Danso", date: "2026-10-11", module: "academics" },
  { id: "a5", kind: "Purchase request", title: "200 exercise books + 40 marker boxes", requester: "Kojo Danso", amount: ghs(1800), date: "2026-10-07", module: "inventory" },
  { id: "a6", kind: "Stock adjustment", title: "Write-off: 4 damaged beaker sets", requester: "Kojo Danso", amount: ghs(340), date: "2026-10-06", module: "inventory" },
];
export const audit: T.AuditEvent[] = [
  ["Efua Quansah", "Recorded payment RCT-00412 (GHS 2,000)", "Ama Mensah", "Fees"], ["Daniel Ofori", "Reversed payment BNK-2210", "Student s44", "Fees"], ["Adwoa Asante", "Linked guardian Kwabena Mensah", "Kofi Mensah", "Students"],
  ["Kojo Danso", "Received 100 × English Textbook (GRN-0042)", "Main Store", "Inventory"], ["Owner", "Approved grade batch Primary 6 English", "Primary 6", "Academics"], ["Esi Tetteh", "Generated invoices (Term 1)", "11 classes", "Fees"],
  ["Admin", "Changed role: Auditor → read-only finance", "User t15", "Access"], ["Kojo Danso", "Adjusted stock: damaged ×2", "Football (size 5)", "Inventory"],
].map(([actor, action, target, module], i) => ({ id: `au${i}`, at: `2026-10-${pad(12 - Math.floor(i / 3), 2)} ${pad(16 - i, 2)}:${pad(i * 7 % 60, 2)}`, actor, action, target, module }));
export const events: T.SchoolEvent[] = [
  { id: "ev1", date: "2026-10-30", title: "Fee payment deadline", kind: "Event" }, { id: "ev2", date: "2026-11-02", title: "PTA General Meeting", kind: "Meeting" },
  { id: "ev3", date: "2026-11-30", title: "End-of-term examinations begin", kind: "Exam" }, { id: "ev4", date: "2026-12-18", title: "Term 1 ends", kind: "Holiday" }, { id: "ev5", date: "2026-10-23", title: "Inter-house sports", kind: "Event" },
];
export const applicants: T.Applicant[] = [
  ["Nana Yaw Boadu", "Primary 1", "Submitted"], ["Esi Nyarko", "KG 1", "Documents Reviewed"], ["Kwame Ampofo", "JHS 1", "Assessment"], ["Akosua Boateng", "Primary 3", "Accepted"],
  ["Yaw Ofori-Atta", "Primary 5", "Accepted"], ["Maame Serwaa", "KG 2", "Registered"], ["Kojo Bonsu", "JHS 2", "Submitted"], ["Afia Pokuaa", "Primary 2", "Assessment"], ["Ebo Quartey", "Primary 4", "Enrolled"],
].map(([name, classApplied, stage], i) => ({ id: `ap${i}`, name, classApplied, stage: stage as T.Applicant["stage"], date: addDays("2026-09-20", i * 2), guardian: `${pick(maleF)} ${name.split(" ").pop()}` }));

export const attendanceTrend = Array.from({ length: 20 }, (_, i) => ({ date: addDays("2026-09-14", i + Math.floor(i / 5) * 2), rate: Math.round((93 + Math.sin(i / 2.5) * 3 + (rnd() - 0.5) * 2) * 10) / 10 }));
export type _M = Minor;
