// The two separately billed accounts, matching what parents receive: the school fees invoice (tuition, books,
// levies, PTA and feeding), plus two standalone accounts never added to school fees: Extracurricular (Music and STEM) and
// Extra Classes. Each has its own invoices,
// receipts and balance; a payment only ever settles invoices in the account it was received for.
export type FeeAccount = "fees" | "extra" | "classes";

export interface AccountDef {
  id: FeeAccount; label: string; noun: string; href: string; nav: string;
  invoicePrefix: string; receiptPrefix: string; invoiceTitle: string; receiptTitle: string; reminderTemplate: string;
}

export const ACCOUNTS: Record<FeeAccount, AccountDef> = {
  fees: { id: "fees", label: "School Fees", noun: "school fee", href: "/fees", nav: "fees", invoicePrefix: "INV", receiptPrefix: "RCT", invoiceTitle: "School Fees Invoice", receiptTitle: "Official Receipt — School Fees", reminderTemplate: "Fee Reminder" },
  extra: { id: "extra", label: "Extracurricular", noun: "extracurricular", href: "/extracurricular", nav: "extracurricular", invoicePrefix: "EXC", receiptPrefix: "XRC", invoiceTitle: "Extracurricular Invoice", receiptTitle: "Official Receipt — Extracurricular", reminderTemplate: "Extracurricular Reminder" },
  classes: { id: "classes", label: "Extra Classes", noun: "extra classes", href: "/extra-classes", nav: "extra-classes", invoicePrefix: "XCL", receiptPrefix: "XCR", invoiceTitle: "Extra Classes Invoice", receiptTitle: "Official Receipt — Extra Classes", reminderTemplate: "Extra Classes Reminder" },
};
export const ACCOUNT_IDS = Object.keys(ACCOUNTS) as FeeAccount[];

// What each standalone account bills per term (prices are set in Settings → Fee schedule).
// Music (Piano): KG 1 – Class 6. STEM: Class 1 – JHS 3. Extra Classes: every level. All compulsory (billed automatically).
export const ACCOUNT_ACTIVITIES = { extra: ["Music (Piano)", "STEM"], classes: ["Extra Classes"] } as const;
export const ACTIVITIES = [...ACCOUNT_ACTIVITIES.extra, ...ACCOUNT_ACTIVITIES.classes] as const;
export type Activity = (typeof ACTIVITIES)[number];
export const activitiesOf = (account: FeeAccount): Activity[] => (account === "fees" ? [] : [...ACCOUNT_ACTIVITIES[account]]);
/** Which levels take each activity (mirrors activities.levels in the database). */
export const ACTIVITY_LEVELS: Record<Activity, readonly string[]> = { "Music (Piano)": ["Kindergarten", "Primary"], "STEM": ["Primary", "JHS"], "Extra Classes": ["Creche", "Nursery", "Kindergarten", "Primary", "JHS"] };
/** What a student of this level takes. */
export const activitiesFor = (level: string, account: FeeAccount = "extra"): Activity[] => activitiesOf(account).filter((a) => ACTIVITY_LEVELS[a]?.includes(level));
