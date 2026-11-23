"use client";
import type { ComponentProps, ReactNode } from "react";
import { QueryTabs } from "@/components/ui/interactive";
import { useRole } from "@/components/shell/AppShell";

type Tab = ComponentProps<typeof QueryTabs>["tabs"][number] & { money?: boolean };
/** QueryTabs that drops fee tabs for roles with no access to fee information (teachers, storekeeper). */
export function RoleTabs({ tabs }: { tabs: Tab[] }) {
  const { money, ready } = useRole();
  const visible = tabs.filter((t) => !t.money || (ready && money !== "none"));
  return <QueryTabs key={visible.length} tabs={visible} />;
}
export type { ReactNode };
