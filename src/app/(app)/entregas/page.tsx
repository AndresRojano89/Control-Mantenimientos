import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import { Badge, Card, EmptyState, MobileList, PageHeader, Table, Td, Th, buttonClass } from "@/components/ui";
import { SearchInput, SelectFilter } from "@/components/filters";
import { DELIVERY_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatQty } from "@/lib/utils";
import type { DeliveryStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Entregas" };

type SP = { q?: string; estado?: string; operario?: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("supply_deliveries")
    .select(
      "id, delivery_number, delivered_at, status, notes, operator:operators(id, full_name), deliverer:profiles!supply_deliveries_delivered_by_fkey(full_name), cleaning:cleaning_maintenances(scheduled_date, schedule:maintenance_schedules(machine:machines(name))), items:supply_delivery_items(delivered_qty, returned_qty, consumed_qty)",
    )
    .order("delivery_number", { ascending: false })
    .limit(300);
  if (sp.estado === "abierta" || sp.estado === "cerrada") q = q.eq("status", sp.estado);
  if (sp.operario) q = q.eq("operator_id", sp.operario);
  if (sp.q && /^\d+$/.test(sp.q.trim())) q = q.eq("delivery_number", Number(sp.q.trim()));

  const [{ data, error }, { data: operators }] = await Promise.all([
    q,
    supabase.from("operators").select("id, full_name").order("full_name"),
  ]);
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as any[];
  if (sp.q && !/^\d+$/.test(sp.q.trim())) {
    const t = sp.q.trim().toLowerCase();
    rows = rows.filter((d) => d.operator.full_name.toLowerCase().includes(t) || d.cleaning.schedule.machine.name.toLowerCase().includes(t));
  }

  const summary = (d: any) => {
    const delivered = d.items.reduce((a: number, i: any) => a + Number(i.delivered_qty), 0);
    const returned = d.items.reduce((a: number, i: any) => a + Number(i.returned_qty), 0);
    const pending = d.status === "cerrada" ? 0 : delivered - returned;
    return { delivered, returned, pending };
  };

  return (
    <>
      <PageHeader
        title="Entregas y devoluciones"
        description="Insumos retirados del almacén y entregados a operarios para cada aseo."
        actions={
          <Link href="/entregas/nueva" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" /> Nueva entrega
          </Link>
        }
      />
      <Card>
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:p-4">
          <SearchInput placeholder="N.º de entrega, operario o máquina" className="flex-1" />
          <SelectFilter name="operario" label="Operario" allLabel="Todos los operarios" options={(operators ?? []).map((o) => ({ value: o.id, label: o.full_name }))} />
          <SelectFilter name="estado" label="Estado" allLabel="Todos los estados" options={[{ value: "abierta", label: "Abiertas (pendientes)" }, { value: "cerrada", label: "Cerradas" }]} />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={sp.q || sp.estado || sp.operario ? "Sin resultados" : "Aún no hay entregas"}
            description="Registre una entrega desde aquí o desde el aseo en Programación."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>N.º</Th>
                  <Th>Fecha</Th>
                  <Th>Máquina / aseo</Th>
                  <Th>Recibe</Th>
                  <Th>Entregó</Th>
                  <Th className="text-right">Entregado</Th>
                  <Th className="text-right">Devuelto</Th>
                  <Th className="text-right">Pendiente</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const s = summary(d);
                  return (
                    <tr key={d.id} className="hover:bg-surface-muted">
                      <Td><Link href={`/entregas/${d.id}`} className="font-medium text-primary hover:underline">#{d.delivery_number}</Link></Td>
                      <Td className="whitespace-nowrap">{formatDateTime(d.delivered_at)}</Td>
                      <Td>{d.cleaning.schedule.machine.name}<span className="block text-xs text-muted">Aseo {formatDate(d.cleaning.scheduled_date)}</span></Td>
                      <Td>{d.operator.full_name}</Td>
                      <Td className="text-muted">{d.deliverer?.full_name}</Td>
                      <Td className="tabular text-right">{formatQty(s.delivered)}</Td>
                      <Td className="tabular text-right">{formatQty(s.returned)}</Td>
                      <Td className="tabular text-right">{s.pending > 0 ? <span className="font-medium text-warning">{formatQty(s.pending)}</span> : "—"}</Td>
                      <Td><Badge tone={DELIVERY_STATUS[d.status as DeliveryStatus].tone}>{DELIVERY_STATUS[d.status as DeliveryStatus].label}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <MobileList>
              {rows.map((d) => {
                const s = summary(d);
                return (
                  <li key={d.id}>
                    <Link href={`/entregas/${d.id}`} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-medium">#{d.delivery_number} · {d.cleaning.schedule.machine.name}</p>
                        <p className="text-sm text-muted">{d.operator.full_name}</p>
                        <p className="text-xs text-muted">{formatDateTime(d.delivered_at)}{s.pending > 0 && ` · ${formatQty(s.pending)} pendiente(s)`}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge tone={DELIVERY_STATUS[d.status as DeliveryStatus].tone}>{DELIVERY_STATUS[d.status as DeliveryStatus].label}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </MobileList>
          </>
        )}
      </Card>
    </>
  );
}
