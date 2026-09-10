import { CURRENCY_PREFIX } from "./catalog";

const DAY = 86_400_000;

export function toDate(iso: string): Date {
  return new Date(iso);
}

export function iso(d: Date): string {
  return d.toISOString();
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Midnight UTC of the given date. */
export function startOfDayUTC(isoStr: string): string {
  const d = toDate(isoStr);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
}

export function addDays(isoStr: string, days: number): string {
  return iso(new Date(toDate(isoStr).getTime() + days * DAY));
}

/**
 * Anniversary billing with month-end clamp. The anchor day is never overwritten by the clamp:
 * 31 Jan -> 28 Feb -> 31 Mar -> 30 Apr.
 */
export function addMonthsClamped(isoStr: string, months: number, anchorDay: number): string {
  const d = toDate(isoStr);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const targetY = y + Math.floor(m / 12);
  const targetM = ((m % 12) + 12) % 12;
  const day = Math.min(anchorDay, daysInMonth(targetY, targetM));
  return iso(new Date(Date.UTC(targetY, targetM, day)));
}

export function addYearsClamped(isoStr: string, years: number, anchorDay: number): string {
  const d = toDate(isoStr);
  const targetY = d.getUTCFullYear() + years;
  const targetM = d.getUTCMonth();
  const day = Math.min(anchorDay, daysInMonth(targetY, targetM));
  return iso(new Date(Date.UTC(targetY, targetM, day)));
}

/** Whole days from a to b, rounded up (b in the future => positive). */
export function daysBetween(aIso: string, bIso: string): number {
  return Math.ceil((toDate(bIso).getTime() - toDate(aIso).getTime()) / DAY);
}

/** Whole days elapsed since a (floor). */
export function daysSince(aIso: string, nowIso: string): number {
  return Math.floor((toDate(nowIso).getTime() - toDate(aIso).getTime()) / DAY);
}

export function isBefore(a: string, b: string): boolean {
  return toDate(a).getTime() < toDate(b).getTime();
}
export function isSameOrAfter(a: string, b: string): boolean {
  return toDate(a).getTime() >= toDate(b).getTime();
}

export function dayOfMonthUTC(isoStr: string): number {
  return toDate(isoStr).getUTCDate();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 10, 2026" (matches the Privy Sign screenshots). */
export function fmtDate(isoStr: string): string {
  const d = toDate(isoStr);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function fmtDateLong(isoStr: string): string {
  const d = toDate(isoStr);
  const full = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d.getUTCDate()} ${full[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtDateTime(isoStr: string): string {
  const d = toDate(isoStr);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${fmtDate(isoStr)}, ${hh}:${mm} UTC`;
}

export function fmtMoney(n: number): string {
  const fixed = Number.isInteger(n) ? n.toFixed(2) : n.toFixed(2);
  return `${CURRENCY_PREFIX}${fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function fmtMoneyShort(n: number): string {
  return Number.isInteger(n) ? `${CURRENCY_PREFIX}${n.toLocaleString("en-AU")}` : fmtMoney(n);
}

export function plural(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : many ?? one + "s"}`;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function invoiceNumber(seq: number, isoStr: string): string {
  const d = toDate(isoStr);
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][d.getUTCMonth()];
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${String(1289390 + seq)}/PID-FIN/INV/${roman}/${yy}`;
}
