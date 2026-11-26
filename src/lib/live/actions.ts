"use client";
// Every change the app makes to the school database. Each returns "" on success or a message the user can act on.
// Rules (who may do what) are enforced by the database's row-level security and functions, not here.
import { db, friendlyError } from "./client";
import { liveExtra } from "./hydrate";

const err = (e: { message?: string; code?: string } | null) => (e ? friendlyError(e) : "");
const data = () => { if (!liveExtra.data) throw new Error("The school's data has not loaded yet."); return liveExtra.data; };
/** "2026/2027|Term 1" (or year + term) → the term's database id. */
export const termId = (year: string, term: string) => data().terms.find((t) => t.year === year && t.term === term)?.id ?? "";
const termIdOfKey = (key: string) => { const [y, t] = key.split("|"); return termId(y, t); };

// ---------- Students & guardians ----------
export async function registerStudent(p: unknown) {
  const { data: r, error } = await db().rpc("register_student", { p });
  return error ? { error: err(error) } : { id: (r as { id: string }).id, adm: (r as { admission_no: string }).admission_no };
}
export async function updateStudent(id: string, v: { first?: string; middle?: string; last?: string; dob?: string; gender?: string; classId?: string; status?: string; address?: string }) {
  const row: Record<string, unknown> = {};
  if (v.first !== undefined) row.first_name = v.first.trim(); if (v.middle !== undefined) row.middle_name = v.middle.trim() || null; if (v.last !== undefined) row.last_name = v.last.trim();
  if (v.dob !== undefined) row.date_of_birth = v.dob || null; if (v.gender !== undefined) row.gender = v.gender || null; if (v.classId) row.class_id = v.classId;
  if (v.status) row.status = v.status; if (v.address !== undefined) row.address = v.address.trim() || null;
  const { error, count } = await db().from("students").update(row, { count: "exact" }).eq("id", id);
  return error ? err(error) : count === 0 ? "Your role is not allowed to change students." : "";
}
export async function saveMedical(studentId: string, v: { alert?: string; allergies?: string; instructions?: string }) {
  const { error } = await db().from("student_medical").upsert({ student_id: studentId, alert: v.alert || null, allergies: v.allergies || null, emergency_instructions: v.instructions || null });
  return err(error);
}
export async function saveGuardian(v: { id?: string; title?: string; name: string; phone: string; whatsapp?: string; email?: string; address?: string; occupation?: string; preferred?: string; language?: string; cSMS?: string; cWhatsApp?: string; cEmail?: string }) {
  const row = { title: v.title || null, name: v.name.trim(), phone: v.phone.trim(), whatsapp: v.whatsapp || null, email: v.email || null, address: v.address || null, occupation: v.occupation || null, preferred_channel: v.preferred || "SMS",
    language: v.language || "English", consent_sms: !!v.cSMS, consent_whatsapp: !!v.cWhatsApp, consent_email: !!v.cEmail };
  const q = v.id ? db().from("guardians").update(row, { count: "exact" }).eq("id", v.id) : db().from("guardians").insert(row, { count: "exact" });
  const { error, count } = await q; return error ? err(error) : count === 0 ? "Your role is not allowed to change parents." : "";
}
export async function linkGuardian(studentId: string, guardianId: string, v: { relationship: string; primary?: boolean; financial?: boolean; emergency?: boolean; pickup?: boolean; reminders?: boolean; academic?: boolean; legal?: boolean }) {
  const { error } = await db().from("student_guardians").upsert({ student_id: studentId, guardian_id: guardianId, relationship: v.relationship, is_primary: !!v.primary, is_financial: !!v.financial,
    is_emergency: !!v.emergency, can_pickup: !!v.pickup, gets_fee_reminders: !!v.reminders, gets_academic: !!v.academic, is_legal: !!v.legal, verified: true });
  return err(error);
}
/** New parent record; returns its id. */
export async function createGuardian(v: { title?: string; name: string; phone: string; email?: string }) {
  const { data: g, error } = await db().from("guardians").insert({ title: v.title || null, name: v.name.trim(), phone: v.phone.trim(), email: v.email?.trim() || null }).select("id").single();
  return error ? { error: err(error) } : { id: g.id as string };
}
export async function deleteGuardian(id: string) { const { error } = await db().from("guardians").delete().eq("id", id); return err(error); }
export async function unlinkGuardian(studentId: string, guardianId: string) {
  const { error } = await db().from("student_guardians").delete().eq("student_id", studentId).eq("guardian_id", guardianId); return err(error);
}

// ---------- Fees: schedule, invoices, payments ----------
export async function saveTermFees(tf: { year: string; term: string; levels: Record<string, { items: { label: string; amount: number }[]; feeding: number }>; overrides: Record<string, { label: string; amount: number }[]>; activities: Record<string, number> }) {
  const tid = termId(tf.year, tf.term); if (!tid) return `Add ${tf.term} ${tf.year} to the calendar first.`;
  // Replace the term's schedule (the database refuses this for a term that already has issued invoices).
  for (const t of ["term_fee_items", "class_fee_overrides", "activity_prices", "term_fee_levels"]) { const { error } = await db().from(t).delete().eq("term_id", tid); if (error) return err(error); }
  const items = Object.entries(tf.levels).flatMap(([level, l]) => l.items.map((i, position) => ({ term_id: tid, level, label: i.label, amount: i.amount, position })));
  const lv = Object.entries(tf.levels).map(([level, l]) => ({ term_id: tid, level, feeding: l.feeding }));
  const ov = Object.entries(tf.overrides).flatMap(([class_id, ls]) => ls.map((l) => ({ term_id: tid, class_id, label: l.label, amount: l.amount })));
  const ap = Object.entries(tf.activities).map(([activity, amount]) => ({ term_id: tid, activity, amount }));
  for (const [t, rows] of [["term_fee_levels", lv], ["term_fee_items", items], ["class_fee_overrides", ov], ["activity_prices", ap]] as const) {
    if (rows.length) { const { error } = await db().from(t).insert(rows as never); if (error) return err(error); }
  }
  // A term already billed: bring its issued invoices in line with the new fees (Owner only, recorded in the audit trail).
  if (data().invoices.some((i) => i.year === tf.year && i.term === tf.term)) { const { error } = await db().rpc("amend_term_invoices", { p_term: tid }); if (error) return err(error); }
  return "";
}
/** Creates draft invoices (one per student) and submits them for the Owner's approval. */
/** `approve`: also issue them at once (Owner only; the database refuses anyone else). */
export async function createInvoices(list: { studentId: string; account: string; year: string; term: string; items: { label: string; amount: number }[]; dueOn?: string; discount?: number }[], submit = true, approve = false) {
  const ids: string[] = [];
  for (const i of list) {
    const tid = termId(i.year, i.term); if (!tid) return `Add ${i.term} ${i.year} to the calendar first.`;
    const { data: inv, error } = await db().from("invoices").insert({ account: i.account, student_id: i.studentId, term_id: tid, due_on: i.dueOn || null, discount: i.discount ?? 0 }).select("id").single();
    if (error) return err(error);
    const { error: e2 } = await db().from("invoice_lines").insert(i.items.map((l, position) => ({ invoice_id: inv.id, label: l.label, amount: l.amount, position })));
    if (e2) return err(e2);
    ids.push(inv.id);
  }
  if (submit && ids.length) { const { error } = await db().rpc("submit_invoices", { p_ids: ids }); if (error) return err(error); }
  if (submit && approve && ids.length) { const { error } = await db().rpc("approve_invoices", { p_ids: ids }); if (error) return err(error); }
  return "";
}
/** Takes back invoices not yet approved: submitted ones are returned to draft, then all drafts are deleted. */
export async function discardInvoices(ids: string[]) {
  const d = data().drafts.filter((x) => ids.includes(x.id));
  for (const x of d.filter((y) => y.status === "submitted")) { const { error } = await db().rpc("return_invoice", { p_id: x.id, p_note: "Discarded" }); if (error) return err(error); }
  if (d.length) { const { error } = await db().from("invoices").delete().in("id", d.map((x) => x.id)); if (error) return err(error); }
  return "";
}
export async function approveInvoices(ids: string[]) { const { error } = await db().rpc("approve_invoices", { p_ids: ids }); return err(error); }
export async function returnInvoice(id: string, note: string) { const { error } = await db().rpc("return_invoice", { p_id: id, p_note: note }); return err(error); }
export async function recordPayment(p: { account: string; studentId: string; guardianId?: string; amount: number; method: string; date: string; ref?: string; note?: string; feedingAmount?: number; feedingPeriod?: string }) {
  const { data: r, error } = await db().from("payments").insert({ account: p.account, student_id: p.studentId, guardian_id: p.guardianId || null, amount: p.amount, method: p.method, paid_on: p.date,
    reference: p.ref?.trim() || null, note: p.note?.trim() || null, feeding_amount: p.feedingAmount ?? 0, feeding_period: p.feedingPeriod ?? null }).select("id, receipt_no").single();
  return error ? { error: err(error) } : { id: r.id as string, receipt: r.receipt_no as string };
}
export async function reversePayment(id: string, reason: string) { const { error } = await db().rpc("reverse_payment", { p_id: id, p_reason: reason }); return err(error); }
export async function confirmPayment(id: string) { const { error } = await db().rpc("confirm_payment", { p_id: id }); return err(error); }
export async function enrolActivities(studentId: string, year: string, term: string, activities: string[]) {
  const tid = termId(year, term); const { error } = await db().from("student_activities").upsert(activities.map((activity) => ({ student_id: studentId, term_id: tid, activity })));
  return err(error);
}
export async function saveInvoiceSheet(termKey: string, sheetId: string, sheet: { title: string; period: string; notes: string; lines: { description: string; amount: number }[] }) {
  const term_id = termIdOfKey(termKey); const kind = sheetId === "extra" ? "extracurricular" : sheetId === "classes" ? "extra_classes" : "class";
  const row = { term_id, kind, class_id: kind === "class" ? sheetId : null, title: sheet.title, period: sheet.period, notes: sheet.notes, lines: sheet.lines, updated_at: new Date().toISOString() };
  const { error } = await db().from("invoice_sheets").upsert(row, { onConflict: "term_id,kind,class_id" }); return err(error);
}
export async function sendMessage(m: { guardianId: string; studentIds: string[]; channel: string; template: string; body: string; amount?: number }) {
  const { error } = await db().from("messages").insert({ guardian_id: m.guardianId, student_ids: m.studentIds, channel: m.channel, template: m.template, body: m.body, amount: m.amount ?? null, status: "Recorded" });
  return err(error);
}

// ---------- Feeding ----------
export async function setFeedingPlan(p: { studentId: string; term: string; frequency: string; from: string; note?: string }) {
  const { error } = await db().from("feeding_plans").upsert({ student_id: p.studentId, term_id: termIdOfKey(p.term), frequency: p.frequency, effective_from: p.from, note: p.note ?? null }, { onConflict: "student_id,term_id,effective_from" });
  return err(error);
}
export async function setFeedingException(studentId: string, term: string, ex: { onFeeding: boolean; rate?: number; reason: string } | null) {
  const term_id = termIdOfKey(term);
  if (!ex) { const { error } = await db().from("feeding_exceptions").delete().eq("student_id", studentId).eq("term_id", term_id); return err(error); }
  const { error } = await db().from("feeding_exceptions").upsert({ student_id: studentId, term_id, on_feeding: ex.onFeeding, rate: ex.rate ?? null, reason: ex.reason }); return err(error);
}
export async function saveMeals(date: string, rows: { classId: string; served: number }[]) {
  const { error } = await db().from("meal_register").upsert(rows.map((r) => ({ on_date: date, class_id: r.classId, served: r.served }))); return err(error);
}

// ---------- Calendar & settings ----------
export async function addYear(y: { name: string; start: string; end: string }) { const { error } = await db().from("academic_years").insert({ name: y.name, starts_on: y.start, ends_on: y.end }); return err(error); }
export async function addTerm(year: string, t: { name: string; start: string; end: string }) {
  const yid = data().yearIds[year]; if (!yid) return "Unknown academic year.";
  const { error } = await db().from("terms").insert({ year_id: yid, name: t.name, starts_on: t.start, ends_on: t.end }); return err(error);
}
export async function saveSchool(v: { name?: string; phone?: string; email?: string; city?: string }) {
  const { error, count } = await db().from("school_settings").update({ ...v, updated_at: new Date().toISOString() }, { count: "exact" }).eq("id", true);
  return error ? err(error) : count === 0 ? "Only the Owner can change the school profile." : "";
}

// ---------- Attendance & academics ----------
export async function saveAttendance(date: string, marks: { studentId: string; status: string; note?: string }[]) {
  const { error } = await db().from("attendance").upsert(marks.map((m) => ({ student_id: m.studentId, on_date: date, status: m.status, note: m.note ?? null }))); return err(error);
}
export async function saveGrades(classId: string, subject: string, year: string, term: string, rows: { studentId: string; ca: number; exam: number }[], submit: boolean) {
  const d = data(); const tid = termId(year, term); const lvl = d.classes.find((c) => c.id === classId)?.level;
  const subj = d.subjects.find((x) => x.name === subject && (!lvl || x.level === lvl)) ?? d.subjects.find((x) => x.name === subject);
  if (!subj) return `Subject "${subject}" is not set up in the database.`;
  let batch = d.gradeBatches.find((b) => b.classId === classId && b.subjectId === subj.id && b.term === `${year}|${term}`)?.id;
  if (!batch) { const { data: b, error } = await db().from("grade_batches").insert({ class_id: classId, subject_id: subj.id, term_id: tid }).select("id").single(); if (error) return err(error); batch = b.id; }
  const { error } = await db().from("grades").upsert(rows.map((r) => ({ batch_id: batch, student_id: r.studentId, ca: r.ca, exam: r.exam }))); if (error) return err(error);
  if (submit) { const { error: e2 } = await db().rpc("submit_grade_batch", { p_id: batch }); if (e2) return err(e2); }
  return "";
}
export async function decideGrades(batchId: string, approve: boolean, note = "") {
  const { error } = await db().rpc("decide_grade_batch", { p_id: batchId, p_approve: approve, p_note: note }); return err(error);
}
export async function publishGrades(batchId: string) { const { error } = await db().rpc("publish_grade_batch", { p_id: batchId }); return err(error); }
export async function voidInvoice(id: string, reason: string) { const { error } = await db().rpc("void_invoice", { p_id: id, p_reason: reason }); return err(error); }
export async function markExpensePaid(id: string) { const { error } = await db().rpc("mark_expense_paid", { p_id: id }); return err(error); }
export async function requestAdjustment(invoiceId: string, amount: number, reason: string) {
  const { error } = await db().from("invoice_adjustments").insert({ invoice_id: invoiceId, amount, reason }); return err(error);
}
export async function decideAdjustment(id: string, approve: boolean) { const { error } = await db().rpc("decide_adjustment", { p_id: id, p_approve: approve }); return err(error);
}

// ---------- Inventory & finance ----------
export async function saveItem(v: { id?: string; sku: string; name: string; category: string; unit: string; location: string; supplier: string; cost: number; reorder: number; max: number; kind: string; expiry?: string }) {
  const row = { sku: v.sku, name: v.name, category: v.category, unit: v.unit, location: v.location, supplier: v.supplier, unit_cost: v.cost, reorder_level: v.reorder, max_level: v.max, kind: v.kind, expiry: v.expiry || null };
  const { error } = v.id ? await db().from("inventory_items").update(row).eq("id", v.id) : await db().from("inventory_items").insert(row); return err(error);
}
export async function deleteItem(id: string) {
  const { error } = await db().from("inventory_items").delete().eq("id", id);
  return error?.code === "23503" ? "This item has stock movements on record, so it can't be deleted (the ledger is kept for audit)." : err(error);
}
export async function moveStock(v: { itemId: string; date: string; type: string; qty: number; ref?: string; to?: string; studentId?: string; returnRequired?: boolean; note?: string }) {
  const { error } = await db().from("stock_movements").insert({ item_id: v.itemId, on_date: v.date, kind: v.type, qty: v.qty, reference: v.ref || null, issued_to: v.to || null, student_id: v.studentId || null, return_required: !!v.returnRequired, note: v.note || null });
  return err(error);
}
export async function requestExpense(v: { date: string; category: string; vendor: string; description: string; amount: number; method: string; department: string }) {
  const { error } = await db().from("expenses").insert({ on_date: v.date, category: v.category, vendor: v.vendor, description: v.description, amount: v.amount, method: v.method, department: v.department }); return err(error);
}
export async function updateExpense(id: string, v: { date: string; category: string; vendor: string; department: string; method: string }) {
  const { error } = await db().from("expenses").update({ on_date: v.date, category: v.category, vendor: v.vendor, department: v.department, method: v.method }).eq("id", id); return err(error);
}
export async function decideExpense(id: string, approve: boolean, note = "") { const { error } = await db().rpc("decide_expense", { p_id: id, p_approve: approve, p_note: note }); return err(error); }
export async function saveBudget(year: string, lines: { category: string; amount: number }[]) {
  const yid = data().yearIds[year]; const { error } = await db().from("budget_lines").upsert(lines.map((l) => ({ year_id: yid, category: l.category, amount: l.amount }))); return err(error);
}

// ---------- Admissions, staff, events ----------
export async function saveApplicant(v: { id?: string; name: string; classId: string; guardian: string; phone: string; stage: string; date?: string; notes?: string }) {
  const row = { name: v.name, class_applied_id: v.classId || null, guardian_name: v.guardian, guardian_phone: v.phone, stage: v.stage, applied_on: v.date || new Date().toISOString().slice(0, 10), notes: v.notes ?? null };
  const { error } = v.id ? await db().from("applicants").update(row).eq("id", v.id) : await db().from("applicants").insert(row); return err(error);
}
export async function setApplicantStage(id: string, stage: string) { const { error } = await db().from("applicants").update({ stage }).eq("id", id); return err(error); }
export async function saveStaff(v: { id?: string; empNo: string; name: string; position: string; department: string; type: string; phone?: string; email?: string; qualification?: string; since?: string; status?: string }) {
  const row = { emp_no: v.empNo, name: v.name, position: v.position, department: v.department, employment_type: v.type, phone: v.phone || null, email: v.email || null, qualification: v.qualification || null, since: v.since || null, status: v.status || "Active" };
  const { error } = v.id ? await db().from("staff").update(row).eq("id", v.id) : await db().from("staff").insert(row); return err(error);
}
export async function setStaffStatus(id: string, status: string) { const { error } = await db().from("staff").update({ status }).eq("id", id); return err(error); }
export async function saveLimits(t1: number, t2: number) {
  const { error, count } = await db().from("school_settings").update({ expense_tier1_limit: t1, expense_tier2_limit: t2 }, { count: "exact" }).eq("id", true);
  return error ? err(error) : count === 0 ? "Only the Owner can change approval limits." : "";
}
/** Replaces a staff member's class-teacher assignments (subject = all). */
export async function setTeacherClasses(staffId: string, classIds: string[]) {
  const { error } = await db().from("teaching_assignments").delete().eq("staff_id", staffId).is("subject_id", null); if (error) return err(error);
  if (!classIds.length) return "";
  const { error: e2 } = await db().from("teaching_assignments").insert(classIds.map((class_id) => ({ staff_id: staffId, class_id, subject_id: null }))); return err(e2);
}
export async function assignTeacher(staffId: string, classId: string, subjectId: string | null) {
  const { error } = await db().from("teaching_assignments").insert({ staff_id: staffId, class_id: classId, subject_id: subjectId }); return err(error);
}
export async function saveEvent(v: { date: string; title: string; kind: string }) { const { error } = await db().from("school_events").insert({ on_date: v.date, title: v.title, kind: v.kind }); return err(error); }
