// The two separately billed accounts, matching what parents receive: the school fees invoice (tuition, books,
// levies, PTA and feeding) and a standalone Extra Classes invoice (music, STEM, extra classes) that is never added to school fees. Each has its own invoices,
// receipts and balance; a payment only ever settles invoices in the account it was received for.
export type FeeAccount = "fees" | "extra";

export interface AccountDef {
  id: FeeAccount; label: string; noun: string; href: string; nav: string;
  invoicePrefix: string; receiptPrefix: string; invoiceTitle: string; receiptTitle: string; reminderTemplate: string;
}

export const ACCOUNTS: Record<FeeAccount, AccountDef> = {
  fees: { id: "fees", label: "School Fees", noun: "school fee", href: "/fees", nav: "fees", invoicePrefix: "INV", receiptPrefix: "RCT", invoiceTitle: "School Fees Invoice", receiptTitle: "Official Receipt — School Fees", reminderTemplate: "Fee Reminder" },
  extra: { id: "extra", label: "Extra Classes", noun: "extra classes", href: "/extra-classes", nav: "extra-classes", invoicePrefix: "EXC", receiptPrefix: "XRC", invoiceTitle: "Extra Classes Invoice", receiptTitle: "Official Receipt — Extra Classes", reminderTemplate: "Extra Classes Reminder" },
};
export const ACCOUNT_IDS = Object.keys(ACCOUNTS) as FeeAccount[];

// Extra classes offered, billed per term on the standalone Extra Classes invoice.
export const ACTIVITIES = ["Music (Piano)", "STEM", "Extra Classes"] as const;
export type Activity = (typeof ACTIVITIES)[number];
