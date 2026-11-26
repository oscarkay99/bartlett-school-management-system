"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LiveGate } from "@/lib/live/data";
import { ParentPage } from "../[id]/ParentPage";

// Live site: a record from the database, by ?id= (records are not known when the site is built).
function ById() { return <ParentPage id={useSearchParams().get("id") ?? ""} />; }
export default function Page() { return <Suspense fallback={null}><LiveGate><ById /></LiveGate></Suspense>; }
