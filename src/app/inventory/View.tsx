"use client";
import { useLiveData } from "@/lib/live/data";
import { PageHeader } from "@/components/ui/primitives";
import { Suspense } from "react";
import { InventoryRoute } from "@/components/inventory/InventoryRoute";
import * as Q from "@/lib/data/queries";
export function View() {
  useLiveData(); // re-render with fresh data after each save (live site)
  return (<><PageHeader title="Inventory & Assets" sub="Stock ledger, issuance, procurement and asset custody" />
    <Suspense fallback={null}><InventoryRoute items={Q.inventory.map(({ onHand, ...i }) => { void onHand; return i; })} movements={Q.movements.map((m) => ({ ...m }))} students={Q.activeStudents().map((s) => ({ id: s.id, name: Q.fullName(s), cls: Q.getClass(s.classId).name }))} /></Suspense></>);
}
