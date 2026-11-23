"use client";
import { useState } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "@/components/ui/primitives";
import { Modal, useToast } from "@/components/ui/interactive";
import { useCalendar } from "@/components/shell/CalendarContext";
import { useRole } from "@/components/shell/AppShell";
import { suggestTerm, suggestYear, validateTerm, validateYear, type AcademicYear, type Term } from "@/lib/calendar";
import { fmtDate } from "@/lib/utils";

export function AcademicCalendar() {
  const { calendar, year: current, term: currentTerm, setPeriod, addYear, addTerm } = useCalendar();
  const { allow } = useRole(); const canEdit = allow("settings", "create");
  const [yearOpen, setYearOpen] = useState(false); const [termFor, setTermFor] = useState<AcademicYear | null>(null);
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Academic years and their terms. New years and terms appear in the year/term selector at the top of every page.</p>
        {canEdit && <Button variant="primary" onClick={() => setYearOpen(true)}><CalendarPlus size={14} />Add academic year</Button>}
      </div>
      {calendar.map((y) => (
        <Card key={y.name}>
          <CardHeader title={y.name} sub={`${fmtDate(y.start)} – ${fmtDate(y.end)} · ${y.terms.length} term${y.terms.length === 1 ? "" : "s"}`}
            action={<div className="flex items-center gap-2">{y.name === current ? <Badge tone="ok">Selected</Badge> : <Button size="sm" variant="ghost" onClick={() => setPeriod(y.name)}>Select</Button>}{canEdit && <Button size="sm" onClick={() => setTermFor(y)}><Plus size={13} />Add term</Button>}</div>} />
          {y.terms.length === 0 ? <p className="border-t border-line px-4 py-3 text-sm text-muted">No terms yet — add one so this year can be selected.</p>
            : y.terms.map((t) => <div key={t.name} className="flex items-center justify-between gap-3 border-t border-line px-4 py-3"><span className="flex items-center gap-2"><b>{t.name}</b>{y.name === current && t.name === currentTerm && <Badge tone="info">Current</Badge>}</span><span className="text-sm text-muted">{fmtDate(t.start)} – {fmtDate(t.end)}</span></div>)}
        </Card>
      ))}
      {yearOpen && <AddYearDialog calendar={calendar} onClose={() => setYearOpen(false)} onAdd={addYear} />}
      {termFor && <AddTermDialog year={calendar.find((y) => y.name === termFor.name)!} onClose={() => setTermFor(null)} onAdd={(t) => addTerm(termFor.name, t)} />}
    </div>
  );
}

function AddYearDialog({ calendar, onClose, onAdd }: { calendar: AcademicYear[]; onClose: () => void; onAdd: (y: AcademicYear) => void }) {
  const toast = useToast(); const s = suggestYear(calendar);
  const [y, setY] = useState({ name: s.name, start: s.start, end: s.end }); const [withTerms, setWithTerms] = useState(s.terms.length > 0);
  const terms = s.terms.filter((t) => t.start >= y.start && t.end <= y.end);
  const err = validateYear(y, calendar);
  return (
    <Modal open onClose={onClose} title="Add academic year" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!err} onClick={() => { onAdd({ ...y, terms: withTerms ? terms : [] }); toast(`${y.name.trim()} added${withTerms && terms.length ? ` with ${terms.length} terms` : ""}`); onClose(); }}>Add year</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Academic year *" hint="Format: 2027/2028"><input className={inputClass} value={y.name} onChange={(e) => setY({ ...y, name: e.target.value })} /></Field></div>
        <Field label="Starts *"><input type="date" className={inputClass} value={y.start} onChange={(e) => setY({ ...y, start: e.target.value })} /></Field>
        <Field label="Ends *"><input type="date" className={inputClass} value={y.end} onChange={(e) => setY({ ...y, end: e.target.value })} /></Field>
        {s.terms.length > 0 && <label className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-line p-3 text-sm"><input type="checkbox" className="mt-0.5" checked={withTerms} onChange={(e) => setWithTerms(e.target.checked)} />
          <span><b>Also create terms</b> based on last year&apos;s dates (you can add more later)<span className="mt-1 block text-xs text-muted">{terms.length ? terms.map((t) => `${t.name}: ${fmtDate(t.start)} – ${fmtDate(t.end)}`).join(" · ") : "No suggested terms fall within these dates."}</span></span></label>}
        {err && <p role="alert" className="sm:col-span-2 text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

function AddTermDialog({ year, onClose, onAdd }: { year: AcademicYear; onClose: () => void; onAdd: (t: Term) => void }) {
  const toast = useToast(); const [t, setT] = useState<Term>(() => suggestTerm(year));
  const err = validateTerm(t, year);
  return (
    <Modal open onClose={onClose} title={`Add term to ${year.name}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!err} onClick={() => { onAdd(t); toast(`${t.name.trim()} added to ${year.name}`); onClose(); }}>Add term</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Term name *"><input className={inputClass} value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></Field></div>
        <Field label="Starts *"><input type="date" className={inputClass} min={year.start} max={year.end} value={t.start} onChange={(e) => setT({ ...t, start: e.target.value })} /></Field>
        <Field label="Ends *"><input type="date" className={inputClass} min={year.start} max={year.end} value={t.end} onChange={(e) => setT({ ...t, end: e.target.value })} /></Field>
        <p className="sm:col-span-2 text-xs text-muted">{year.name} runs {fmtDate(year.start)} – {fmtDate(year.end)}.{year.terms.length > 0 && ` Existing: ${year.terms.map((x) => `${x.name} (${fmtDate(x.start)} – ${fmtDate(x.end)})`).join(", ")}.`}</p>
        {err && <p role="alert" className="sm:col-span-2 text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}
