import { Suspense } from "react";
import { NewReceipt } from "./NewReceipt";

export const metadata = { title: "Receipt — EduFlow" };
// The receipt for a payment just recorded: its details come in the link (see receiptLink). Suspense: it reads the URL.
export default function NewReceiptPage() { return <Suspense fallback={null}><NewReceipt /></Suspense>; }
