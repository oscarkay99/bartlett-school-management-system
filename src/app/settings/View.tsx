"use client";
import { useLiveData } from "@/lib/live/data";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/primitives";
import { SettingsWorkspace } from "@/components/SettingsWorkspace";
import { SCHOOL } from "@/lib/data/queries";
export function View() {
  useLiveData(); // re-render with fresh data after each save (live site)
  return (<><PageHeader title="Settings" sub="School profile, academic calendar, fees, numbering, approvals and access control" /><Suspense fallback={null}><SettingsWorkspace school={{ name: SCHOOL.name, phone: SCHOOL.phone, email: SCHOOL.email, city: SCHOOL.city, currency: "GHS — Ghana Cedi", timezone: SCHOOL.timezone }} /></Suspense></>);
}
