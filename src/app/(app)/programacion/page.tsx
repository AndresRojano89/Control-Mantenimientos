import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CalendarX2, ChevronRight, List, Sparkles, Users } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { SelectFilter } from "@/components/filters";
import { requireProfile } from "@/lib/auth";
import { MAINTENANCE_STATUS, MAINTENANCE_STATUS_OPTIONS } from "@/lib/labels";
import { fetchSchedules, type ScheduleRow } from "@/lib/queries";
import { scheduleAlerts } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, cn, diffDaysISO, formatDate, formatTime, todayISO } from "@/lib/utils";
import { MonthCalendar, monthRange } from "./calendar";
import { ScheduleFormButton } from "./forms";

export const metadata: Metadata = { title: "Programación" };

type SP = { vista?: string; mes?: string; maquina?: string; estado?: string; pasados?: string };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const today = todayISO();
  const view = sp.vista === "calendario" ? "calendario" : "lista";
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : today.slice(0, 7);
  const showPast = sp.pasados === "1";

  const supabase = await createClient();
  const { data: machines } = await supabase.from("machines").select("id, name, active").order("name");

  let schedules: ScheduleRow[];
  if (view === "calendario") {
    const { from, to } = monthRange(month);
    schedules = await fetchSchedules(supabase, { from, to: addDaysISO(to, 31), machineId: sp.maquina, status: sp.estado });
  } else {
    schedules = await fetchSchedules(supabase, {
      from: showPast ? undefined : addDaysISO(today, -7),
      machineId: sp.maquina,
      status: sp.estado,
      ascending: !showPast,
    });
    if (!showPast) {
      // Los de la última semana solo se muestran si siguen abiertos.
      schedules = schedules.filter((s) => s.scheduled_date >= today || !["completado", "cancelado"].includes(s.status));
    }
  }

  const alerts = schedules
    .flatMap((s) => scheduleAlerts(s, today).map((a) => ({ ...a, schedule: s })))
    .sort((a, b) => (a.tone === "danger" ? -1 : 1) - (b.tone === "danger" ? -1 : 1));

  const baseQuery = new URLSearchParams(
    Object.entries({ maquina: sp.maquina, estado: sp.estado }).filter(([, v]) => v) as [string, string][],
  );
  const viewHref = (v: string) => {
    const q = new URLSearchParams(baseQuery);
    if (v === "calendario") q.set("vista", "calendario");
    return `/programacion${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Programación"
        description="Mantenimientos preventivos y los aseos que deben hacerse antes."
        actions={isAdmin ? <ScheduleFormButton machines={(machines ?? []) as { id: string; name: string; active: boolean }[]} /> : undefined}
      />

      {alerts.length > 0 && view === "lista" && (
        <Card className="mb-5 border-warning/40">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" /> Requieren atención ({alerts.length})
              </span>
            }
          />
          <ul className="divide-y divide-border">
            {alerts.map((a, i) => (
              <li key={i}>
                <Link href={`/programacion/${a.schedule.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted sm:px-5">
                  <Badge tone={a.tone}>{a.schedule.machine.name}</Badge>
                  <span className="flex-1 text-muted">{a.message}</span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="flex rounded-md border border-border p-0.5" role="tablist" aria-label="Vista">
            <Link
              href={viewHref("lista")}
              className={cn("flex h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-sm", view === "lista" ? "bg-primary-soft font-medium text-primary" : "text-muted")}
              aria-current={view === "lista" ? "page" : undefined}
            >
              <List className="h-4 w-4" /> Lista
            </Link>
            <Link
              href={viewHref("calendario")}
              className={cn("flex h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-sm", view === "calendario" ? "bg-primary-soft font-medium text-primary" : "text-muted")}
              aria-current={view === "calendario" ? "page" : undefined}
            >
              <CalendarDays className="h-4 w-4" /> Calendario
            </Link>
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
            <SelectFilter name="maquina" label="Máquina" allLabel="Todas las máquinas" options={(machines ?? []).map((m) => ({ value: m.id, label: m.name }))} />
            <SelectFilter name="estado" label="Estado del preventivo" allLabel="Todos los estados" options={MAINTENANCE_STATUS_OPTIONS} />
          </div>
        </div>

        {view === "calendario" ? (
          <MonthCalendar month={month} schedules={schedules} today={today} baseQuery={baseQuery} />
        ) : schedules.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title={showPast ? "No hay mantenimientos registrados" : "No hay mantenimientos próximos"}
            description={isAdmin ? "Programe un mantenimiento preventivo para empezar." : "El administrador aún no ha programado mantenimientos."}
          />
        ) : (
          <ul className="divide-y divide-border">
            {schedules.map((s) => (
              <ScheduleItem key={s.id} s={s} today={today} />
            ))}
          </ul>
        )}

        {view === "lista" && (
          <div className="border-t border-border px-4 py-3 text-center">
            <Link
              href={showPast ? viewHref("lista") : `${viewHref("lista")}${baseQuery.size ? "&" : "?"}pasados=1`}
              className="text-sm text-primary hover:underline"
            >
              {showPast ? "Ver solo próximos" : "Ver todo el historial (incluye anteriores)"}
            </Link>
          </div>
        )}
      </Card>
    </>
  );
}

function dayPart(iso: string, part: "weekday" | "month") {
  return new Intl.DateTimeFormat("es-CO", { [part]: "short", timeZone: "UTC" })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace(".", "");
}

function ScheduleItem({ s, today }: { s: ScheduleRow; today: string }) {
  const days = diffDaysISO(today, s.scheduled_date);
  const alerts = scheduleAlerts(s, today);
  const dayLabel = days === 0 ? "Hoy" : days === 1 ? "Mañana" : days > 1 ? `En ${days} días` : `Hace ${-days} días`;
  return (
    <li>
      <Link href={`/programacion/${s.id}`} className="block px-4 py-4 hover:bg-surface-muted sm:px-5">
        <div className="flex items-start gap-4">
          <div className={cn("w-14 shrink-0 rounded-md border py-1.5 text-center", days === 0 ? "border-primary bg-primary text-white" : "border-border bg-surface")}>
            <p className="text-[11px] uppercase leading-3 opacity-80">{dayPart(s.scheduled_date, "weekday")}</p>
            <p className="text-xl font-semibold leading-6">{Number(s.scheduled_date.slice(8))}</p>
            <p className="text-[11px] uppercase leading-3 opacity-80">{dayPart(s.scheduled_date, "month")}</p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{s.machine.name}</p>
              <Badge tone={MAINTENANCE_STATUS[s.status].tone}>{MAINTENANCE_STATUS[s.status].label}</Badge>
              {alerts.some((a) => a.tone === "danger") ? (
                <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> Atención</Badge>
              ) : alerts.length ? (
                <Badge tone="warning"><AlertTriangle className="h-3 w-3" /> Revisar</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted">
              {s.maintenance_type} · {dayLabel}
              {s.scheduled_time && ` · ${formatTime(s.scheduled_time)}`}
            </p>
            {s.cleanings.length === 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                <Sparkles className="h-3.5 w-3.5" /> Aseo sin programar
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {s.cleanings.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <Sparkles className="h-3.5 w-3.5 text-success" />
                    <span>Aseo {formatDate(c.scheduled_date, { year: false })}</span>
                    <Badge tone={MAINTENANCE_STATUS[c.status].tone}>{MAINTENANCE_STATUS[c.status].label}</Badge>
                    <span className="flex items-center gap-1 text-muted">
                      <Users className="h-3.5 w-3.5" />
                      {c.operators.length ? c.operators.map((o) => o.full_name).join(", ") : "Sin operarios"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" />
        </div>
      </Link>
    </li>
  );
}
