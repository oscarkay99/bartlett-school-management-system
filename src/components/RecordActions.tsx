"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/interactive";
import { RecordDialog, type FieldDef, type Values } from "@/components/ui/RecordDialog";
import { useRole } from "@/components/shell/AppShell";
import { PARENT_FIELDS } from "@/components/ParentsTable";
import type { Resource } from "@/lib/permissions";
import { LIVE } from "@/lib/live/config";
import { useSave } from "@/lib/live/useSave";
import { deleteGuardian, saveGuardian, updateStudent } from "@/lib/live/actions";
import * as Q from "@/lib/data/queries";

export function ParentRecordActions({ id, initial, soleFor }: { id: string; initial: Values; soleFor: string[] }) {
  const { allow } = useRole(); const toast = useToast(); const run = useSave(); const router = useRouter(); const [edit, setEdit] = useState(false); const [del, setDel] = useState(false);
  return (
    <>
      {allow("parents", "edit") && <Button onClick={() => setEdit(true)}><Pencil size={14} />Edit</Button>}
      {allow("parents", "delete") && <Button variant="danger" onClick={() => setDel(true)}><Trash2 size={14} />Delete</Button>}
      {edit && <RecordDialog open onClose={() => setEdit(false)} title={`Edit ${initial.name}`} fields={PARENT_FIELDS} initial={initial} submitLabel="Save changes" onSubmit={async (v) => { if (LIVE) { if (await run(() => saveGuardian({ ...(v as Record<string, string>), id, name: v.name, phone: v.phone }), `${v.name} updated`)) setEdit(false); return; } toast(`${initial.name} updated`); setEdit(false); }} />}
      <Modal open={del && soleFor.length > 0} onClose={() => setDel(false)} title="Can't delete this parent" footer={<Button onClick={() => setDel(false)}>OK</Button>}>
        <p>{initial.name} is the <b>only guardian</b> of {soleFor.join(", ")}. Every student must stay tied to at least one parent. Link another guardian first.</p></Modal>
      <ConfirmDialog open={del && soleFor.length === 0} onClose={() => setDel(false)} needReason danger confirmLabel="Delete parent" title={`Delete ${initial.name}`} body="The parent record and its child links are removed; students' fee history is kept. Recorded in the audit trail." onConfirm={async () => { if (LIVE) { if (await run(() => deleteGuardian(id), `${initial.name} deleted`)) router.push("/parents"); return; } toast(`${initial.name} deleted`); router.push("/parents"); }} />
    </>
  );
}

const STUDENT_FIELDS = (classes: string[]): FieldDef[] => [
  { key: "first", label: "First name", required: true }, { key: "middle", label: "Middle name" }, { key: "last", label: "Last name", required: true },
  { key: "dob", label: "Date of birth", type: "date", required: true, validate: (v) => (v > Q.TODAY ? "Cannot be in the future" : undefined) },
  { key: "gender", label: "Gender", type: "select", options: ["Female", "Male"], required: true }, { key: "classId", label: "Class", type: "select", options: classes, required: true },
  { key: "status", label: "Enrolment status", type: "select", options: ["Active", "Suspended", "Withdrawn", "Graduated"], required: true }, { key: "address", label: "Residential address", span: 2 },
];
export function StudentRecordActions({ id, initial, classes, adm }: { id: string; initial: Values; classes: string[]; adm: string }) {
  const { allow } = useRole(); const toast = useToast(); const run = useSave(); const router = useRouter(); const [edit, setEdit] = useState(false); const [del, setDel] = useState(false); const [typed, setTyped] = useState(""); const [why, setWhy] = useState("");
  const name = `${initial.first} ${initial.last}`;
  return (
    <>
      {allow("students", "edit") && <Button onClick={() => setEdit(true)}><Pencil size={14} />Edit</Button>}
      {allow("students", "delete") && <Button variant="danger" onClick={() => setDel(true)}><Trash2 size={14} />Delete</Button>}
      {edit && <RecordDialog open onClose={() => setEdit(false)} title={`Edit ${name}`} fields={STUDENT_FIELDS(classes)} initial={initial} submitLabel="Save changes" onSubmit={async (v) => { if (LIVE) { const classId = Q.classes.find((c) => c.name === v.classId)?.id; if (await run(() => updateStudent(id, { first: v.first, middle: v.middle, last: v.last, dob: v.dob, gender: v.gender, classId, status: v.status, address: v.address }), `${v.first} ${v.last} updated`)) setEdit(false); return; } toast(`${name} updated`); setEdit(false); }} />}
      <Modal open={del} onClose={() => setDel(false)} title={`Delete ${name}`} footer={<><Button onClick={() => setDel(false)}>Cancel</Button><Button variant="danger" disabled={typed !== adm || why.trim().length < 5} onClick={async () => { if (LIVE) { // live: archived as Withdrawn; invoices, payments and the ledger stay
            if (await run(() => updateStudent(id, { status: "Withdrawn" }), `${name} archived (Withdrawn). Financial history kept.`)) router.push("/students"); return; }
          toast(`${name} deleted. Financial history retained in the archive.`); router.push("/students"); }}>{LIVE ? "Archive student" : "Delete student"}</Button></>}>
        <div className="space-y-3 text-sm"><p>This removes the student from active lists. <b>Invoices, payments and the ledger are never deleted</b> — they are kept in the archive for audit and accounting.</p>
          <Field label={`Type the admission number (${adm}) to confirm`}><input className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
          <Field label="Reason (logged)"><textarea className={`${inputClass} h-16 py-2`} value={why} onChange={(e) => setWhy(e.target.value)} /></Field></div>
      </Modal>
    </>
  );
}
export type { Resource };
