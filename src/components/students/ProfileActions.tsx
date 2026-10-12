"use client";
import { useState } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { RecordPaymentDialog, type PayStudent } from "@/components/fees/RecordPaymentDialog";
import { useRole } from "@/components/shell/AppShell";

export function RecordPaymentButton({ student, usedRefs, size = "md" }: { student: PayStudent; usedRefs: string[]; size?: "sm" | "md" }) {
  const [o, setO] = useState(false); const { can } = useRole();
  if (!can("fees")) return null;
  return <><Button variant="primary" size={size} onClick={() => setO(true)}><Receipt size={14} />Record payment</Button><RecordPaymentDialog open={o} onClose={() => setO(false)} students={[student]} studentId={student.id} usedRefs={usedRefs} /></>;
}
