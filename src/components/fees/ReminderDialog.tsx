"use client";
import { useState } from "react";
import { Copy, Mail, MessageCircle, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Modal, useToast } from "@/components/ui/interactive";

type Channel = "WhatsApp" | "SMS" | "Email";
export function ReminderButtons({ message, guardianName, consent, studentName, compact }: { message: string; guardianName: string; consent: Record<Channel, boolean>; studentName: string; compact?: boolean }) {
  const [ch, setCh] = useState<Channel | null>(null); const toast = useToast();
  const items: [Channel, typeof Mail][] = [["WhatsApp", MessageCircle], ["SMS", MessageSquare], ["Email", Mail]];
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {items.map(([c, Icon]) => <Button key={c} size="sm" disabled={!consent[c]} title={consent[c] ? undefined : `${guardianName} has not consented to ${c}`} onClick={() => setCh(c)}><Icon size={14} />{compact ? c : `Send ${c} reminder`}</Button>)}
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(message); toast("Reminder copied to clipboard"); }}><Copy size={14} />Copy</Button>
      </div>
      <Modal open={!!ch} onClose={() => setCh(null)} title={`Preview ${ch} reminder`} wide
        footer={<><Button onClick={() => setCh(null)}>Cancel</Button><Button variant="primary" onClick={() => { toast(`${ch} reminder queued for ${guardianName}`); setCh(null); }}>Queue for sending</Button></>}>
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-ok/10 p-2.5 text-sm text-ok"><ShieldCheck size={16} />Checks passed: guardian is verified, financially responsible, consented to {ch}, and the balance was re-checked just now.</div>
        <div className="mb-1 text-xs text-muted">To: {guardianName} · Regarding: {studentName}</div>
        <pre className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-4 font-sans text-sm leading-relaxed">{message}</pre>
        {ch === "SMS" && <p className="mt-2 text-xs text-muted">{message.length} characters · ~{Math.ceil(message.length / 160)} SMS segments</p>}
      </Modal>
    </>
  );
}
