"use client";
import { useLiveData } from "@/lib/live/data";
import { PageHeader, LinkButton } from "@/components/ui/primitives";
import { AdmissionsBoard } from "@/components/AdmissionsBoard";
import * as Q from "@/lib/data/queries";
export function View() {
  useLiveData(); // re-render with fresh data after each save (live site)
  return (<><PageHeader title="Admissions pipeline" sub="Application → documents → assessment → accepted → registered → enrolled" actions={<LinkButton variant="primary" href="/students/new">Register student</LinkButton>} /><AdmissionsBoard classes={Q.classes.map((c) => ({ id: c.id, name: c.name }))} initial={Q.applicants} /></>);
}
