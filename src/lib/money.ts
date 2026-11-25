// All money is integer minor units (pesewas). Never use floats for totals.
export type Minor = number;
export const ghs = (cedis: number): Minor => Math.round(cedis * 100);

/** The Ghana cedi sign used before every amount. Change it here to change it everywhere. */
export const CEDI = "GH₵";

const n2 = new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = { format: (v: number) => `${v < 0 ? "-" : ""}${CEDI} ${n2.format(Math.abs(v))}` };

export const money = (m: Minor) => fmt.format(m / 100);
/** Amounts on dashboards and summary cards: the full value (e.g. GH₵ 384,780.00), never abbreviated to "k" or "M". */
export const moneyShort = (m: Minor) => money(m);
export const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);
