"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/primitives";
import { StudentsTable, type StudentRow } from "./StudentsTable";
import { RegistrationWizard, type RegistrationPayload } from "./RegistrationWizard";
import { db, friendlyError } from "@/lib/live/client";
import { useRole } from "@/components/shell/AppShell";

interface DbStudent {
  id: string; admission_no: string; first_name: string; middle_name: string | null; last_name: string; status: string; class_id: string;
  classes: { name: string; position: number } | null;
  student_guardians: { verified: boolean; is_primary: boolean; guardians: { name: string } | null }[];
  student_medical: { alert: string | null; allergies: string | null } | null;
}
const fullName = (s: { first_name: string; middle_name: string | null; last_name: string }) => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
const feeStatus = (billed: number, balance: number) => (billed <= 0 ? "Not billed" : balance <= 0 ? "Paid in Full" : balance < billed ? "Partially Paid" : "Outstanding");

/** Hook: loads a query once (and again when `deps` change); `reload` re-runs it. */
function useLoad<T>(load: () => Promise<{ data: T | null; error: string }>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: "", loading: true });
  const [n, setN] = useState(0);
  useEffect(() => { let live = true; load().then((r) => live && setState({ ...r, loading: false })); return () => { live = false; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, reload: () => setN((x) => x + 1) };
}

/** Students list from the school database. Row-level security decides who appears: a teacher sees only their classes. */
export function LiveStudents() {
  const { money } = useRole();
  const st = useLoad<{ rows: StudentRow[]; classes: { id: string; name: string }[] }>(async () => {
    const [s, c, b] = await Promise.all([
      db().from("students").select("id, admission_no, first_name, middle_name, last_name, status, class_id, classes(name, position), student_guardians(verified, is_primary, guardians(name)), student_medical(alert, allergies)").order("last_name"),
      db().from("classes").select("id, name").order("position"),
      money === "none" ? Promise.resolve({ data: [], error: null }) : db().from("student_balances").select("student_id, billed, balance").eq("account", "fees"),
    ]);
    const err = s.error ?? c.error ?? b.error; if (err) return { data: null, error: friendlyError(err) };
    const bal = new Map((b.data as { student_id: string; billed: number; balance: number }[]).map((x) => [x.student_id, x]));
    const rows = (s.data as unknown as DbStudent[]).map((x): StudentRow => {
      const g = x.student_guardians ?? []; const f = bal.get(x.id);
      return { id: x.id, name: fullName(x), adm: x.admission_no, cls: x.classes?.name ?? "—", classId: x.class_id, status: x.status,
        fee: feeStatus(Number(f?.billed ?? 0), Number(f?.balance ?? 0)), balance: Number(f?.balance ?? 0),
        medical: !!(x.student_medical?.alert || x.student_medical?.allergies),
        guardians: g.map((y) => y.guardians?.name).filter(Boolean).join(", "), guardianCount: g.length };
    });
    return { data: { rows, classes: c.data ?? [] }, error: "" };
  }, [money]);
  if (st.loading) return <Card className="p-8 text-center text-sm text-muted">Loading students from the school database…</Card>;
  if (st.error) return <Card className="p-6 text-sm text-danger">Could not load students: {st.error}</Card>;
  if (!st.data!.rows.length) return <Card className="p-8 text-center text-sm text-muted">No students yet. Use <b>Register student</b> to add the first one.</Card>;
  return <Card><StudentsTable rows={st.data!.rows} classes={st.data!.classes} hrefFor={(id) => `/students/view?id=${id}`} /></Card>;
}

/** Registration against the database: real classes and guardians; saves everything in one transaction. */
export function LiveRegister() {
  const r = useLoad<{ classes: { id: string; name: string }[]; guardians: { id: string; name: string; phone: string; email?: string; children: number }[] }>(async () => {
    const [c, g] = await Promise.all([db().from("classes").select("id, name").order("position"), db().from("guardians").select("id, name, phone, email, student_guardians(student_id)").order("name")]);
    const err = c.error ?? g.error; if (err) return { data: null, error: friendlyError(err) };
    return { data: { classes: c.data ?? [], guardians: (g.data ?? []).map((x) => ({ id: x.id, name: x.name, phone: x.phone, email: x.email ?? undefined, children: (x.student_guardians as unknown[] | null)?.length ?? 0 })) }, error: "" };
  }, []);
  if (r.loading) return <Card className="p-8 text-center text-sm text-muted">Loading classes and guardians…</Card>;
  if (r.error) return <Card className="p-6 text-sm text-danger">Could not load the form: {r.error}</Card>;
  const save = async (p: RegistrationPayload) => {
    const { data, error } = await db().rpc("register_student", { p });
    if (error) return { error: friendlyError(error) };
    const d = data as { id: string; admission_no: string }; return { id: d.id, adm: d.admission_no };
  };
  return <RegistrationWizard guardians={r.data!.guardians} classes={r.data!.classes} nextAdm="assigned when saved" onRegister={save} />;
}

export { useLoad, fullName };
