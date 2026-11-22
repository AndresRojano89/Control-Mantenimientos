import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Undo2 } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, MobileList, PageHeader, Table, Td, Th } from "@/components/ui";
import { DELIVERY_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatQty } from "@/lib/utils";
import type { DeliveryStatus } from "@/lib/types";
import { CloseButton, ReturnButton, type PendingItem } from "./actions-panel";

export const metadata: Metadata = { title: "Detalle de entrega" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("supply_deliveries")
    .select(
      `id, delivery_number, delivered_at, status, notes, closed_at, close_notes, operator_id,
       operator:operators(id, full_name),
       deliverer:profiles!supply_deliveries_delivered_by_fkey(full_name),
       closer:profiles!supply_deliveries_closed_by_fkey(full_name),
       cleaning:cleaning_maintenances(id, scheduled_date, status, schedule:maintenance_schedules(id, scheduled_date, machine:machines(name))),
       items:supply_delivery_items(id, requested_qty, delivered_qty, returned_qty, consumed_qty, supply:supplies(id, code, name, unit)),
       returns:supply_returns(id, return_number, returned_at, notes, operator:operators(full_name), receiver:profiles!supply_returns_received_by_fkey(full_name),
         items:supply_return_items(id, quantity, item:supply_delivery_items(supply:supplies(name, unit))))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();
  const del = d as any;
  const open = del.status === "abierta";

  const { data: operators } = open
    ? await supabase.from("operators").select("id, full_name").or(`active.eq.true,id.eq.${del.operator_id}`).order("full_name")
    : { data: [] };

  const items: PendingItem[] = del.items.map((i: any) => ({
    id: i.id,
    name: i.supply.name,
    code: i.supply.code,
    unit: i.supply.unit,
    delivered: Number(i.delivered_qty),
    returned: Number(i.returned_qty),
    pending: open ? Number(i.delivered_qty) - Number(i.returned_qty) - Number(i.consumed_qty) : 0,
  }));
  const returns = [...del.returns].sort((a: any, b: any) => a.return_number - b.return_number);

  return (
    <>
      <Link href="/entregas" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Entregas
      </Link>
      <PageHeader
        title={`Entrega #${del.delivery_number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={DELIVERY_STATUS[del.status as DeliveryStatus].tone}>{DELIVERY_STATUS[del.status as DeliveryStatus].label}</Badge>
            {formatDateTime(del.delivered_at)}
          </span>
        }
        actions={
          open ? (
            <>
              <ReturnButton deliveryId={del.id} items={items} operators={(operators ?? []) as any} defaultOperatorId={del.operator_id} />
              <CloseButton deliveryId={del.id} items={items} />
            </>
          ) : undefined
        }
      />

      <Card className="mb-5">
        <dl className="grid gap-4 p-4 text-sm sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Máquina</dt>
            <dd className="mt-1 font-medium">{del.cleaning.schedule.machine.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Aseo</dt>
            <dd className="mt-1">
              <Link href={`/programacion/${del.cleaning.schedule.id}`} className="text-primary hover:underline">
                {formatDate(del.cleaning.scheduled_date)}
              </Link>
              <span className="block text-xs text-muted">Preventivo {formatDate(del.cleaning.schedule.scheduled_date)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Recibió</dt>
            <dd className="mt-1">
              <Link href={`/operarios/${del.operator.id}`} className="text-primary hover:underline">{del.operator.full_name}</Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Entregó</dt>
            <dd className="mt-1">{del.deliverer?.full_name}</dd>
          </div>
          {del.notes && (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-xs font-semibold uppercase text-muted">Observaciones</dt>
              <dd className="mt-1 whitespace-pre-line">{del.notes}</dd>
            </div>
          )}
          {!open && (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-xs font-semibold uppercase text-muted">Cierre</dt>
              <dd className="mt-1">
                {formatDateTime(del.closed_at)} por {del.closer?.full_name}
                {del.close_notes && <span className="block text-muted">{del.close_notes}</span>}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      <Card className="mb-5">
        <CardHeader title="Productos" description="Solicitado, entregado, devuelto, consumido y pendiente de devolución." />
        <Table>
          <thead>
            <tr>
              <Th>Producto</Th>
              <Th className="text-right">Solicitado</Th>
              <Th className="text-right">Entregado</Th>
              <Th className="text-right">Devuelto</Th>
              <Th className="text-right">Consumido</Th>
              <Th className="text-right">Pendiente</Th>
            </tr>
          </thead>
          <tbody>
            {del.items.map((i: any) => {
              const pending = open ? Number(i.delivered_qty) - Number(i.returned_qty) : 0;
              return (
                <tr key={i.id}>
                  <Td>
                    <Link href={`/inventario/${i.supply.id}`} className="font-medium text-primary hover:underline">{i.supply.name}</Link>
                    <span className="block font-mono text-xs text-muted">{i.supply.code ?? "Sin código"}</span>
                  </Td>
                  <Td className="tabular text-right text-muted">{i.requested_qty === null ? "—" : formatQty(i.requested_qty)}</Td>
                  <Td className="tabular text-right font-medium">{formatQty(i.delivered_qty)} <span className="text-xs font-normal text-muted">{i.supply.unit}</span></Td>
                  <Td className="tabular text-right">{formatQty(i.returned_qty)}</Td>
                  <Td className="tabular text-right">{open ? <span className="text-muted">Al cerrar</span> : formatQty(i.consumed_qty)}</Td>
                  <Td className="tabular text-right">{pending > 0 ? <span className="font-medium text-warning">{formatQty(pending)}</span> : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <MobileList>
          {del.items.map((i: any) => (
            <li key={i.id} className="p-4 text-sm">
              <p className="font-medium">{i.supply.name}</p>
              <p className="font-mono text-xs text-muted">{i.supply.code ?? "Sin código"}</p>
              <dl className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
                <div><dt className="text-muted">Entreg.</dt><dd className="tabular font-semibold">{formatQty(i.delivered_qty)}</dd></div>
                <div><dt className="text-muted">Devuelto</dt><dd className="tabular font-semibold">{formatQty(i.returned_qty)}</dd></div>
                <div><dt className="text-muted">Consum.</dt><dd className="tabular font-semibold">{open ? "—" : formatQty(i.consumed_qty)}</dd></div>
                <div><dt className="text-muted">Pend.</dt><dd className="tabular font-semibold text-warning">{open ? formatQty(Number(i.delivered_qty) - Number(i.returned_qty)) : "—"}</dd></div>
              </dl>
            </li>
          ))}
        </MobileList>
      </Card>

      <Card>
        <CardHeader title="Devoluciones" description="Asociadas a esta entrega." />
        {returns.length === 0 ? (
          <EmptyState icon={Undo2} title="Sin devoluciones" description={open ? "Registre lo que el operario devuelva sin usar." : undefined} />
        ) : (
          <ul className="divide-y divide-border">
            {returns.map((r: any) => (
              <li key={r.id} className="px-4 py-3 text-sm sm:px-5">
                <p className="font-medium">Devolución #{r.return_number} <span className="font-normal text-muted">· {formatDateTime(r.returned_at)}</span></p>
                <p className="text-xs text-muted">Devolvió {r.operator.full_name} · recibió {r.receiver?.full_name}</p>
                <ul className="mt-1">
                  {r.items.map((ri: any) => (
                    <li key={ri.id}>{formatQty(ri.quantity)} {ri.item.supply.unit} · {ri.item.supply.name}</li>
                  ))}
                </ul>
                {r.notes && <p className="mt-1 text-xs text-muted">{r.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
