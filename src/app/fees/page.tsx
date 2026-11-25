import { PageHeader } from "@/components/ui/primitives";
import { Suspense } from "react";
import { FeesRoute } from "@/components/fees/FeesRoute";
import { billingProps } from "@/lib/data/fees-view";

export const metadata = { title: "School Fees — EduFlow" };
export default function FeesPage() {
  return (<><PageHeader title="School Fees" sub="Tuition, books, levies, PTA and feeding on one invoice — extra classes are billed and receipted on their own" />
    <Suspense fallback={null}><FeesRoute {...billingProps("fees")} /></Suspense></>);
}
