import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  PackageX,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { MAINTENANCE_STATUS } from "@/lib/labels";
import { fetchSchedules } from "@/lib/queries";
import { scheduleAlerts } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, diffDaysISO, formatDate, formatQty, formatTime, todayISO, tsToISODate } from "@/lib/utils";
import { TopProductsChart, WeeklyConsumptionChart } from "./charts";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Lunes (YYYY-MM-DD) de la semana de una fecha. */
function mondayOf(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return addDaysISO(iso, -((d.getUTCDay() + 6) % 7));
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: pageError } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();
  const today = todayISO();
  const since30 = addDaysISO(today, -30);
  const weeks = 8;
  const firstWeek = addDaysISO(mondayOf(today), -7 * (weeks - 1));

  const [schedules, { data: stock }, { data: movements }, { data: openDeliveries }, { count: deliveries30 }] = await Promise.all([
    fetchSchedules(supabase, { from: since30 }),
    supabase.from("v_supply_stock_status").select("id, code, name, unit, stock, min_stock, stock_status, pending_validation").eq("active", true),
    supabase
      .from("inventory_movements")
      .select("movement_type, quantity, created_at, supply:supplies(name)")
      .in("movement_type", ["entrega", "devolucion"])
      .gte("created_at", `${firstWeek}T00:00:00-05:00`),
    supabase
      .from("supply_deliveries")
      .select("id, delivery_number, delivered_at, operator:operators(full_name), cleaning:cleaning_maintenances(status, schedule:maintenance_schedules(machine:machines(name)))")
      .eq("status", "abierta")
      .order("delivered_at"),
    supabase.from("supply_deliveries").select("id", { count: "exact", head: true }).gte("delivered_at", `${since30}T00:00:00-05:00`),
  ]);

  // ---- Mantenimientos
  const upcoming = schedules.filter((s) => s.scheduled_date >= today && s.status !== "cancelado" && s.status !== "completado");
  const cleanings = schedules.flatMap((s) => s.cleanings.map((c) => ({ ...c, schedule: s })));
  const todayItems = [
    ...schedules.filter((s) => s.scheduled_date === today && s.status !== "cancelado").map((s) => ({ kind: "Preventivo", s, time: s.scheduled_time, status: s.status })),
    ...cleanings.filter((c) => c.scheduled_date === today && c.status !== "cancelado").map((c) => ({ kind: "Aseo", s: c.schedule, time: c.scheduled_time, status: c.status })),
  ];
  const cleaningsPending = cleanings.filter((c) => ["pendiente", "programado", "en_proceso"].includes(c.status));
  const cleaningsDone30 = cleanings.filter((c) => c.status === "completado" && c.completed_at && tsToISODate(c.completed_at) >= since30);
  const doneTotal30 =
    cleaningsDone30.length + schedules.filter((s) => s.status === "completado" && s.completed_at && tsToISODate(s.completed_at) >= since30).length;

  // ---- Inventario
  const active = ((stock ?? []) as any[]).filter((s) => !s.pending_validation);
  const out = active.filter((s) => s.stock_status === "agotado");
  const low = active.filter((s) => s.stock_status === "bajo");
  const toValidate = ((stock ?? []) as any[]).filter((s) => s.pending_validation);

  // ---- Atención
  const attention: { tone: "danger" | "warning"; text: string; href: string }[] = [];
  for (const s of schedules) {
    for (const a of scheduleAlerts(s, today)) attention.push({ tone: a.tone === "danger" ? "danger" : "warning", text: `${s.machine.name}: ${a.message}`, href: `/programacion/${s.id}` });
  }
  for (const d of (openDeliveries ?? []) as any[]) {
    if (d.cleaning.status === "completado") {
      attention.push({ tone: "warning", text: `Entrega #${d.delivery_number} (${d.cleaning.schedule.machine.name}) sigue abierta aunque el aseo está completado.`, href: `/entregas/${d.id}` });
    }
  }
  if (toValidate.length) {
    attention.push({ tone: "warning", text: `${toValidate.length} producto(s) del catálogo pendientes de validación.`, href: "/inventario?estado=validar" });
  }
  attention.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "danger" ? -1 : 1));

  // ---- Gráficos
  const weekly = Array.from({ length: weeks }, (_, i) => {
    const start = addDaysISO(firstWeek, i * 7);
    return { start, week: formatDate(start, { weekday: false, year: false }), qty: 0 };
  });
  const byProduct = new Map<string, number>();
  for (const m of (movements ?? []) as any[]) {
    const day = tsToISODate(m.created_at);
    const idx = Math.floor(diffDaysISO(firstWeek, day) / 7);
    const sign = m.movement_type === "entrega" ? 1 : -1;
    if (idx >= 0 && idx < weeks) weekly[idx].qty += sign * Number(m.quantity);
    if (m.movement_type === "entrega") byProduct.set(m.supply.name, (byProduct.get(m.supply.name) ?? 0) + Number(m.quantity));
  }
  const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, qty]) => ({ name, qty }));
  const hasConsumption = weekly.some((w) => w.qty !== 0);

  const hello = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" }).format(new Date());

  return (
    <>
      <PageHeader title="Panel principal" description={`Hola, ${profile.full_name.split(" ")[0]}. Hoy es ${hello}.`} />
      {pageError === "sin-permiso" && (
        <Alert tone="warning" icon={AlertTriangle} title="No tiene permisos para ver esa sección." className="mb-4" />
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Hoy" value={todayItems.length} hint="Actividades programadas" icon={CalendarClock} tone="primary" />
        <Stat label="Próx. preventivos" value={upcoming.length} hint="Abiertos desde hoy" icon={CalendarCheck2} tone="info" />
        <Stat label="Aseos pendientes" value={cleaningsPending.length} hint="Sin completar" icon={Sparkles} tone="warning" />
        <Stat label="Realizados" value={doneTotal30} hint={`Mantenimientos, 30 días (${cleaningsDone30.length} aseos)`} icon={CheckCircle2} tone="success" />
        <Stat label="Entregas" value={deliveries30 ?? 0} hint={`Últimos 30 días · ${(openDeliveries ?? []).length} abiertas`} icon={ClipboardList} tone="primary" />
        <Stat label="Stock bajo / agotado" value={`${low.length} / ${out.length}`} hint="Productos activos" icon={PackageX} tone={out.length ? "danger" : "warning"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-warning" /> Requieren atención</span>}
              description="Aseos sin programar o atrasados, entregas sin cerrar y datos por validar."
            />
            {attention.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Todo al día" description="No hay actividades que requieran atención." />
            ) : (
              <ul className="divide-y divide-border">
                {attention.slice(0, 8).map((a, i) => (
                  <li key={i}>
                    <Link href={a.href} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted sm:px-5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${a.tone === "danger" ? "bg-danger" : "bg-warning"}`} aria-hidden />
                      <span className="sr-only">{a.tone === "danger" ? "Urgente:" : "Advertencia:"}</span>
                      <span className="flex-1">{a.text}</span>
                      <ChevronRight className="h-4 w-4 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Consumo neto de insumos por semana" description="Unidades entregadas menos devueltas, últimas 8 semanas (todas las unidades de medida sumadas)." />
            <div className="p-4">
              {hasConsumption ? (
                <WeeklyConsumptionChart data={weekly} />
              ) : (
                <EmptyState icon={BarChart3} title="Aún no hay consumo registrado" description="Aparecerá cuando se confirmen entregas." />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Productos con mayor movimiento" description="Cantidad entregada en las últimas 8 semanas." />
            <div className="p-4">
              {top.length ? <TopProductsChart data={top} /> : <EmptyState icon={BarChart3} title="Sin entregas en el periodo" />}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Programado para hoy" />
            {todayItems.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No hay actividades programadas para hoy.</p>
            ) : (
              <ul className="divide-y divide-border">
                {todayItems.map((t, i) => (
                  <li key={i}>
                    <Link href={`/programacion/${t.s.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-surface-muted sm:px-5">
                      <span>
                        <span className="font-medium">{t.kind}</span> · {t.s.machine.name}
                        {t.time && <span className="text-muted"> · {formatTime(t.time)}</span>}
                      </span>
                      <Badge tone={MAINTENANCE_STATUS[t.status].tone}>{MAINTENANCE_STATUS[t.status].label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Próximos preventivos" action={<Link href="/programacion" className="text-xs text-primary hover:underline">Ver todos</Link>} />
            {upcoming.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No hay preventivos próximos.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.slice(0, 6).map((s) => {
                  const done = s.cleanings.some((c) => c.status === "completado");
                  const planned = s.cleanings.some((c) => c.status !== "cancelado");
                  return (
                    <li key={s.id}>
                      <Link href={`/programacion/${s.id}`} className="block px-4 py-2.5 text-sm hover:bg-surface-muted sm:px-5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{s.machine.name}</span>
                          <span className="text-xs text-muted">{formatDate(s.scheduled_date, { year: false })}</span>
                        </div>
                        <p className="mt-0.5 text-xs">
                          {done ? (
                            <span className="text-success">Aseo completado</span>
                          ) : planned ? (
                            <span className="text-muted">Aseo programado, pendiente</span>
                          ) : (
                            <span className="text-warning">Aseo sin programar</span>
                          )}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Existencias bajas y agotadas" action={<Link href="/inventario?estado=agotado" className="text-xs text-primary hover:underline">Inventario</Link>} />
            {low.length + out.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">Todos los productos están por encima del mínimo.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                {[...out, ...low].map((s: any) => (
                  <li key={s.id}>
                    <Link href={`/inventario/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-surface-muted sm:px-5">
                      <span className="min-w-0">
                        <span className="block">{s.name}</span>
                        <span className="tabular text-xs text-muted">
                          {formatQty(s.stock)} {s.unit} · mín. {formatQty(s.min_stock)}
                        </span>
                      </span>
                      <Badge tone={s.stock_status === "agotado" ? "danger" : "warning"}>{s.stock_status === "agotado" ? "Agotado" : "Bajo"}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
