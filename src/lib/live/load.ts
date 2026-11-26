"use client";
// Loads the school's data from the database (what the signed-in role may see; row-level security filters it)
// and turns rows into the app's in-memory shapes (lib/data/types). See hydrate.ts for how it replaces the demo data.
import { db } from "./client";
import type * as T from "../data/types";
import type { TermFees, FeeItem } from "../fees";
import type { FeedingException, FeedingPlan, MealEntry, PlanFrequency } from "../feeding";
import type { AcademicYear } from "../calendar";
import type { FeeAccount } from "../accounts";
import type { ClassInvoice } from "../class-invoices";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (v == null ? 0 : Number(v));
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

/** Reads every row of a table or view the role may see, 1,000 at a time (the API's page size). */
async function all(table: string, select = "*", order?: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db().from(table).select(select).range(from, from + 999);
    if (order) q = q.order(order);
    const { data, error } = await q;
    if (error) { if (error.code === "42501" || /permission denied/i.test(error.message)) return []; throw new Error(`${table}: ${error.message}`); }
    out.push(...((data ?? []) as unknown as Row[])); if (!data || data.length < 1000) return out;
  }
}

export interface DraftInvoice { id: string; no?: string; account: FeeAccount; studentId: string; year: string; term: string; status: "draft" | "submitted"; items: T.InvoiceItem[]; returnNote?: string }
export interface LiveTerm { id: string; year: string; term: string; start: string; end: string; current: boolean }
export interface LiveData {
  school: { name: string; short: string; city: string; phone: string; email: string; tier1: number; tier2: number };
  calendar: AcademicYear[]; terms: LiveTerm[]; yearIds: Record<string, string>; current?: LiveTerm;
  classes: T.SchoolClass[]; classPositions: Record<string, number>; subjects: { id: string; name: string; level: string }[];
  staff: T.Staff[]; guardians: T.Guardian[]; students: T.Student[];
  invoices: T.Invoice[]; drafts: DraftInvoice[]; payments: T.Payment[];
  feeSchedule: TermFees[]; activities: { name: string; account: FeeAccount; kindergarten: boolean }[]; enrolments: { studentId: string; term: string; activity: string }[];
  feedingPlans: FeedingPlan[]; feedingExceptions: FeedingException[]; meals: MealEntry[];
  grades: T.GradeRow[]; gradeBatches: { id: string; classId: string; subjectId: string; subject: string; term: string; status: string; returnNote?: string }[];
  gradeScale: { grade: string; min: number; label: string }[];
  inventory: T.InventoryItem[]; movements: (T.StockMovement & { studentId?: string; returnRequired?: boolean })[];
  expenses: T.Expense[]; budget: { category: string; amount: number }[];
  messages: T.Message[]; approvals: T.Approval[]; audit: T.AuditEvent[]; events: T.SchoolEvent[]; applicants: (T.Applicant & { phone: string; classId: string })[];
  attendance: { studentId: string; date: string; status: string; note?: string }[];
  sheets: Record<string, Record<string, ClassInvoice>>;   // term key → sheet id (class id / "extra" / "classes") → invoice
  names: Record<string, string>;                          // auth user id → staff display name
}

export async function loadSchool(): Promise<LiveData> {
  const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);   // attendance: last ~4 months
  const [settings, years, termRows, classRows, subjectRows, assign, staffRows, names, gRows, stRows, invRows, payRows, items, levels, overrides, prices, acts, enrol,
    plans, exc, meals, batches, gradeRows, scale, invItems, onHand, moves, exp, budget, msgs, pend, audit, events, apps, att, sheets] = await Promise.all([
    all("school_settings"), all("academic_years", "*", "starts_on"), all("terms", "*", "starts_on"), all("classes", "*", "position"), all("subjects", "*", "name"),
    all("teaching_assignments"), all("staff", "*", "name"), all("staff_names"), all("guardians", "*", "name"),
    all("students", "*, student_guardians(*), student_medical(alert)", "last_name"),
    all("invoices", "*, invoice_lines(label, amount, position)", "created_at"), all("payments", "*", "paid_on"),
    all("term_fee_items", "*", "position"), all("term_fee_levels"), all("class_fee_overrides"), all("activity_prices"), all("activities"), all("student_activities"),
    all("feeding_plans", "*", "effective_from"), all("feeding_exceptions"), all("meal_register"),
    all("grade_batches"), all("grades"), all("grade_scale"), all("inventory_items", "*", "name"), all("inventory_on_hand"), all("stock_movements", "*", "on_date"),
    all("expenses", "*", "on_date"), all("budget_lines"), all("messages", "*", "created_at"), all("pending_approvals"), all("audit_log", "*", "at"),
    all("school_events", "*", "on_date"), all("applicants", "*", "applied_on"),
    (async () => { const r = await db().from("attendance").select("student_id, on_date, status, note").gte("on_date", since).range(0, 49999); return (r.data ?? []) as Row[]; })(),
    all("invoice_sheets"),
  ]);

  const nm: Record<string, string> = Object.fromEntries(names.map((r) => [s(r.user_id), s(r.display_name)]));
  const who = (id: unknown) => (id ? nm[s(id)] ?? "Staff" : "");
  const yearName: Record<string, string> = Object.fromEntries(years.map((y) => [s(y.id), s(y.name)]));
  const terms: LiveTerm[] = termRows.map((t) => ({ id: s(t.id), year: yearName[s(t.year_id)] ?? "", term: s(t.name), start: s(t.starts_on), end: s(t.ends_on), current: !!t.is_current }));
  const termById = Object.fromEntries(terms.map((t) => [t.id, t]));
  const tkey = (id: unknown) => { const t = termById[s(id)]; return t ? `${t.year}|${t.term}` : ""; };
  const calendar: AcademicYear[] = [...years].reverse().map((y) => ({ name: s(y.name), start: s(y.starts_on), end: s(y.ends_on),
    terms: terms.filter((t) => t.year === y.name).map((t) => ({ name: t.term, start: t.start, end: t.end })) }));
  const subjName = Object.fromEntries(subjectRows.map((x) => [s(x.id), s(x.name)]));
  const classes: T.SchoolClass[] = classRows.map((c) => ({ id: s(c.id), name: s(c.name), level: s(c.level) as T.SchoolClass["level"], teacherId: s(c.class_teacher_id) }));

  const staff: T.Staff[] = staffRows.map((x) => { const a = assign.filter((y) => y.staff_id === x.id);
    return { id: s(x.id), empNo: s(x.emp_no), name: s(x.name), position: s(x.position), department: s(x.department), type: s(x.employment_type) as T.Staff["type"],
      phone: s(x.phone), email: s(x.email), qualification: s(x.qualification), since: s(x.since), status: (x.status === "On leave" ? "On leave" : "Active") as T.Staff["status"],
      classIds: [...new Set(a.map((y) => s(y.class_id)))], subjects: [...new Set(a.filter((y) => y.subject_id).map((y) => subjName[s(y.subject_id)]))] }; });

  const guardians: T.Guardian[] = gRows.map((g) => ({ id: s(g.id), title: s(g.title), name: s(g.name), phone: s(g.phone), whatsapp: s(g.whatsapp) || undefined, email: s(g.email) || undefined,
    address: s(g.address), occupation: s(g.occupation) || undefined, preferred: (s(g.preferred_channel) || "SMS") as T.Channel, language: s(g.language) || "English",
    consent: { SMS: !!g.consent_sms, WhatsApp: !!g.consent_whatsapp, Email: !!g.consent_email }, hasAccount: false }));

  const students: T.Student[] = stRows.map((x) => ({ id: s(x.id), admissionNo: s(x.admission_no), first: s(x.first_name), middle: s(x.middle_name) || undefined, last: s(x.last_name),
    dob: s(x.date_of_birth), gender: (s(x.gender) || "Female") as T.Student["gender"], classId: s(x.class_id), status: s(x.status) as T.Student["status"], admittedOn: s(x.admitted_on),
    nationality: s(x.nationality), address: s(x.address), previousSchool: s(x.previous_school) || undefined, scholarship: s(x.scholarship) || undefined,
    medicalAlert: s((x.student_medical as Row | null)?.alert) || undefined,
    guardians: ((x.student_guardians as Row[]) ?? []).map((g) => ({ guardianId: s(g.guardian_id), relationship: s(g.relationship), primary: !!g.is_primary, legal: !!g.is_legal, emergency: !!g.is_emergency,
      pickup: !!g.can_pickup, financial: !!g.is_financial, financialShare: g.financial_share == null ? undefined : n(g.financial_share), receivesFeeReminders: !!g.gets_fee_reminders,
      receivesAcademic: !!g.gets_academic, verified: true, restriction: s(g.restriction) || undefined })) }));

  const lines = (r: Row) => ((r.invoice_lines as Row[]) ?? []).sort((a, b) => n(a.position) - n(b.position)).map((l) => ({ label: s(l.label), amount: n(l.amount) }));
  const invoices: T.Invoice[] = invRows.filter((r) => r.status === "issued").map((r) => { const t = termById[s(r.term_id)];
    return { id: s(r.id), no: s(r.no), account: s(r.account) as FeeAccount, studentId: s(r.student_id), term: t?.term ?? "", year: t?.year ?? "", items: lines(r), discount: n(r.discount), billedOn: s(r.billed_on), dueOn: s(r.due_on) }; });
  const drafts: DraftInvoice[] = invRows.filter((r) => r.status === "draft" || r.status === "submitted").map((r) => { const t = termById[s(r.term_id)];
    return { id: s(r.id), no: s(r.no) || undefined, account: s(r.account) as FeeAccount, studentId: s(r.student_id), term: t?.term ?? "", year: t?.year ?? "", status: r.status as "draft" | "submitted", items: lines(r), returnNote: s(r.return_note) || undefined }; });
  const payments: T.Payment[] = payRows.map((p) => ({ id: s(p.id), receiptNo: s(p.receipt_no), account: s(p.account) as FeeAccount, studentId: s(p.student_id), guardianId: s(p.guardian_id) || undefined,
    amount: n(p.amount), method: s(p.method) as T.PayMethod, date: s(p.paid_on), ref: s(p.reference), status: cap(s(p.status)) as T.Payment["status"], staff: who(p.received_by), note: s(p.reversal_reason) || s(p.note) || undefined,
    feeding: n(p.feeding_amount) || undefined, feedingPeriod: (s(p.feeding_period) || undefined) as T.Payment["feedingPeriod"] }));

  // Fee schedule per term: level lines + feeding, class exceptions, activity prices.
  const lvl = (tid: string, level: string) => ({ items: items.filter((i) => i.term_id === tid && i.level === level).map((i): FeeItem => ({ label: s(i.label), amount: n(i.amount) })),
    feeding: n(levels.find((l) => l.term_id === tid && l.level === level)?.feeding) });
  const feeTerms = new Set([...items, ...levels, ...prices, ...overrides].map((r) => s(r.term_id)));
  const feeSchedule: TermFees[] = terms.filter((t) => feeTerms.has(t.id)).map((t) => ({ year: t.year, term: t.term,
    levels: { Kindergarten: lvl(t.id, "Kindergarten"), Primary: lvl(t.id, "Primary"), JHS: lvl(t.id, "JHS") },
    overrides: overrides.filter((o) => o.term_id === t.id).reduce<Record<string, FeeItem[]>>((a, o) => { (a[s(o.class_id)] ??= []).push({ label: s(o.label), amount: n(o.amount) }); return a; }, {}),
    activities: Object.fromEntries(acts.map((a) => [s(a.name), n(prices.find((p) => p.term_id === t.id && p.activity === a.name)?.amount)])) }));

  const batchById = Object.fromEntries(batches.map((b) => [s(b.id), b]));
  const grades: T.GradeRow[] = gradeRows.map((g) => ({ studentId: s(g.student_id), subject: subjName[s(batchById[s(g.batch_id)]?.subject_id)] ?? "", ca: n(g.ca), exam: n(g.exam) }));
  const hand = Object.fromEntries(onHand.map((h) => [s(h.item_id), n(h.on_hand)]));
  const inventory: T.InventoryItem[] = invItems.map((i) => ({ id: s(i.id), sku: s(i.sku), name: s(i.name), category: s(i.category), unit: s(i.unit), location: s(i.location), supplier: s(i.supplier),
    cost: n(i.unit_cost), reorder: n(i.reorder_level), max: n(i.max_level), kind: s(i.kind) as T.InventoryItem["kind"], onHand: hand[s(i.id)] ?? 0, expiry: s(i.expiry) || undefined }));
  const className = Object.fromEntries(classes.map((c) => [c.id, c.name]));

  const sheetMap: LiveData["sheets"] = {};
  for (const r of sheets) { const k = tkey(r.term_id); const id = r.kind === "class" ? s(r.class_id) : r.kind === "extra_classes" ? "classes" : "extra";
    (sheetMap[k] ??= {})[id] = { title: s(r.title), period: s(r.period), notes: s(r.notes), lines: (r.lines as ClassInvoice["lines"]) ?? [] }; }

  return {
    school: { name: s(settings[0]?.name) || "School", short: s(settings[0]?.short_name), city: s(settings[0]?.city), phone: s(settings[0]?.phone), email: s(settings[0]?.email), tier1: n(settings[0]?.expense_tier1_limit), tier2: n(settings[0]?.expense_tier2_limit) },
    calendar, terms, yearIds: Object.fromEntries(years.map((y) => [s(y.name), s(y.id)])), current: terms.find((t) => t.current),
    classes, classPositions: Object.fromEntries(classRows.map((c) => [s(c.id), n(c.position)])), subjects: subjectRows.map((x) => ({ id: s(x.id), name: s(x.name), level: s(x.level) })),
    staff, guardians, students, invoices, drafts, payments, feeSchedule,
    activities: acts.map((a) => ({ name: s(a.name), account: s(a.account) as FeeAccount, kindergarten: !!a.kindergarten_allowed })),
    enrolments: enrol.map((e) => ({ studentId: s(e.student_id), term: tkey(e.term_id), activity: s(e.activity) })),
    feedingPlans: plans.map((p) => ({ studentId: s(p.student_id), term: tkey(p.term_id), frequency: s(p.frequency) as PlanFrequency, from: s(p.effective_from), note: s(p.note) || undefined })),
    feedingExceptions: exc.map((e) => ({ studentId: s(e.student_id), term: tkey(e.term_id), onFeeding: !!e.on_feeding, rate: e.rate == null ? undefined : n(e.rate), reason: s(e.reason) })),
    meals: meals.map((m) => ({ date: s(m.on_date), classId: s(m.class_id), served: n(m.served) })),
    grades, gradeBatches: batches.map((b) => ({ id: s(b.id), classId: s(b.class_id), subjectId: s(b.subject_id), subject: subjName[s(b.subject_id)] ?? "", term: tkey(b.term_id), status: s(b.status), returnNote: s(b.return_note) || undefined })),
    gradeScale: scale.map((g) => ({ grade: s(g.grade), min: n(g.min_total), label: s(g.label) })).sort((a, b) => b.min - a.min),
    inventory,
    movements: moves.map((m) => ({ id: s(m.id), date: s(m.on_date), itemId: s(m.item_id), type: s(m.kind) as T.StockMovement["type"], qty: n(m.qty), ref: s(m.reference), staff: who(m.recorded_by),
      to: s(m.issued_to) || undefined, studentId: s(m.student_id) || undefined, returnRequired: !!m.return_required })),
    expenses: exp.map((e) => ({ id: s(e.id), no: s(e.no), date: s(e.on_date), category: s(e.category), vendor: s(e.vendor), amount: n(e.amount), method: s(e.method), department: s(e.department),
      status: s(e.status) as T.Expense["status"], approver: who(e.decided_by), description: s(e.description) })),
    budget: budget.map((b) => ({ category: s(b.category), amount: n(b.amount) })),
    messages: msgs.map((m) => ({ id: s(m.id), date: s(m.created_at).slice(0, 10), guardianId: s(m.guardian_id), studentIds: ((m.student_ids as string[]) ?? []).map(String), channel: s(m.channel) as T.Channel,
      template: s(m.template), amount: m.amount == null ? undefined : n(m.amount), status: (s(m.status) === "Recorded" ? "Sent" : s(m.status)) as T.Message["status"], sender: who(m.sent_by), failure: s(m.failure) || undefined })),
    approvals: pend.map((p) => ({ id: s(p.id), kind: s(p.kind), title: s(p.title), requester: "", amount: p.amount == null ? undefined : n(p.amount), date: s(p.since).slice(0, 10),
      module: /invoice|adjust/i.test(s(p.kind)) ? "Fees" : /expense/i.test(s(p.kind)) ? "Finance" : /grade/i.test(s(p.kind)) ? "Academics" : "General" })),
    audit: [...audit].reverse().slice(0, 300).map((a) => ({ id: s(a.id), at: s(a.at), actor: s(a.actor_name) || who(a.actor) || "System", action: s(a.action), target: s(a.table_name).replace("public.", ""), module: s(a.table_name).replace("public.", "") })),
    events: events.map((e) => ({ id: s(e.id), date: s(e.on_date), title: s(e.title), kind: s(e.kind) as T.SchoolEvent["kind"] })),
    applicants: apps.map((a) => ({ id: s(a.id), name: s(a.name), classApplied: className[s(a.class_applied_id)] ?? "", classId: s(a.class_applied_id), stage: s(a.stage) as T.Applicant["stage"], date: s(a.applied_on), guardian: s(a.guardian_name), phone: s(a.guardian_phone) })),
    attendance: att.map((a) => ({ studentId: s(a.student_id), date: s(a.on_date), status: s(a.status), note: s(a.note) || undefined })),
    sheets: sheetMap, names: nm,
  };
}
