"use client";
// "Payment is for": a term and year from the academic calendar (newest first). Value is "2026/2027|Term 1".
import { useCalendar } from "@/components/shell/CalendarContext";
import { inputClass } from "@/components/ui/primitives";

export const splitTerm = (key: string) => { const [year, term] = key.split("|"); return { year, term }; };

export function TermSelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const { calendar } = useCalendar();
  return (
    <select aria-label="Payment is for" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {calendar.flatMap((y) => y.terms.map((t) => <option key={`${y.name}|${t.name}`} value={`${y.name}|${t.name}`}>{t.name}, {y.name}</option>))}
    </select>
  );
}
