"use client";
import { useSearchParams } from "next/navigation";
import { ReceiptDoc, type ReceiptData } from "@/components/ReceiptDoc";

const parse = (d: string | null): ReceiptData | null => {
  try { const r = JSON.parse(d ?? ""); return r && typeof r.receiptNo === "string" && Array.isArray(r.lines) && Number.isInteger(r.amount) ? r : null; } catch { return null; }
};

export function NewReceipt() {
  const r = parse(useSearchParams().get("d"));
  return r ? <ReceiptDoc r={r} /> : <p className="p-8 text-center text-sm">This receipt link is incomplete. Open the receipt from the payments list instead.</p>;
}
