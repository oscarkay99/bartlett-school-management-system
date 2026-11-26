"use client";
import { useState } from "react";
import {  } from "lucide-react";
import { ReceiptCedi as Receipt } from "@/components/ui/icons";
import { Button } from "@/components/ui/primitives";
import { RecordPaymentDialog, type PayStudent } from "@/components/fees/RecordPaymentDialog";
import { useRole } from "@/components/shell/AppShell";
import { ACCOUNTS, type FeeAccount } from "@/lib/accounts";

export function RecordPaymentButton({ student, usedRefs, size = "md", account = "fees" }: { student: PayStudent; usedRefs: string[]; size?: "sm" | "md"; account?: FeeAccount }) {
  const [o, setO] = useState(false); const { can, allow } = useRole();
  if (!can(ACCOUNTS[account].nav) || !allow("payments", "create")) return null;
  return <><Button variant="primary" size={size} onClick={() => setO(true)}><Receipt size={14} />Record {ACCOUNTS[account].label.toLowerCase()} payment</Button><RecordPaymentDialog open={o} onClose={() => setO(false)} students={[student]} studentId={student.id} usedRefs={usedRefs} account={account} /></>;
}
