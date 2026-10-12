"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from "recharts";

const C = { info: "var(--info)", ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)", brand: "var(--brand)", muted: "var(--muted)", line: "var(--border)" };
const PALETTE = ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#64748b", "#ea580c"];
const tick = { fontSize: 11, fill: "var(--muted)" };
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--fg)" }, labelStyle: { color: "var(--fg)", fontWeight: 600 } };
const cedi = (v: number) => `GHS ${Number(v).toLocaleString("en-GH", { maximumFractionDigits: 0 })}`;
const k = (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v));

export function LineTrend({ data, x, y, label, money = true, domain, color = C.info, height = 240 }: { data: Record<string, number | string>[]; x: string; y: string; label: string; money?: boolean; domain?: [number | string, number | string]; color?: string; height?: number }) {
  return (
    <div role="img" aria-label={`${label} line chart`} style={{ height }}><ResponsiveContainer>
      <LineChart data={data} margin={{ left: -8, right: 8, top: 8 }}><CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} /><XAxis dataKey={x} tick={tick} tickLine={false} axisLine={false} /><YAxis tick={tick} tickLine={false} axisLine={false} domain={domain} tickFormatter={money ? k : undefined} width={44} />
        <Tooltip {...tip} formatter={(v) => [money ? cedi(Number(v)) : `${v}%`, label]} /><Line type="monotone" dataKey={y} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} /></LineChart>
    </ResponsiveContainer></div>
  );
}
export function AreaTrend({ data, x, y, label, height = 240 }: { data: Record<string, number | string>[]; x: string; y: string; label: string; height?: number }) {
  return (
    <div role="img" aria-label={`${label} area chart`} style={{ height }}><ResponsiveContainer>
      <AreaChart data={data} margin={{ left: -8, right: 8, top: 8 }}><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.brand} stopOpacity={0.35} /><stop offset="100%" stopColor={C.brand} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} /><XAxis dataKey={x} tick={tick} tickLine={false} axisLine={false} /><YAxis tick={tick} tickLine={false} axisLine={false} width={40} /><Tooltip {...tip} formatter={(v) => [v, label]} />
        <Area type="monotone" dataKey={y} stroke={C.brand} strokeWidth={2.5} fill="url(#ag)" /></AreaChart>
    </ResponsiveContainer></div>
  );
}
export function GroupedBars({ data, x, bars, height = 240 }: { data: Record<string, number | string>[]; x: string; bars: { key: string; label: string; color: string }[]; height?: number }) {
  return (
    <div role="img" aria-label="Grouped bar chart" style={{ height }}><ResponsiveContainer>
      <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}><CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} /><XAxis dataKey={x} tick={tick} tickLine={false} axisLine={false} /><YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={k} width={44} />
        <Tooltip {...tip} formatter={(v, n) => [cedi(Number(v)), n]} cursor={{ fill: "var(--surface-2)" }} /><Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[4, 4, 0, 0]} />)}</BarChart>
    </ResponsiveContainer></div>
  );
}
export function HBars({ data, x, y, label, money = true, color = C.warn, height = 300, colorBy }: { data: Record<string, number | string>[]; x: string; y: string; label: string; money?: boolean; color?: string; height?: number; colorBy?: (d: Record<string, number | string>) => string }) {
  return (
    <div role="img" aria-label={`${label} horizontal bar chart`} style={{ height }}><ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid stroke={C.line} strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={tick} tickLine={false} axisLine={false} tickFormatter={money ? k : undefined} /><YAxis type="category" dataKey={x} tick={tick} tickLine={false} axisLine={false} width={86} />
        <Tooltip {...tip} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => [money ? cedi(Number(v)) : v, label]} /><Bar dataKey={y} fill={color} radius={[0, 4, 4, 0]}>{colorBy && data.map((d, i) => <Cell key={i} fill={colorBy(d)} />)}</Bar></BarChart>
    </ResponsiveContainer></div>
  );
}
export function VBars({ data, x, y, label, color = C.info, height = 260, domain }: { data: Record<string, number | string>[]; x: string; y: string; label: string; color?: string; height?: number; domain?: [number, number] }) {
  return (
    <div role="img" aria-label={`${label} bar chart`} style={{ height }}><ResponsiveContainer>
      <BarChart data={data} margin={{ left: -8, right: 8, top: 8 }}><CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} /><XAxis dataKey={x} tick={tick} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={54} /><YAxis tick={tick} tickLine={false} axisLine={false} domain={domain} width={36} />
        <Tooltip {...tip} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => [v, label]} /><Bar dataKey={y} fill={color} radius={[4, 4, 0, 0]} /></BarChart>
    </ResponsiveContainer></div>
  );
}
export function Donut({ data, money = true, colors, height = 240, centerLabel }: { data: { name: string; value: number }[]; money?: boolean; colors?: string[]; height?: number; centerLabel?: string }) {
  const total = data.reduce((a, b) => a + b.value, 0); const cols = colors ?? PALETTE;
  return (
    <div role="img" aria-label="Donut chart" className="relative" style={{ height }}><ResponsiveContainer>
      <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">{data.map((_, i) => <Cell key={i} fill={cols[i % cols.length]} />)}</Pie>
        <Tooltip {...tip} formatter={(v, n) => [money ? cedi(Number(v)) : v, n]} /><Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} /></PieChart>
    </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[34%] text-center"><div className="num text-base font-semibold">{money ? `${(total / 1000).toFixed(total >= 100000 ? 0 : 1)}k` : total}</div>{centerLabel && <div className="text-[11px] text-muted">{centerLabel}</div>}</div></div>
  );
}
export function TreemapChart({ data, height = 260 }: { data: { name: string; value: number }[]; height?: number }) {
  return (
    <div role="img" aria-label="Inventory value treemap" style={{ height }}><ResponsiveContainer>
      <Treemap data={data} dataKey="value" stroke="var(--surface)" fill={C.info} content={<TmCell />} ><Tooltip {...tip} formatter={(v) => cedi(Number(v))} /></Treemap>
    </ResponsiveContainer></div>
  );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TmCell(p: any) {
  const { x, y, width, height, index, name } = p; if (width < 4) return null;
  return <g><rect x={x} y={y} width={width} height={height} fill={PALETTE[index % PALETTE.length]} fillOpacity={0.9} stroke="var(--surface)" strokeWidth={2} rx={4} />{width > 70 && height > 28 && <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={600}>{name}</text>}</g>;
}
export const CHART_COLORS = { ...C, PALETTE };
