import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, History } from "lucide-react";
import { Alert, Badge, Card, CardHeader, EmptyState, MobileList, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { MOVEMENT_TYPE, STOCK_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatQty } from "@/lib/utils";
import type { MovementType, StockStatus, Supply } from "@/lib/types";
import { AdjustButton, EntryButton, SupplyActiveToggle, SupplyFormButton } from "../forms";

export const metadata: Metadata = { title: "Producto" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function SupplyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  const { data } = await supabase.from("v_supply_stock_status").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const s = data as Supply;

  const [{ data: movements }, { data: pendingItems }, { data: cats }] = await Promise.all([
    supabase
      .from("inventory_movements")
      .select("id, movement_number, movement_type, quantity, balance_after, reason, created_at, delivery_id, user:profiles!inventory_movements_created_by_fkey(full_name)")
      .eq("supply_id", id)
      .order("movement_number", { ascending: false })
      .limit(200),
    supabase.from("v_delivery_items").select("delivery_id, delivery_number, pending_qty, delivered_qty, returned_qty").eq("supply_id", id).eq("delivery_status", "abierta"),
    supabase.from("supplies").select("category"),
  ]);
  const categories = [...new Set((cats ?? []).map((c) => c.category))].sort();
  const pendingTotal = (pendingItems ?? []).reduce((a, i: any) => a + Number(i.pending_qty), 0);
  const movs = (movements ?? []) as any[];
  const totals = movs.reduce(
    (acc, m) => {
      if (m.movement_type === "entrega") acc.delivered += Number(m.quantity);
      if (m.movement_type === "devolucion") acc.returned += Number(m.quantity);
      if (m.movement_type === "entrada") acc.entries += Number(m.quantity);
      return acc;
    },
    { delivered: 0, returned: 0, entries: 0 },
  );

  return (
    <>
      <Link href="/inventario" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Inventario
      </Link>
      <PageHeader
        title={s.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{s.code ?? "Sin código"}</span>
            <span>· {s.category} · {s.unit}</span>
            {s.location && <span>· {s.location}</span>}
            {!s.active ? (
              <Badge>Inactivo</Badge>
            ) : s.pending_validation ? (
              <Badge tone="warning">Por validar</Badge>
            ) : (
              <Badge tone={STOCK_STATUS[s.stock_status as StockStatus].tone}>{STOCK_STATUS[s.stock_status as StockStatus].label}</Badge>
            )}
          </span>
        }
        actions={
          <>
            {s.active && !s.pending_validation && <EntryButton supplies={[s]} supplyId={s.id} />}
            {isAdmin && <SupplyFormButton supply={s} categories={categories} />}
            {isAdmin && s.active && <AdjustButton supply={s} />}
            {isAdmin && <SupplyActiveToggle supply={s} />}
          </>
        }
      />

      {s.pending_validation && (
        <Alert tone="warning" icon={AlertTriangle} title="Producto pendiente de validación" className="mb-5">
          {s.validation_notes ?? "Faltan datos por confirmar."} {isAdmin ? "Edítelo y desmarque la opción cuando esté confirmado." : "El administrador debe validarlo antes de usarlo."}
        </Alert>
      )}
      {s.description && <p className="-mt-2 mb-5 text-sm text-muted">{s.description}</p>}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Disponible" value={`${formatQty(s.stock)}`} hint={`Mínimo ${formatQty(s.min_stock)} ${s.unit}`} />
        <Stat label="En poder de operarios" value={formatQty(pendingTotal)} hint="Entregado, pendiente de devolver o cerrar" />
        <Stat label="Total entregado" value={formatQty(totals.delivered)} hint={`Devuelto ${formatQty(totals.returned)}`} />
        <Stat label="Cantidad de referencia" value={s.reference_qty === null ? "—" : formatQty(s.reference_qty)} hint="De la lista de pedido (no es existencia)" />
      </div>

      <Card>
        <CardHeader title="Movimientos (kárdex)" description="Historial inalterable. Saldo después de cada movimiento." />
        {movs.length === 0 ? (
          <EmptyState icon={History} title="Sin movimientos" description="Registre una entrada para cargar las existencias reales." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>N.º</Th>
                  <Th>Fecha</Th>
                  <Th>Tipo</Th>
                  <Th className="text-right">Cantidad</Th>
                  <Th className="text-right">Saldo</Th>
                  <Th>Detalle</Th>
                  <Th>Usuario</Th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => {
                  const t = MOVEMENT_TYPE[m.movement_type as MovementType];
                  return (
                    <tr key={m.id}>
                      <Td className="tabular text-muted">{m.movement_number}</Td>
                      <Td className="whitespace-nowrap">{formatDateTime(m.created_at)}</Td>
                      <Td><Badge tone={t.tone}>{t.label}</Badge></Td>
                      <Td className={`tabular text-right font-medium ${t.sign < 0 ? "text-danger" : "text-success"}`}>
                        {t.sign < 0 ? "−" : "+"}
                        {formatQty(m.quantity)}
                      </Td>
                      <Td className="tabular text-right">{formatQty(m.balance_after)}</Td>
                      <Td>
                        {m.delivery_id ? (
                          <Link href={`/entregas/${m.delivery_id}`} className="text-primary hover:underline">{m.reason}</Link>
                        ) : (
                          <span className="text-muted">{m.reason ?? "—"}</span>
                        )}
                      </Td>
                      <Td className="text-muted">{m.user?.full_name ?? "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <MobileList>
              {movs.map((m) => {
                const t = MOVEMENT_TYPE[m.movement_type as MovementType];
                return (
                  <li key={m.id} className="flex items-start justify-between gap-3 p-4 text-sm">
                    <div>
                      <Badge tone={t.tone}>{t.label}</Badge>
                      <p className="mt-1 text-xs text-muted">{formatDateTime(m.created_at)} · {m.user?.full_name}</p>
                      {m.reason && <p className="text-xs text-muted">{m.reason}</p>}
                    </div>
                    <div className="text-right">
                      <p className={`tabular font-semibold ${t.sign < 0 ? "text-danger" : "text-success"}`}>
                        {t.sign < 0 ? "−" : "+"}
                        {formatQty(m.quantity)}
                      </p>
                      <p className="tabular text-xs text-muted">Saldo {formatQty(m.balance_after)}</p>
                    </div>
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
