import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Ban, ClipboardCheck, Package, PackageX } from "lucide-react";
import { Badge, Card, EmptyState, MobileList, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { SearchInput, SelectFilter } from "@/components/filters";
import { requireProfile } from "@/lib/auth";
import { STOCK_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn, formatQty } from "@/lib/utils";
import type { StockStatus, Supply } from "@/lib/types";
import { EntryButton, SupplyFormButton } from "./forms";

export const metadata: Metadata = { title: "Inventario" };

type SP = { q?: string; categoria?: string; estado?: string };

function StockBadge({ s }: { s: Supply }) {
  if (!s.active) return <Badge>Inactivo</Badge>;
  if (s.pending_validation) return <Badge tone="warning">Por validar</Badge>;
  const st = STOCK_STATUS[s.stock_status as StockStatus];
  return <Badge tone={st.tone}>{st.label}</Badge>;
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  const { data: all, error } = await supabase.from("v_supply_stock_status").select("*").order("category").order("name");
  if (error) throw new Error(error.message);
  const supplies = (all ?? []) as Supply[];
  const categories = [...new Set(supplies.map((s) => s.category))].sort();

  const term = sp.q?.trim().toLowerCase();
  const filtered = supplies.filter((s) => {
    if (term && !s.name.toLowerCase().includes(term) && !(s.code ?? "").toLowerCase().includes(term)) return false;
    if (sp.categoria && s.category !== sp.categoria) return false;
    switch (sp.estado) {
      case "bajo":
        return s.active && !s.pending_validation && s.stock_status === "bajo";
      case "agotado":
        return s.active && !s.pending_validation && s.stock_status === "agotado";
      case "validar":
        return s.pending_validation;
      case "inactivo":
        return !s.active;
      default:
        return sp.estado === "todos" ? true : s.active;
    }
  });

  const activeOperable = supplies.filter((s) => s.active && !s.pending_validation);
  const low = activeOperable.filter((s) => s.stock_status === "bajo").length;
  const out = activeOperable.filter((s) => s.stock_status === "agotado").length;
  const toValidate = supplies.filter((s) => s.active && s.pending_validation).length;

  return (
    <>
      <PageHeader
        title="Inventario de insumos"
        description="Existencias reales. Cambian solo con entradas, entregas, devoluciones y ajustes. Abra un producto para ver su kárdex, ajustarlo o desactivarlo."
        actions={
          <>
            <EntryButton supplies={supplies} />
            {isAdmin && <SupplyFormButton categories={categories} />}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/inventario"><Stat label="Productos activos" value={supplies.filter((s) => s.active).length} icon={Package} tone="primary" /></Link>
        <Link href="/inventario?estado=bajo"><Stat label="Stock bajo" value={low} icon={AlertTriangle} tone="warning" /></Link>
        <Link href="/inventario?estado=agotado"><Stat label="Agotados" value={out} icon={PackageX} tone="danger" /></Link>
        <Link href="/inventario?estado=validar"><Stat label="Por validar" value={toValidate} icon={ClipboardCheck} tone="warning" hint="Datos incompletos" /></Link>
      </div>

      <Card>
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:p-4">
          <SearchInput placeholder="Buscar por código o nombre" className="flex-1" />
          <SelectFilter name="categoria" label="Categoría" allLabel="Todas las categorías" options={categories.map((c) => ({ value: c, label: c }))} />
          <SelectFilter
            name="estado"
            label="Estado"
            allLabel="Activos"
            options={[
              { value: "bajo", label: "Stock bajo" },
              { value: "agotado", label: "Agotados" },
              { value: "validar", label: "Pendientes de validación" },
              { value: "inactivo", label: "Inactivos" },
              { value: "todos", label: "Todos" },
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Ban} title="Sin productos" description="Ningún producto coincide con la búsqueda o los filtros." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Código</Th>
                  <Th>Producto</Th>
                  <Th className="text-right">Existencia</Th>
                  <Th className="text-right">Mínimo</Th>
                  <Th className="text-right">Referencia</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className={cn("hover:bg-surface-muted", !s.active && "opacity-60")}>
                    <Td className="font-mono text-xs">{s.code ?? <span className="font-sans text-warning">Sin código</span>}</Td>
                    <Td>
                      <Link href={`/inventario/${s.id}`} className="font-medium text-primary hover:underline">
                        {s.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {s.category}
                        {s.location && ` · ${s.location}`}
                      </p>
                      {s.pending_validation && s.validation_notes && <p className="mt-1 text-xs text-warning">{s.validation_notes}</p>}
                    </Td>
                    <Td className="tabular text-right font-medium">
                      {formatQty(s.stock)} <span className="text-xs font-normal text-muted">{s.unit}</span>
                    </Td>
                    <Td className="tabular text-right text-muted">{formatQty(s.min_stock)}</Td>
                    <Td className="tabular text-right text-muted">{s.reference_qty === null ? "—" : formatQty(s.reference_qty)}</Td>
                    <Td><StockBadge s={s} /></Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {s.active && !s.pending_validation && <EntryButton supplies={supplies} supplyId={s.id} size="sm" />}
                        {isAdmin && <SupplyFormButton supply={s} categories={categories} />}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <MobileList>
              {filtered.map((s) => (
                <li key={s.id} className="p-4">
                  <Link href={`/inventario/${s.id}`} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted">
                        {s.code ?? "Sin código"} · {s.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular font-semibold">
                        {formatQty(s.stock)} <span className="text-xs font-normal text-muted">{s.unit}</span>
                      </p>
                      <StockBadge s={s} />
                    </div>
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.active && !s.pending_validation && <EntryButton supplies={supplies} supplyId={s.id} size="sm" />}
                    {isAdmin && <SupplyFormButton supply={s} categories={categories} />}
                  </div>
                </li>
              ))}
            </MobileList>
          </>
        )}
      </Card>
    </>
  );
}
