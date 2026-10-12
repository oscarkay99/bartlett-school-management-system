import Image from "next/image";
import { cn } from "@/lib/utils";

// The school crest lives at /public/bartlett-crest.png; Settings → School profile is where it gets replaced.
export function SchoolLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-grid shrink-0 place-items-center overflow-hidden", className)} style={{ width: size, height: size }}>
      <Image src="/bartlett-crest.png" alt="Bartlett Montessori School crest" width={size * 2} height={size * 2} priority unoptimized className="size-full object-contain" />
    </span>
  );
}
