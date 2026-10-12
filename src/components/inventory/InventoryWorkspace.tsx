"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, ClockAlert, PackageX, Wallet } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Kpi, AlertBanner, inputClass } from "@/components/ui/primitives";
import { DataTable, Modal, Select, Tabs, useToast, type Column } from "@/components/ui/interactive";
import { TreemapChart, HBars } from "@/components/charts/charts";
import { money, moneyShort } from "@/lib/money";
import { fmtDate } from "@/lib/utils";

export interface Item { id: string; sku: string; name: string; category: string; unit: string; location: string; supplier: string; cost: number; reorder: number; max: number; kind: string; expiry?: string }
export interface Mv { id: string; date: string; itemId: string; type: string; qty: number; ref: string; staff: string; to?: string }
const IN = ["Received", "Opening", "Returned"];
const signed = (m: Mv) => (IN.includes(m.type) ? m.qty : m.type === "Adjustment" ? m.qty : -m.qty);

export function InventoryWorkspace({ items, movements, students, openIssue }: { items: Item[]; movements: Mv[]; students: { id: string; name: string; cls: string }[]; openIssue?: boolean }) {
  const [moves, setMoves] = useState(movements); const [cat, setCat] = useState(""); const [dlg, setDlg] = useState<null | "issue" | "receive">(openIssue ? "issue" : null); const [pre, setPre] = useState(""); const toast = useToast();
  const onHand = useMemo(() => { const m: Record<string, number> = {}; moves.forEach((x) => (m[x.itemId] = (m[x.itemId] ?? 0) + signed(x))); return m; }, [moves]);
  const rows = items.map((i) => ({ ...i, qty: onHand[i.id] ?? 0 })).filter((i) => !cat || i.category === cat);
  const all = items.map((i) => ({ ...i, qty: onHand[i.id] ?? 0 }));
  const low = all.filter((i) => i.qty > 0 && i.qty <= i.reorder), oos = all.filter((i) => i.qty <= 0), over = all.filter((i) => i.qty > i.max);
  const value = all.reduce((a, i) => a + i.qty * i.cost, 0);
  const byCat = Object.entries(all.reduce<Record<string, number>>((a, i) => ({ ...a, [i.category]: (a[i.category] ?? 0) + (i.qty * i.cost) / 100 }), {})).map(([name, v]) => ({ name, value: Math.round(v) }));
  const issued = Object.entries(moves.filter((m) => m.type === "Issued").reduce<Record<string, number>>((a, m) => ({ ...a, [m.itemId]: (a[m.itemId] ?? 0) + m.qty }), {})).map(([id, q]) => ({ name: items.find((i) => i.id === id)!.name.slice(0, 22), qty: q })).sort((a, b) => b.qty - a.qty).slice(0, 7);
  const damaged = moves.filter((m) => m.type === "Damaged" || m.type === "Lost").reduce((a, m) => a + m.qty * (items.find((i) => i.id === m.itemId)?.cost ?? 0), 0);
  const post = (m: Omit<Mv, "id" | "date" | "staff">) => { setMoves((x) => [{ ...m, id: `new${x.length}`, date: "2026-10-12", staff: "Kojo Danso" }, ...x]); };

  const cols: Column<(typeof rows)[0]>[] = [
    { key: "n", header: "Item", sort: (x) => x.name, render: (x) => <div><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.sku} · {x.location}</div></div> },
    { key: "c", header: "Category", hideOnMobile: true, render: (x) => x.category }, { key: "k", header: "Type", hideOnMobile: true, render: (x) => <Badge>{x.kind}</Badge> },
    { key: "q", header: "On hand", align: "right", sort: (x) => x.qty, render: (x) => <b>{x.qty} <span className="font-normal text-muted">{x.unit}</span></b> },
    { key: "r", header: "Reorder at", align: "right", hideOnMobile: true, render: (x) => x.reorder },
    { key: "v", header: "Value (cost)", align: "right", sort: (x) => x.qty * x.cost, render: (x) => money(x.qty * x.cost) },
    { key: "s", header: "Status", render: (x) => x.qty <= 0 ? <Badge tone="danger" dot>Out of stock</Badge> : x.qty <= x.reorder ? <Badge tone="warn" dot>Low</Badge> : x.qty > x.max ? <Badge tone="info" dot>Overstock</Badge> : <Badge tone="ok" dot>OK</Badge> },
    { key: "a", header: "", render: (x) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setPre(x.id); setDlg("issue"); }}>Issue</Button> },
  ];
  const mcols: Column<Mv>[] = [
    { key: "d", header: "Date", sort: (x) => x.date, render: (x) => fmtDate(x.date) }, { key: "i", header: "Item", render: (x) => items.find((i) => i.id === x.itemId)?.name }, { key: "t", header: "Type", render: (x) => <Badge tone={IN.includes(x.type) ? "ok" : x.type === "Issued" ? "info" : "danger"}>{x.type}</Badge> },
    { key: "q", header: "Qty", align: "right", render: (x) => <b className={signed(x) >= 0 ? "text-ok" : ""}>{signed(x) > 0 ? "+" : ""}{signed(x)}</b> }, { key: "r", header: "Reference", hideOnMobile: true, render: (x) => <span className="num">{x.ref}</span> }, { key: "to", header: "To / reason", hideOnMobile: true, render: (x) => x.to ?? "—" }, { key: "s", header: "Staff", hideOnMobile: true, render: (x) => x.staff },
  ];
  return (
    <div className="space-y-4">
      {(low.length + oos.length > 0) && <AlertBanner tone="warn" icon={AlertTriangle} title={`${low.length + oos.length} items need restocking`} actions={<Button size="sm" variant="primary" onClick={() => setDlg("receive")}>Receive stock</Button>}>{oos.length} out of stock, {low.length} below reorder level{over.length ? `, ${over.length} overstocked` : ""}.</AlertBanner>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Inventory valuation" value={moneyShort(value)} icon={Wallet} hint="On-hand quantity × unit cost (accounting cost). Excludes selling price and asset book value." />
        <Kpi label="Items tracked" value={String(items.length)} icon={Boxes} hint="Active SKUs in all stores." />
        <Kpi label="Low / out of stock" value={`${low.length} / ${oos.length}`} icon={PackageX} tone="warn" hint="Below reorder level / zero on hand." />
        <Kpi label="Damaged & lost cost" value={moneyShort(damaged)} icon={ClockAlert} tone="danger" hint="Damaged and lost movements × unit cost." />
      </div>
      <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => { setPre(""); setDlg("issue"); }}><ArrowUpFromLine size={14} />Issue to student / dept</Button><Button onClick={() => setDlg("receive")}><ArrowDownToLine size={14} />Receive stock</Button></div>
      <Tabs tabs={[
        { id: "items", label: "Items", content: <Card><DataTable rows={rows} columns={cols} rowId={(x) => x.id} searchText={(x) => x.name + x.sku} pageSize={12} filters={<Select label="Category" value={cat} onChange={setCat} options={[{ value: "", label: "All categories" }, ...Array.from(new Set(items.map((i) => i.category))).map((c) => ({ value: c, label: c }))]} />} /></Card> },
        { id: "ledger", label: "Stock ledger", content: <Card><CardHeader title="Stock movement ledger" sub="Quantities are derived from this append-only ledger — never edited directly." /><DataTable rows={moves} columns={mcols} rowId={(x) => x.id} pageSize={12} searchText={(x) => x.ref + (items.find((i) => i.id === x.itemId)?.name ?? "")} /></Card> },
        { id: "insights", label: "Insights", content: <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader title="Value by category" /><div className="px-2 pb-3"><TreemapChart data={byCat} /></div></Card><Card><CardHeader title="Most frequently issued" sub="Units issued this term" /><div className="px-2 pb-3"><HBars data={issued} x="name" y="qty" label="Units" money={false} color="var(--info)" /></div></Card></div> },
        { id: "procure", label: "Procurement", content: <Procurement /> },
        { id: "assets", label: "Assets", content: <Assets /> },
      ]} />
      <MoveDialog mode={dlg} onClose={() => setDlg(null)} items={all} students={students} pre={pre} onPost={(m, msg) => { post(m); toast(msg); setDlg(null); }} />
    </div>
  );
}

function MoveDialog({ mode, onClose, items, students, pre, onPost }: { mode: null | "issue" | "receive"; onClose: () => void; items: (Item & { qty: number })[]; students: { id: string; name: string; cls: string }[]; pre: string; onPost: (m: Omit<Mv, "id" | "date" | "staff">, msg: string) => void }) {
  const [item, setItem] = useState(""); const [qty, setQty] = useState("1"); const [to, setTo] = useState(""); const [q, setQ] = useState("");
  const id = item || pre; const it = items.find((i) => i.id === id); const n = parseInt(qty || "0", 10);
  const err = !it ? "Select an item" : !(n > 0) ? "Quantity must be at least 1" : mode === "issue" && n > it.qty ? `Only ${it.qty} ${it.unit} available — negative stock is blocked` : mode === "issue" && !to ? "Choose a recipient" : "";
  const matches = students.filter((s) => q && s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
  return (
    <Modal open={!!mode} onClose={onClose} title={mode === "issue" ? "Issue stock" : "Goods received"} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!err} onClick={() => { onPost({ itemId: id, type: mode === "issue" ? "Issued" : "Received", qty: n, ref: mode === "issue" ? `ISS-${Math.floor(Math.random() * 9000 + 1000)}` : `GRN-${Math.floor(Math.random() * 900 + 100)}`, to: to || undefined }, mode === "issue" ? `Issued ${n} × ${it!.name}` : `Received ${n} × ${it!.name}`); setItem(""); setQty("1"); setTo(""); setQ(""); }}>{mode === "issue" ? "Confirm issue" : "Post receipt"}</Button></>}>
      <div className="space-y-4">
        <Field label="Item"><select className={inputClass} value={id} onChange={(e) => setItem(e.target.value)}><option value="">Select item…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.qty} {i.unit})</option>)}</select></Field>
        <Field label="Quantity"><input className={inputClass} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} /></Field>
        {mode === "issue" && <Field label="Issue to (student)"><input className={inputClass} placeholder="Search student…" value={to || q} onChange={(e) => { setTo(""); setQ(e.target.value); }} />{matches.map((s) => <button key={s.id} className="mt-1 block w-full rounded border border-line px-3 py-1.5 text-left hover:bg-surface-2" onClick={() => setTo(s.name)}>{s.name} · {s.cls}</button>)}</Field>}
        {it && <p className="text-sm text-muted">On hand: <b>{it.qty}</b> → after: <b className={mode === "issue" && n > it.qty ? "text-danger" : "text-fg"}>{mode === "issue" ? it.qty - (n || 0) : it.qty + (n || 0)}</b></p>}
        {err && it && <p role="alert" className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

const PO = [
  { no: "PR-0231", title: "200 exercise books + 40 marker boxes", stage: 0, amt: 180000, by: "Kojo Danso" }, { no: "PO-0088", title: "Uniform shirts ×150", stage: 2, amt: 825000, by: "Gold Coast Uniforms" },
  { no: "PO-0085", title: "Mathematics textbooks JHS ×60", stage: 3, amt: 270000, by: "Kumasi Books Ltd" }, { no: "PO-0079", title: "Rice 50kg ×20", stage: 4, amt: 1040000, by: "Adom Supplies" },
];
function Procurement() {
  const S = ["Request", "Approved", "PO issued", "Goods received", "Invoice matched", "Paid"];
  return <Card><CardHeader title="Procurement pipeline" sub="Request → Approval → Purchase Order → Goods Received → Invoice Matching → Payment" />{PO.map((p) => <div key={p.no} className="border-t border-line px-4 py-3"><div className="flex flex-wrap justify-between gap-2"><div><b className="num">{p.no}</b> {p.title}<div className="text-xs text-muted">{p.by}</div></div><b className="num">{money(p.amt)}</b></div>
    <ol className="mt-3 flex gap-1">{S.map((s, i) => <li key={s} className={`flex-1 rounded-full px-1 py-1 text-center text-[10px] ${i <= p.stage ? "bg-ok/15 text-ok" : "bg-surface-2 text-muted"}`}>{s}</li>)}</ol></div>)}</Card>;
}
const ASSETS = [["AST-001", "Lenovo ThinkPad T14", "Samuel Owusu", "Good", "SN-LT-88213"], ["AST-002", "Lenovo ThinkPad T14", "Efua Quansah", "Good", "SN-LT-88214"], ["AST-003", "Epson Projector EB-X49", "JHS 2 Classroom", "Needs service", "SN-EP-4410"], ["AST-004", "iPad 10th Gen", "Yaw Danso", "Good", "SN-IP-7721"], ["AST-005", "Teacher desk", "Primary 3", "Fair", "—"]];
function Assets() {
  return <Card><CardHeader title="Asset register" sub="Reusable equipment assigned to staff & rooms" /><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2/60 text-xs uppercase text-muted"><tr><th className="px-4 py-2 text-left">Tag</th><th className="text-left">Asset</th><th className="text-left">Custodian</th><th className="text-left">Serial</th><th className="px-4 text-left">Condition</th></tr></thead><tbody className="divide-y divide-line">{ASSETS.map((a) => <tr key={a[0]}><td className="px-4 py-2.5 num">{a[0]}</td><td>{a[1]}</td><td>{a[2]}</td><td className="num text-xs">{a[4]}</td><td className="px-4"><Badge tone={a[3] === "Good" ? "ok" : "warn"}>{a[3]}</Badge></td></tr>)}</tbody></table></div></Card>;
}
