"use client";
import { useLiveData } from "@/lib/live/data";
import { PageHeader } from "@/components/ui/primitives";
import { Suspense } from "react";
import { FeesRoute } from "@/components/fees/FeesRoute";
import { billingProps } from "@/lib/data/fees-view";

export function View() {
  useLiveData(); // re-render with fresh data after each save (live site)
  return (<><PageHeader title="Extra Classes" sub="Extra classes for every class, billed per student on their own invoice with their own receipts. Standalone: never added to school fees or Extracurricular." />
    <Suspense fallback={null}><FeesRoute {...billingProps("classes")} /></Suspense></>);
}
