import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { AppShell, type SearchItem } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/interactive";
import { SCHOOL, students, guardians, staff, invoices, payments, inventory, fullName, getStudent } from "@/lib/data/queries";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
export const metadata: Metadata = { title: "Bartlett Montessori School — Management System", description: "School management, fees, inventory and academic intelligence" };

function buildIndex(): SearchItem[] {
  return [
    ...students.map((s) => ({ type: "Student", label: fullName(s), sub: `${s.admissionNo}`, href: `/students/${s.id}` })),
    ...guardians.map((g) => ({ type: "Parent", label: g.name, sub: `${g.phone}${g.email ? " · " + g.email : ""}`, href: `/parents/${g.id}` })),
    ...staff.map((s) => ({ type: "Staff", label: s.name, sub: `${s.empNo} · ${s.position}`, href: `/staff` })),
    ...invoices.map((i) => ({ type: "Invoice", label: i.no, sub: fullName(getStudent(i.studentId)!), href: `/students/${i.studentId}?tab=fees` })),
    ...payments.map((p) => ({ type: "Receipt", label: p.receiptNo, sub: `${fullName(getStudent(p.studentId)!)} · ${p.ref}`, href: `/print/receipt/${p.id}` })),
    ...inventory.map((i) => ({ type: "Item", label: i.name, sub: i.sku, href: `/inventory` })),
  ];
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <ToastProvider>
            <AppShell school={{ name: SCHOOL.name, short: SCHOOL.short }} searchIndex={buildIndex()} years={SCHOOL.years} terms={SCHOOL.terms}>{children}</AppShell>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
