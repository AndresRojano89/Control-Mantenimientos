import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Sparkles } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, MobileList, PageHeader, Table, Td, Th } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { DELIVERY_STATUS, MAINTENANCE_STATUS } from "@/lib/labels";
import { formatDate, formatDateTime, formatQty } from "@/lib/utils";
import type { Operator } from "@/lib/types";
import { OperatorActiveToggle, OperatorFormButton } from "../operator-form";

export const metadata: Metadata = { title: "Detalle de operario" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function OperatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: operator } = await supabase.from("operators").select("*").eq("id", id).maybeSingle();
  if (!operator) notFound();
  const op = operator as Operator;

  const [{ data: assignments }, { data: deliveries }] = await Promise.all([
    supabase
      .from("maintenance_assignments")
      .select("id, cleaning:cleaning_maintenances(id, scheduled_date, status, schedule:maintenance_schedules(id, scheduled_date, machine:machines(name)))")
      .eq("operator_id", id)
      .not("cleaning_id", "is", null),
    supabase
      .from("supply_deliveries")
      .select(
        "id, delivery_number, delivered_at, status, cleaning:cleaning_maintenances(scheduled_date, schedule:maintenance_schedules(machine:machines(name))), items:supply_delivery_items(id, delivered_qty, returned_qty, consumed_qty, supply:supplies(code, name, unit))",
      )
      .eq("operator_id", id)
      .order("delivered_at", { ascending: false }),
  ]);

  const cleanings = ((assignments ?? []) as any[])
    .map((a) => a.cleaning)
    .filter(Boolean)
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  const dels = (deliveries ?? []) as any[];

  return (
    <>
      <Link href="/operarios" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Operarios
      </Link>
      <PageHeader
        title={op.full_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {op.active ? <Badge tone="success">Activo</Badge> : <Badge>Inactivo</Badge>}
            {op.position && <span>{op.position}</span>}
            {op.code && <span>· Código {op.code}</span>}
          </span>
        }
        actions={
          <>
            <OperatorFormButton operator={op} />
            <OperatorActiveToggle operator={op} />
          </>
        }
      />
      {op.notes && <p className="-mt-2 mb-5 text-sm text-muted">{op.notes}</p>}

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Aseos asignados" description={`${cleanings.length} en total`} />
          {cleanings.length === 0 ? (
            <EmptyState icon={Sparkles} title="Sin aseos asignados" description="Asígnelo desde Programación." />
          ) : (
            <ul className="divide-y divide-border">
              {cleanings.map((c) => (
                <li key={c.id}>
                  <Link href={`/programacion/${c.schedule.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted sm:px-5">
                    <div>
                      <p className="text-sm font-medium">{c.schedule.machine.name}</p>
                      <p className="text-xs text-muted">
                        Aseo {formatDate(c.scheduled_date)} · Preventivo {formatDate(c.schedule.scheduled_date)}
                      </p>
                    </div>
                    <Badge tone={MAINTENANCE_STATUS[c.status as keyof typeof MAINTENANCE_STATUS].tone}>
                      {MAINTENANCE_STATUS[c.status as keyof typeof MAINTENANCE_STATUS].label}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Insumos recibidos" description={`${dels.length} entrega(s)`} />
          {dels.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No ha recibido insumos" />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Entrega</Th>
                    <Th>Producto</Th>
                    <Th className="text-right">Entregado</Th>
                    <Th className="text-right">Devuelto</Th>
                    <Th className="text-right">Consumido</Th>
                  </tr>
                </thead>
                <tbody>
                  {dels.flatMap((d) =>
                    d.items.map((it: any, idx: number) => (
                      <tr key={it.id}>
                        <Td>
                          {idx === 0 && (
                            <Link href={`/entregas/${d.id}`} className="font-medium text-primary hover:underline">
                              #{d.delivery_number}
                            </Link>
                          )}
                          {idx === 0 && (
                            <p className="text-xs text-muted">
                              {formatDateTime(d.delivered_at)} · {d.cleaning.schedule.machine.name}
                            </p>
                          )}
                        </Td>
                        <Td>
                          {it.supply.name}
                          <span className="block text-xs text-muted">{it.supply.code ?? "Sin código"}</span>
                        </Td>
                        <Td className="tabular text-right">{formatQty(it.delivered_qty)}</Td>
                        <Td className="tabular text-right">{formatQty(it.returned_qty)}</Td>
                        <Td className="tabular text-right">{d.status === "cerrada" ? formatQty(it.consumed_qty) : "—"}</Td>
                      </tr>
                    )),
                  )}
                </tbody>
              </Table>
              <MobileList>
                {dels.map((d) => (
                  <li key={d.id} className="p-4">
                    <Link href={`/entregas/${d.id}`} className="flex items-center justify-between">
                      <span className="font-medium text-primary">Entrega #{d.delivery_number}</span>
                      <Badge tone={DELIVERY_STATUS[d.status as keyof typeof DELIVERY_STATUS].tone}>
                        {DELIVERY_STATUS[d.status as keyof typeof DELIVERY_STATUS].label}
                      </Badge>
                    </Link>
                    <p className="text-xs text-muted">
                      {formatDateTime(d.delivered_at)} · {d.cleaning.schedule.machine.name}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {d.items.map((it: any) => (
                        <li key={it.id} className="flex justify-between gap-2">
                          <span>{it.supply.name}</span>
                          <span className="tabular text-muted">
                            {formatQty(it.delivered_qty)} ent. / {formatQty(it.returned_qty)} dev.
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </MobileList>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
