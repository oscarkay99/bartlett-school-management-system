// The three separately billed accounts. Each has its own invoices, receipts and balance;
// a payment only ever settles invoices in the account it was received for.
export type FeeAccount = "fees" | "feeding" | "extra";

export interface AccountDef {
  id: FeeAccount; label: string; noun: string; href: string; nav: string;
  invoicePrefix: string; receiptPrefix: string; invoiceTitle: string; receiptTitle: string; reminderTemplate: string;
}

export const ACCOUNTS: Record<FeeAccount, AccountDef> = {
  fees: { id: "fees", label: "School Fees", noun: "school fee", href: "/fees", nav: "fees", invoicePrefix: "INV", receiptPrefix: "RCT", invoiceTitle: "School Fees Invoice", receiptTitle: "Official Receipt — School Fees", reminderTemplate: "Fee Reminder" },
  feeding: { id: "feeding", label: "Feeding", noun: "feeding", href: "/feeding", nav: "feeding", invoicePrefix: "FDG", receiptPrefix: "FRC", invoiceTitle: "Feeding Bill", receiptTitle: "Official Receipt — Feeding", reminderTemplate: "Feeding Reminder" },
  extra: { id: "extra", label: "Extracurricular", noun: "extracurricular", href: "/extracurricular", nav: "extracurricular", invoicePrefix: "EXC", receiptPrefix: "XRC", invoiceTitle: "Extracurricular Invoice", receiptTitle: "Official Receipt — Extracurricular", reminderTemplate: "Extracurricular Reminder" },
};
export const ACCOUNT_IDS = Object.keys(ACCOUNTS) as FeeAccount[];

// Extracurricular activities offered, billed per term.
export const ACTIVITIES = ["Music (Piano)", "STEM", "Extra Classes"] as const;
export type Activity = (typeof ACTIVITIES)[number];
