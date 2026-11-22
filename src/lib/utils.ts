import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TIME_ZONE = "America/Bogota";

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la planta. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDaysISO(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** "2026-11-23" → "lun 23 nov 2026" */
export function formatDate(iso: string | null | undefined, opts: { weekday?: boolean; year?: boolean } = {}) {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    weekday: opts.weekday === false ? undefined : "short",
    day: "numeric",
    month: "short",
    year: opts.year === false ? undefined : "numeric",
  }).format(d);
}

export function formatTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "p. m." : "a. m.";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatDateTime(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

/** ISO date (YYYY-MM-DD) of a timestamp in plant time zone. */
export function tsToISODate(ts: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(ts));
}

export function formatQty(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === "") return "—";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(Number(n));
}

export function ilikeEscape(term: string) {
  return term.replace(/[%_\\,()]/g, (c) => `\\${c}`);
}
