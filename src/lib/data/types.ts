import type { Minor } from "../money";
import type { FeeAccount } from "../accounts";
export type { FeeAccount };

export type Channel = "SMS" | "WhatsApp" | "Email";
export type PayMethod = "Cash" | "Mobile Money" | "Bank Transfer" | "Card" | "Cheque" | "Online Gateway" | "Sponsor";

export interface SchoolClass { id: string; name: string; level: "Creche" | "Nursery" | "Kindergarten" | "Primary" | "JHS"; teacherId: string; }
export interface Guardian {
  id: string; title: string; name: string; phone: string; whatsapp?: string; email?: string;
  address: string; occupation?: string; preferred: Channel; language: string;
  consent: Record<Channel, boolean>; hasAccount: boolean;
}
export interface StudentGuardian {
  guardianId: string; relationship: string; primary: boolean; legal: boolean; emergency: boolean;
  pickup: boolean; financial: boolean; financialShare?: number; receivesFeeReminders: boolean;
  receivesAcademic: boolean; verified: boolean; restriction?: string;
}
export interface Student {
  id: string; admissionNo: string; first: string; middle?: string; last: string; dob: string;
  gender: "Male" | "Female"; classId: string;
  status: "Active" | "Withdrawn" | "Graduated" | "Suspended"; admittedOn: string; nationality: string;
  address: string; previousSchool?: string; guardians: StudentGuardian[];
  medicalAlert?: string; scholarship?: string;
}
export interface InvoiceItem { label: string; amount: Minor }
export interface Invoice {
  id: string; no: string; account: FeeAccount; studentId: string; term: string; year: string; items: InvoiceItem[];
  discount: Minor; billedOn: string; dueOn: string;
}
export interface Payment {
  id: string; receiptNo: string; account: FeeAccount; studentId: string; guardianId?: string; amount: Minor; method: PayMethod;
  date: string; ref: string; status: "Confirmed" | "Pending" | "Reversed"; staff: string; note?: string;
  /** School fees payments only: how much of this payment is for feeding (feeding is billed on the school fees invoice). */
  feeding?: Minor;
  /** Set when the whole payment is for feeding, paid daily / weekly / monthly / for the term. */
  feedingPeriod?: FeedingPeriod;
}
export type FeedingPeriod = "Daily" | "Weekly" | "Monthly" | "Term";
export interface Staff {
  id: string; empNo: string; name: string; position: string; department: string; type: "Full-time" | "Part-time" | "Contract";
  phone: string; email: string; qualification: string; since: string; classIds: string[]; subjects: string[]; status: "Active" | "On leave";
}
export interface Subject { id: string; name: string; }
export interface GradeRow { studentId: string; subject: string; ca: number; exam: number; }
export interface InventoryItem {
  id: string; sku: string; name: string; category: string; unit: string; location: string; supplier: string;
  cost: Minor; reorder: number; max: number; kind: "Consumable" | "Reusable" | "Asset"; onHand: number; expiry?: string;
}
export interface StockMovement {
  id: string; date: string; itemId: string; type: "Received" | "Issued" | "Returned" | "Damaged" | "Lost" | "Adjustment" | "Opening";
  qty: number; ref: string; staff: string; to?: string;
}
export interface Expense {
  id: string; no: string; date: string; category: string; vendor: string; amount: Minor; method: string;
  department: string; status: "Approved" | "Pending Approval" | "Rejected" | "Paid"; approver: string; description: string;
}
export interface BudgetLine { category: string; budget: Minor; actual: Minor }
export interface Message {
  id: string; date: string; guardianId: string; studentIds: string[]; channel: Channel; template: string;
  amount?: Minor; status: "Delivered" | "Sent" | "Failed" | "Queued" | "Awaiting Approval"; sender: string; failure?: string;
}
export interface Approval { id: string; kind: string; title: string; requester: string; amount?: Minor; date: string; module: string }
export interface AuditEvent { id: string; at: string; actor: string; action: string; target: string; module: string }
export interface SchoolEvent { id: string; date: string; title: string; kind: "Exam" | "Holiday" | "Meeting" | "Event" }
export interface Applicant { id: string; name: string; classApplied: string; stage: "Submitted" | "Documents Reviewed" | "Assessment" | "Accepted" | "Registered" | "Enrolled"; date: string; guardian: string }
