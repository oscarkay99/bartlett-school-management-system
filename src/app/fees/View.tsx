"use client";
import { useLiveData } from "@/lib/live/data";
import { PageHeader } from "@/components/ui/primitives";
import { Suspense } from "react";
import { FeesRoute } from "@/components/fees/FeesRoute";
import { billingProps } from "@/lib/data/fees-view";

export function View() {
  useLiveData(); // re-render with fresh data after each save (live site)
  return (<><PageHeader title="School Fees" sub="Tuition, books, levies and PTA on one invoice. Feeding is paid separately in Feeding; extracurricular (Music, STEM) and extra classes are billed and receipted on their own" />
    <Suspense fallback={null}><FeesRoute {...billingProps("fees")} /></Suspense></>);
}
