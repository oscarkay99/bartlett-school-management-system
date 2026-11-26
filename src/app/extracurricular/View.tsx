"use client";
import { useLiveData } from "@/lib/live/data";
import { PageHeader } from "@/components/ui/primitives";
import { Suspense } from "react";
import { FeesRoute } from "@/components/fees/FeesRoute";
import { billingProps } from "@/lib/data/fees-view";

export function View() {
  useLiveData(); // re-render with fresh data after each save (live site)
  return (<><PageHeader title="Extracurricular" sub="Music (Piano) and STEM, billed per student on their own invoice with their own receipts. Standalone: never added to school fees or Extra Classes." />
    <Suspense fallback={null}><FeesRoute {...billingProps("extra")} /></Suspense></>);
}
