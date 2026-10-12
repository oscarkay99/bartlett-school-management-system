"use client";
import { useState } from "react";
import { CheckCircle2, Landmark, TrendingDown, TrendingUp, Wallet, XCircle } from "lucide-react";
import { Badge, Button, Card, CardHeader, Kpi, Progress, StatusBadge } from "@/components/ui/primitives";
import { ConfirmDialog, DataTable, Tabs, useToast, type Column } from "@/components/ui/interactive";
import { Donut, GroupedBars } from "@/components/charts/charts";
import { useRole } from "@/components/shell/AppShell";
import { money, moneyShort, pct } from "@/lib/money";
import { fmtDate } from "@/lib/utils";
import { RecordDialog, type FieldDef } from "@/components/ui/RecordDialog";
import { Pencil, Plus, Trash2 } from "lucide-react";

export interface Exp { id: string; no: string; date: string; category: string; vendor: string; amount: number; department: string; status: string; approver: string }
export interface TB { account: string; dr: number; cr: number }
export interface Bud { category: string; budget: number; actual: number }
const CATS = ["Salaries", "Utilities", "Internet", "Repairs", "Stationery", "Food Supplies", "Transport", "Inventory Purchases", "Software", "Building", "Maintenance", "Other"];
const EXP_FIELDS: FieldDef[] = [
  { key: "category", label: "Category", type: "select", options: CATS, required: true }, { key: "vendor", label: "Vendor / payee", required: true },
  { key: "amount", label: "Amount (GHS)", type: "number", required: true, validate: (v) => (Number(v) <= 0 ? "Must be greater than 0" : undefined) }, { key: "date", label: "Expense date", type: "date", required: true },
  { key: "department", label: "Department", type: "select", options: ["Administration", "Operations", "Kitchen", "Stores", "Academics"], required: true }, { key: "method", label: "Payment method", type: "select", options: ["Bank Transfer", "Cash", "Mobile Money", "Cheque"], required: true },
];
const THRESH = [{ upTo: 500000, who: "Finance Officer" }, { upTo: 2500000, who: "School Administrator" }, { upTo: Infinity, who: "Owner" }];
const needs = (amt: number) => THRESH.find((t) => amt <= t.upTo)!.who;

export function FinanceWorkspace({ expenses, tb, budget, recon, cash, incExp, breakdown, income, expenseTotal }: { expenses: Exp[]; tb: TB[]; budget: Bud[]; recon: { gl: number; sub: number; diff: number }; cash: number; incExp: Record<string, number | string>[]; breakdown: { name: string; value: number }[]; income: number; expenseTotal: number }) {
  const [list, setList] = useState(expenses); const [form, setForm] = useState<null | { e?: Exp }>(null); const [del, setDel] = useState<Exp | null>(null); const [target, setTarget] = useState<{ e: Exp; act: "approve" | "reject" } | null>(null); const toast = useToast(); const { allow } = useRole(); const canEdit = allow("expenses", "edit"), canDelete = allow("expenses", "delete");
  const canApprove = allow("expenses", "approve");
  const cols: Column<Exp>[] = [
    { key: "n", header: "Ref", render: (x) => <b className="num">{x.no}</b> }, { key: "d", header: "Date", sort: (x) => x.date, render: (x) => fmtDate(x.date) }, { key: "c", header: "Category / vendor", render: (x) => <div><div className="font-medium">{x.category}</div><div className="text-xs text-muted">{x.vendor}</div></div> },
    { key: "dp", header: "Dept", hideOnMobile: true, render: (x) => x.department }, { key: "a", header: "Amount", align: "right", sort: (x) => x.amount, render: (x) => money(x.amount) },
    { key: "w", header: "Approval level", hideOnMobile: true, render: (x) => <span className="text-xs text-muted">{needs(x.amount)}</span> }, { key: "s", header: "Status", render: (x) => <StatusBadge status={x.status} /> },
    { key: "x", header: "", render: (x) => x.status === "Pending Approval" ? (canApprove ? <div className="flex gap-1"><Button size="sm" variant="success" onClick={() => setTarget({ e: x, act: "approve" })}><CheckCircle2 size={13} />Approve</Button><Button size="sm" variant="ghost" onClick={() => setTarget({ e: x, act: "reject" })}><XCircle size={13} /></Button></div> : <span className="text-xs text-muted">Awaiting {needs(x.amount)}</span>) : null },
    { key: "act", header: "", align: "right", render: (x) => <div className="flex justify-end gap-0.5">{canEdit && <Button size="sm" variant="ghost" aria-label={`Edit ${x.no}`} onClick={() => setForm({ e: x })}><Pencil size={14} /></Button>}{canDelete && <Button size="sm" variant="ghost" aria-label={`Delete ${x.no}`} onClick={() => setDel(x)}><Trash2 size={14} className="text-danger" /></Button>}</div> },
  ];
  const tdr = tb.reduce((a, t) => a + t.dr, 0), tcr = tb.reduce((a, t) => a + t.cr, 0);
  const inc = tb.filter((t) => t.account.startsWith("4")), exp = tb.filter((t) => t.account.startsWith("5"));
  const revenue = inc.reduce((a, t) => a + t.cr - t.dr, 0), spend = exp.reduce((a, t) => a + t.dr - t.cr, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Cash position" value={moneyShort(cash)} icon={Wallet} tone="info" hint="Opening cash + confirmed receipts − approved/paid expenses." />
        <Kpi label="Cash received" value={moneyShort(income)} icon={TrendingUp} tone="ok" hint="Confirmed fee receipts (cash basis)." />
        <Kpi label="Expenditure" value={moneyShort(expenseTotal)} icon={TrendingDown} tone="danger" hint="Approved & paid expenses." />
        <Kpi label="Surplus (accrual)" value={moneyShort(revenue - spend)} icon={Landmark} hint="Fees invoiced (revenue recognised) − expenses. Fees billed ≠ cash collected, and surplus ≠ cash." />
      </div>
      <Tabs tabs={[
        { id: "overview", label: "Overview", content: <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader title="Income vs expenditure" sub="Cash basis by month" /><div className="px-2 pb-3"><GroupedBars data={incExp} x="month" bars={[{ key: "income", label: "Cash received", color: "var(--ok)" }, { key: "expense", label: "Expenditure", color: "var(--danger)" }]} /></div></Card><Card><CardHeader title="Expense breakdown" /><div className="px-2 pb-3"><Donut data={breakdown.slice(0, 7)} /></div></Card></div> },
        { id: "expenses", label: "Expenses", badge: String(list.filter((e) => e.status === "Pending Approval").length), content: <><div className="mb-3 flex justify-end">{allow("expenses", "create") && <Button variant="primary" onClick={() => setForm({})}><Plus size={14} />Add expense</Button>}</div><Card><DataTable rows={list} columns={cols} rowId={(x) => x.id} searchText={(x) => `${x.no} ${x.category} ${x.vendor}`} pageSize={12} /><p className="border-t border-line px-4 py-2 text-xs text-muted">Approval thresholds (configurable in Settings): ≤ {money(THRESH[0].upTo)} {THRESH[0].who} · ≤ {money(THRESH[1].upTo)} {THRESH[1].who} · above: Owner.</p></Card></> },
        { id: "budget", label: "Budget vs actual", content: <Card><CardHeader title="Term 1 budget" sub="Actual = approved & paid expenses" /><div className="divide-y divide-line">{budget.map((b) => { const used = pct(b.actual, b.budget); return <div key={b.category} className="grid gap-2 px-4 py-3 sm:grid-cols-[180px_1fr_auto] sm:items-center"><b>{b.category}</b><div><Progress value={used} tone={used > 100 ? "danger" : used > 85 ? "warn" : "ok"} /><div className="mt-1 text-xs text-muted">{money(b.actual)} of {money(b.budget)} · available {money(b.budget - b.actual)}</div></div><Badge tone={used > 100 ? "danger" : used > 85 ? "warn" : "ok"}>{used}% used</Badge></div>; })}</div></Card> },
        { id: "ledger", label: "Trial balance", content: (
          <div className="space-y-4"><Card><CardHeader title="Trial balance" sub="Derived from the general ledger · accrual basis" action={<Badge tone={tdr === tcr ? "ok" : "danger"}>{tdr === tcr ? "Balanced" : "OUT OF BALANCE"}</Badge>} />
            <table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Account</th><th className="px-3 text-right">Debit</th><th className="px-4 text-right">Credit</th></tr></thead><tbody className="divide-y divide-line">{tb.map((t) => <tr key={t.account}><td className="px-4 py-2">{t.account}</td><td className="num px-3 text-right">{t.dr ? money(t.dr) : ""}</td><td className="num px-4 text-right">{t.cr ? money(t.cr) : ""}</td></tr>)}<tr className="bg-surface-2/60 font-semibold"><td className="px-4 py-2">Total</td><td className="num px-3 text-right">{money(tdr)}</td><td className="num px-4 text-right">{money(tcr)}</td></tr></tbody></table></Card>
            <Card className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold">Fee subledger ↔ general ledger</div><p className="text-sm text-muted">Fee Receivables (GL 1200) must equal the sum of all student balances.</p></div><Badge tone={recon.diff === 0 ? "ok" : "danger"}>{recon.diff === 0 ? "Reconciled" : `Difference ${money(recon.diff)}`}</Badge></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-surface-2 p-3"><div className="text-xs text-muted">GL 1200 Fee Receivables</div><div className="num text-lg font-semibold">{money(recon.gl)}</div></div><div className="rounded-lg bg-surface-2 p-3"><div className="text-xs text-muted">Σ Student fee balances</div><div className="num text-lg font-semibold">{money(recon.sub)}</div></div></div></Card></div>) },
      ]} />
      {form && <RecordDialog open key={form.e?.id ?? "new"} onClose={() => setForm(null)} title={form.e ? `Edit ${form.e.no}` : "Add expense"} fields={EXP_FIELDS} submitLabel={form.e ? "Save changes" : "Submit expense"}
        initial={form.e ? { category: form.e.category, vendor: form.e.vendor, amount: String(form.e.amount / 100), date: form.e.date, department: form.e.department, method: "Bank Transfer" } : { category: "Utilities", vendor: "", amount: "", date: "2026-10-12", department: "Operations", method: "Bank Transfer" }}
        extra={(v) => (Number(v.amount) > 0 ? <p className="rounded-lg bg-info/10 p-2.5 text-sm text-info">Approval required from: <b>{needs(Math.round(Number(v.amount) * 100))}</b></p> : null)}
        onSubmit={(v) => { const amount = Math.round(Number(v.amount) * 100); const row: Exp = { id: form.e?.id ?? `new-${crypto.randomUUID().slice(0, 6)}`, no: form.e?.no ?? `EXP-${String(list.length + 1).padStart(4, "0")}`, date: v.date, category: v.category, vendor: v.vendor.trim(), amount, department: v.department, status: form.e?.status ?? "Pending Approval", approver: needs(amount) };
          setList((x) => (form.e ? x.map((y) => (y.id === row.id ? row : y)) : [row, ...x])); toast(form.e ? `${row.no} updated` : `${row.no} submitted for ${row.approver} approval`); setForm(null); }} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} needReason danger confirmLabel="Delete expense" title={`Delete ${del?.no ?? ""}`} body="Deleting an approved expense reverses its ledger entries with a correcting journal; the original is kept for audit." onConfirm={() => { setList((x) => x.filter((y) => y.id !== del!.id)); toast(`${del!.no} deleted`); setDel(null); }} />
      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} needReason={target?.act === "reject"} danger={target?.act === "reject"} title={target?.act === "approve" ? "Approve expense" : "Reject expense"} confirmLabel={target?.act === "approve" ? "Approve" : "Reject"} body={target ? `${target.e.no} · ${target.e.vendor} · ${money(target.e.amount)}. Required approver: ${needs(target.e.amount)}. This action is recorded in the audit trail.` : ""}
        onConfirm={() => { if (!target) return; setList((l) => l.map((x) => (x.id === target.e.id ? { ...x, status: target.act === "approve" ? "Approved" : "Rejected" } : x))); toast(`${target.e.no} ${target.act === "approve" ? "approved" : "rejected"}`); setTarget(null); }} />
    </div>
  );
}
