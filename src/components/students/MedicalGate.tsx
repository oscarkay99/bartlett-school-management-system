"use client";
import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button, EmptyState } from "@/components/ui/primitives";
import { ConfirmDialog, useToast } from "@/components/ui/interactive";
import { useRole } from "@/components/shell/AppShell";

// Field-level authorisation: only designated roles see medical data; others must justify (logged).
export function MedicalGate({ children }: { children: ReactNode }) {
  const { role } = useRole(); const [granted, setGranted] = useState(false); const [ask, setAsk] = useState(false); const toast = useToast();
  const allowed = role === "owner" || granted;
  if (allowed) return <>{children}</>;
  return (
    <>
      <EmptyState icon={Lock} title="Restricted medical information" body="Your role does not include medical access. Break-glass access requires a justification and is recorded in the audit trail." action={role === "teacher" || role === "storekeeper" || role === "auditor" ? undefined : <Button onClick={() => setAsk(true)}>Request temporary access</Button>} />
      <ConfirmDialog open={ask} onClose={() => setAsk(false)} needReason title="Access medical record" body="You are about to view restricted medical details." confirmLabel="Access & log" onConfirm={() => { setGranted(true); setAsk(false); toast("Access granted and logged"); }} />
    </>
  );
}
