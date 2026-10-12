// All money is integer minor units (pesewas). Never use floats for totals.
export type Minor = number;
export const ghs = (cedis: number): Minor => Math.round(cedis * 100);

const n2 = new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n0 = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 });
const fmt = { format: (v: number) => `${v < 0 ? "-" : ""}GHS ${n2.format(Math.abs(v))}` };
const fmt0 = { format: (v: number) => `${v < 0 ? "-" : ""}GHS ${n0.format(Math.abs(v))}` };

export const money = (m: Minor) => fmt.format(m / 100);
export const moneyShort = (m: Minor) => {
  const v = m / 100;
  if (Math.abs(v) >= 1_000_000) return `GHS ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 10_000) return `GHS ${(v / 1000).toFixed(1)}k`;
  return fmt0.format(v);
};
export const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);
