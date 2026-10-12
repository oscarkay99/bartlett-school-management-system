"use client";
import { useSearchParams } from "next/navigation";
import { FeesWorkspace } from "./FeesWorkspace";

type Props = Omit<React.ComponentProps<typeof FeesWorkspace>, "initialTab" | "openPay" | "overdueOnly">;
// Reads ?tab= / ?pay= / ?overdue= in the browser so the page can be statically exported.
export function FeesRoute(props: Props) {
  const sp = useSearchParams(); const tab = sp.get("tab") ?? undefined;
  return <FeesWorkspace key={`${tab}|${sp.get("overdue")}|${sp.get("pay")}`} {...props} initialTab={tab} openPay={sp.get("pay") === "1"} overdueOnly={sp.get("overdue") === "1"} />;
}
