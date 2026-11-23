import { PageHeader } from "@/components/ui/primitives";
import { Suspense } from "react";
import { FeesRoute } from "@/components/fees/FeesRoute";
import { billingProps } from "@/lib/data/fees-view";

export const metadata = { title: "Extracurricular — EduFlow" };
export default function ExtracurricularPage() {
  return (<><PageHeader title="Extracurricular" sub="Music (Piano), STEM and Extra Classes — own invoices and receipts, separate from school fees" />
    <Suspense fallback={null}><FeesRoute {...billingProps("extra")} /></Suspense></>);
}
