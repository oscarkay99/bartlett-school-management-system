"use client";
import { useState } from "react";
import { Button, Field, inputClass } from "./primitives";
import { Modal } from "./interactive";
import type { ReactNode } from "react";

export interface FieldDef { key: string; label: string; type?: "text" | "tel" | "email" | "date" | "number" | "select" | "textarea" | "checkbox"; options?: string[]; required?: boolean; hint?: string; span?: 2; validate?: (v: string, all: Record<string, string>) => string | undefined }
export type Values = Record<string, string>;

// Generic add/edit form. `extra` renders below the fields (e.g. duplicate warnings).
export function RecordDialog({ open, onClose, title, fields, initial, submitLabel = "Save", onSubmit, extra, blocked }: {
  open: boolean; onClose: () => void; title: string; fields: FieldDef[]; initial: Values; submitLabel?: string;
  onSubmit: (v: Values) => void; extra?: (v: Values) => ReactNode; blocked?: (v: Values) => string | undefined;
}) {
  const [v, setV] = useState<Values>(initial); const [touched, setTouched] = useState(false);
  const err = (f: FieldDef) => (f.required && !v[f.key]?.trim() ? `${f.label} is required` : v[f.key] ? f.validate?.(v[f.key], v) : undefined);
  const hasErr = fields.some((f) => err(f)); const block = blocked?.(v);
  const submit = () => { setTouched(true); if (hasErr || block) return; onSubmit(v); setTouched(false); };
  return (
    <Modal open={open} onClose={onClose} wide title={title} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>{submitLabel}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const e = touched ? err(f) : undefined; const wrap = f.span === 2 || f.type === "textarea" ? "sm:col-span-2" : "";
          if (f.type === "checkbox") return <label key={f.key} className={`flex items-center gap-2 text-sm ${wrap}`}><input type="checkbox" checked={v[f.key] === "1"} onChange={(ev) => setV({ ...v, [f.key]: ev.target.checked ? "1" : "" })} />{f.label}</label>;
          return (
            <div key={f.key} className={wrap}><Field label={`${f.label}${f.required ? " *" : ""}`} hint={f.hint} error={e}>
              {f.type === "select" ? <select className={inputClass} value={v[f.key] ?? ""} onChange={(ev) => setV({ ...v, [f.key]: ev.target.value })}>{!f.required && <option value="">—</option>}{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                : f.type === "textarea" ? <textarea className={`${inputClass} h-20 py-2`} value={v[f.key] ?? ""} onChange={(ev) => setV({ ...v, [f.key]: ev.target.value })} />
                : <input className={inputClass} type={f.type === "number" ? "text" : f.type ?? "text"} inputMode={f.type === "number" ? "decimal" : f.type === "tel" ? "tel" : undefined} value={v[f.key] ?? ""} onChange={(ev) => setV({ ...v, [f.key]: f.type === "number" ? ev.target.value.replace(/[^\d.]/g, "") : ev.target.value })} />}
            </Field></div>
          );
        })}
      </div>
      {extra && <div className="mt-4">{extra(v)}</div>}
      {touched && block && <p role="alert" className="mt-3 text-sm text-danger">{block}</p>}
    </Modal>
  );
}
