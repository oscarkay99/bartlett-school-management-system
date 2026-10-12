"use client";
import { Printer } from "lucide-react";
import type { ReactNode } from "react";
import { SCHOOL } from "@/lib/data/seed";
import { SchoolLogo } from "@/components/SchoolLogo";
export function PrintFrame({ title, children, landscape }: { title: string; children: ReactNode; landscape?: boolean }) {
  return (
    <div className="min-h-screen bg-neutral-200 p-2 sm:p-4 print:bg-white print:p-0">
      <style>{`@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm; }`}</style>
      <div className="no-print mx-auto mb-3 flex max-w-[210mm] items-center justify-between"><a href="javascript:history.back()" className="text-sm text-neutral-700">← Back</a><button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"><Printer size={14} />Print / Save PDF</button></div>
      <article className="mx-auto min-h-[297mm] max-w-[210mm] bg-white p-4 text-[12px] sm:p-[14mm] leading-relaxed text-neutral-900 shadow print:min-h-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-neutral-900 pb-3"><div className="flex items-center gap-3"><SchoolLogo size={64} /><div><div className="text-base font-bold">{SCHOOL.name}</div><div className="text-[11px] text-neutral-600">{SCHOOL.city} · {SCHOOL.phone} · {SCHOOL.email}</div></div></div><div className="text-right text-lg font-bold uppercase tracking-wide">{title}</div></header>
        {children}
      </article>
    </div>
  );
}
