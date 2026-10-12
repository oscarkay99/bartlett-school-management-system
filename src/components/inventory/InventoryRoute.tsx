"use client";
import { useSearchParams } from "next/navigation";
import { InventoryWorkspace } from "./InventoryWorkspace";

type Props = Omit<React.ComponentProps<typeof InventoryWorkspace>, "openIssue">;
export function InventoryRoute(props: Props) {
  const sp = useSearchParams();
  return <InventoryWorkspace key={sp.get("issue") ?? "0"} {...props} openIssue={sp.get("issue") === "1"} />;
}
