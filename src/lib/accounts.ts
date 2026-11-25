// The two separately billed accounts, matching what parents receive: the school fees invoice (tuition, books,
// levies, PTA and feeding) and a standalone Extracurricular invoice (Music and STEM) that is never added to school fees. Each has its own invoices,
// receipts and balance; a payment only ever settles invoices in the account it was received for.
export type FeeAccount = "fees" | "extra";

export interface AccountDef {
  id: FeeAccount; label: string; noun: string; href: string; nav: string;
  invoicePrefix: string; receiptPrefix: string; invoiceTitle: string; receiptTitle: string; reminderTemplate: string;
}

export const ACCOUNTS: Record<FeeAccount, AccountDef> = {
  fees: { id: "fees", label: "School Fees", noun: "school fee", href: "/fees", nav: "fees", invoicePrefix: "INV", receiptPrefix: "RCT", invoiceTitle: "School Fees Invoice", receiptTitle: "Official Receipt — School Fees", reminderTemplate: "Fee Reminder" },
  extra: { id: "extra", label: "Extracurricular", noun: "extracurricular", href: "/extracurricular", nav: "extracurricular", invoicePrefix: "EXC", receiptPrefix: "XRC", invoiceTitle: "Extracurricular Invoice", receiptTitle: "Official Receipt — Extracurricular", reminderTemplate: "Extracurricular Reminder" },
};
export const ACCOUNT_IDS = Object.keys(ACCOUNTS) as FeeAccount[];

// Extracurricular activities offered, billed per term on the standalone Extracurricular invoice.
// Every student is enrolled: Kindergarten in Music (Piano) only, everyone else in both.
export const ACTIVITIES = ["Music (Piano)", "STEM"] as const;
export const activitiesFor = (level: string): Activity[] => (level === "Kindergarten" ? ["Music (Piano)"] : [...ACTIVITIES]);
export type Activity = (typeof ACTIVITIES)[number];
