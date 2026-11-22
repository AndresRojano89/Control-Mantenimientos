import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ClipboardList, Package, Plus, Sparkles, Users } from "lucide-react";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { DELIVERY_STATUS, MAINTENANCE_STATUS, STOCK_STATUS } from "@/lib/labels";
import { SCHEDULE_SELECT, normalizeSchedule } from "@/lib/queries";
import { scheduleAlerts } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatQty, formatTime, todayISO } from "@/lib/utils";
import type { StockStatus } from "@/lib/types";
import { CleaningFormButton, ScheduleFormButton, StatusSelect } from "../forms";

export const metadata: Metadata = { title: "Mantenimiento" };

function Lines({ text }: { text: string | null }) {
  if (!text) return <span className="text-muted">—</span>;
  return (
    <ul className="list-inside list-disc space-y-0.5">
      {text.split("\n").filter((l) => l.trim()).map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  const { data: raw } = await supabase.from("maintenance_schedules").select(SCHEDULE_SELECT).eq("id", id).maybeSingle();
  if (!raw) notFound();
  const s = normalizeSchedule(raw);
  const today = todayISO();
  const alerts = scheduleAlerts(s, today);
  const cleaningIds = s.cleanings.map((c) => c.id);

  const [{ data: operators }, { data: machines }, { data: deliveries }, { data: refSupplies }] = await Promise.all([
    supabase.from("operators").select("id, full_name, active").order("full_name"),
    supabase.from("machines").select("id, name, active").order("name"),
    cleaningIds.length
      ? supabase
          .from("supply_deliveries")
          .select("id, delivery_number, delivered_at, status, cleaning_id, operator:operators(full_name), items:supply_delivery_items(id)")
          .in("cleaning_id", cleaningIds)
          .order("delivered_at")
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("v_supply_stock_status")
      .select("id, code, name, unit, stock, reference_qty, stock_status, pending_validation")
      .not("reference_qty", "is", null)
      .eq("active", true)
      .order("name"),
  ]);

  const delsByCleaning = new Map<string, any[]>();
  for (const d of (deliveries ?? []) as any[]) delsByCleaning.set(d.cleaning_id, [...(delsByCleaning.get(d.cleaning_id) ?? []), d]);
  const ops = (operators ?? []) as { id: string; full_name: string; active: boolean }[];

  return (
    <>
      <Link href="/programacion" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Programación
      </Link>
      <PageHeader
        title={`${s.maintenance_type} · ${s.machine.name}`}
        description={`${formatDate(s.scheduled_date)}${s.scheduled_time ? ` · ${formatTime(s.scheduled_time)}` : ""}`}
        actions={
          isAdmin ? (
            <>
              <StatusSelect kind="schedule" id={s.id} status={s.status} />
              <ScheduleFormButton machines={(machines ?? []) as any} schedule={s} />
            </>
          ) : (
            <Badge tone={MAINTENANCE_STATUS[s.status].tone}>{MAINTENANCE_STATUS[s.status].label}</Badge>
          )
        }
      />

      {alerts.length > 0 && (
        <div className="mb-5 space-y-2">
          {alerts.map((a, i) => (
            <Alert key={i} tone={a.tone} icon={AlertTriangle} title={a.message} />
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader
              title="Mantenimientos de aseo"
              description="Se realizan antes del preventivo. Cada aseo puede tener varios operarios y entregas."
              action={
                s.status !== "cancelado" && s.status !== "completado" ? (
                  <CleaningFormButton scheduleId={s.id} preventiveDate={s.scheduled_date} operators={ops} />
                ) : undefined
              }
            />
            {s.cleanings.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Aseo sin programar"
                description="Programe el aseo previo, asigne los operarios y luego registre la entrega de insumos."
              />
            ) : (
              <ul className="divide-y divide-border">
                {s.cleanings.map((c) => {
                  const dels = delsByCleaning.get(c.id) ?? [];
                  const open = dels.filter((d) => d.status === "abierta").length;
                  const canDeliver = c.status !== "cancelado" && c.status !== "completado";
                  return (
                    <li key={c.id} className="space-y-3 px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            Aseo del {formatDate(c.scheduled_date)}
                            {c.scheduled_time && <span className="text-muted"> · {formatTime(c.scheduled_time)}</span>}
                          </p>
                          {c.completed_at && <p className="text-xs text-muted">Completado el {formatDateTime(c.completed_at)}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusSelect kind="cleaning" id={c.id} status={c.status} />
                          <CleaningFormButton scheduleId={s.id} preventiveDate={s.scheduled_date} operators={ops} cleaning={c} />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        <Users className="h-4 w-4 text-muted" />
                        {c.operators.length ? (
                          c.operators.map((o) => (
                            <Link key={o.id} href={`/operarios/${o.id}`}>
                              <Badge tone="primary">{o.full_name}</Badge>
                            </Link>
                          ))
                        ) : (
                          <span className="text-warning">Sin operarios asignados</span>
                        )}
                      </div>

                      {(c.priorities || c.notes) && (
                        <div className="grid gap-3 rounded-md bg-surface-muted p-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase text-muted">Prioridades</p>
                            <Lines text={c.priorities} />
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase text-muted">Observaciones</p>
                            <p className="whitespace-pre-line">{c.notes ?? "—"}</p>
                          </div>
                        </div>
                      )}

                      <div className="rounded-md border border-border">
                        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                          <p className="flex items-center gap-1.5 text-sm font-medium">
                            <ClipboardList className="h-4 w-4 text-muted" /> Entregas de insumos
                            {open > 0 && <Badge tone="warning">{open} abierta(s)</Badge>}
                          </p>
                          {canDeliver && (
                            <Link href={`/entregas/nueva?aseo=${c.id}`} className={buttonClass("secondary", "sm")}>
                              <Plus className="h-3.5 w-3.5" /> Registrar entrega
                            </Link>
                          )}
                        </div>
                        {dels.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-muted">Aún no se han entregado insumos para este aseo.</p>
                        ) : (
                          <ul className="divide-y divide-border">
                            {dels.map((d) => (
                              <li key={d.id}>
                                <Link href={`/entregas/${d.id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface-muted">
                                  <span>
                                    <span className="font-medium text-primary">#{d.delivery_number}</span>
                                    <span className="text-muted"> · {d.operator.full_name} · {formatDateTime(d.delivered_at)} · {d.items.length} producto(s)</span>
                                  </span>
                                  <Badge tone={DELIVERY_STATUS[d.status as "abierta"].tone}>{DELIVERY_STATUS[d.status as "abierta"].label}</Badge>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {c.status === "completado" && open > 0 && (
                        <Alert tone="warning" icon={AlertTriangle} title="El aseo está completado pero tiene entregas abiertas.">
                          Registre las devoluciones y cierre las entregas para dejar registrado el consumo.
                        </Alert>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Detalle del preventivo" />
            <dl className="space-y-3 px-4 py-4 text-sm sm:px-5">
              <div>
                <dt className="text-xs font-semibold uppercase text-muted">Prioridades o aspectos a revisar</dt>
                <dd className="mt-1"><Lines text={s.priorities} /></dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase text-muted">Observaciones</dt>
                <dd className="mt-1 whitespace-pre-line">{s.notes ?? "—"}</dd>
              </div>
              {s.completed_at && (
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted">Completado</dt>
                  <dd className="mt-1">{formatDateTime(s.completed_at)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Insumos de referencia"
              description="Cantidades de la lista habitual de pedido frente a las existencias reales."
            />
            {(refSupplies ?? []).length === 0 ? (
              <EmptyState icon={Package} title="Sin lista de referencia" description="Defina la cantidad de referencia en el catálogo de insumos." />
            ) : (
              <ul className="divide-y divide-border">
                {(refSupplies ?? []).map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate">{r.name}</p>
                      <p className="text-xs text-muted">
                        {r.code ?? "Sin código"} · Ref. {formatQty(r.reference_qty)} · Disp. {formatQty(r.stock)} {r.unit}
                      </p>
                    </div>
                    {r.pending_validation ? (
                      <Badge tone="warning">Por validar</Badge>
                    ) : (
                      <Badge tone={STOCK_STATUS[r.stock_status as StockStatus].tone}>{STOCK_STATUS[r.stock_status as StockStatus].label}</Badge>
                    )}
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
