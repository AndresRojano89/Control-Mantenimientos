import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { ScheduleRow } from "@/lib/queries";
import { cn, formatDate } from "@/lib/utils";

type Event = { date: string; kind: "preventivo" | "aseo"; label: string; href: string; done: boolean; cancelled: boolean };

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function monthLabel(month: string) {
  const d = new Date(`${month}-15T12:00:00Z`);
  const s = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

export function MonthCalendar({
  month,
  schedules,
  today,
  baseQuery,
}: {
  month: string;
  schedules: ScheduleRow[];
  today: string;
  baseQuery: URLSearchParams;
}) {
  const { from, to } = monthRange(month);
  const events: Event[] = [];
  for (const s of schedules) {
    if (s.scheduled_date >= from && s.scheduled_date <= to) {
      events.push({
        date: s.scheduled_date,
        kind: "preventivo",
        label: s.machine.name,
        href: `/programacion/${s.id}`,
        done: s.status === "completado",
        cancelled: s.status === "cancelado",
      });
    }
    for (const c of s.cleanings) {
      if (c.scheduled_date >= from && c.scheduled_date <= to) {
        events.push({
          date: c.scheduled_date,
          kind: "aseo",
          label: s.machine.name,
          href: `/programacion/${s.id}`,
          done: c.status === "completado",
          cancelled: c.status === "cancelado",
        });
      }
    }
  }
  const byDay = new Map<string, Event[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  // Cuadrícula que empieza en lunes.
  const first = new Date(`${from}T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = Number(to.slice(8, 10));
  const cells: (string | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7) cells.push(null);

  const link = (m: string) => {
    const q = new URLSearchParams(baseQuery);
    q.set("vista", "calendario");
    q.set("mes", m);
    return `/programacion?${q}`;
  };

  const chip = (e: Event, i: number) => (
    <Link
      key={i}
      href={e.href}
      className={cn(
        "block truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-4",
        e.kind === "preventivo" ? "bg-primary-soft text-primary" : "bg-success-soft text-success",
        e.done && "opacity-60",
        e.cancelled && "line-through opacity-50",
      )}
      title={`${e.kind === "preventivo" ? "Preventivo" : "Aseo"}: ${e.label}`}
    >
      {e.kind === "preventivo" ? "Prev." : "Aseo"} · {e.label}
    </Link>
  );

  const sortedDays = [...byDay.keys()].sort();

  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-4">
        <Link href={link(shiftMonth(month, -1))} className={buttonClass("outline", "icon")} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <p className="font-semibold">{monthLabel(month)}</p>
          <Link href={link(today.slice(0, 7))} className="text-xs text-primary hover:underline">
            Ir a hoy
          </Link>
        </div>
        <Link href={link(shiftMonth(month, 1))} className={buttonClass("outline", "icon")} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 px-4 py-2 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary-soft ring-1 ring-primary/40" /> Preventivo</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success-soft ring-1 ring-success/40" /> Aseo</span>
      </div>

      {/* Escritorio / tablet: cuadrícula */}
      <div className="hidden grid-cols-7 border-t border-border sm:grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-b border-border bg-surface-muted py-2 text-center text-xs font-semibold uppercase text-muted">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className={cn("min-h-24 border-b border-r border-border p-1.5", !day && "bg-surface-muted/60", i % 7 === 6 && "border-r-0")}>
            {day && (
              <>
                <p
                  className={cn(
                    "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    day === today ? "bg-primary font-semibold text-white" : "text-muted",
                  )}
                >
                  {Number(day.slice(8))}
                </p>
                <div className="space-y-1">{(byDay.get(day) ?? []).map(chip)}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Móvil: agenda del mes */}
      <ul className="divide-y divide-border border-t border-border sm:hidden">
        {sortedDays.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Sin actividades este mes.</li>}
        {sortedDays.map((d) => (
          <li key={d} className="flex gap-3 px-4 py-3">
            <p className={cn("w-20 shrink-0 text-sm font-medium", d === today && "text-primary")}>{formatDate(d, { year: false })}</p>
            <div className="flex-1 space-y-1">{byDay.get(d)!.map(chip)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { shiftMonth };
