import { PageHeader } from "@/components/ui/primitives";
import { Suspense } from "react";
import { FeesRoute } from "@/components/fees/FeesRoute";
import { billingProps } from "@/lib/data/fees-view";

export const metadata = { title: "Extra Classes — EduFlow" };
export default function ExtraClassesPage() {
  return (<><PageHeader title="Extra Classes" sub="Extra classes for Primary and JHS, billed per student on their own invoice with their own receipts. Standalone: never added to school fees or Extracurricular." />
    <Suspense fallback={null}><FeesRoute {...billingProps("classes")} /></Suspense></>);
}
