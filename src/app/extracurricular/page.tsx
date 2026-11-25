import { PageHeader } from "@/components/ui/primitives";
import { Suspense } from "react";
import { FeesRoute } from "@/components/fees/FeesRoute";
import { billingProps } from "@/lib/data/fees-view";

export const metadata = { title: "Extracurricular — EduFlow" };
export default function ExtracurricularPage() {
  return (<><PageHeader title="Extracurricular" sub="Music (Piano) and STEM, billed per student on their own invoice with their own receipts. Standalone: never added to school fees or Extra Classes." />
    <Suspense fallback={null}><FeesRoute {...billingProps("extra")} /></Suspense></>);
}
