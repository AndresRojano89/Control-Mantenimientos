import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Card, EmptyState, MobileList, PageHeader, Table, Td, Th } from "@/components/ui";
import { DateFilter, SelectFilter } from "@/components/filters";
import { ExportButtons } from "@/components/export-buttons";
import { requireProfile } from "@/lib/auth";
import { MAINTENANCE_STATUS_OPTIONS, MOVEMENT_TYPE } from "@/lib/labels";
import { buildReport, type ReportFilters, type ReportKey } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatQty } from "@/lib/utils";

export const metadata: Metadata = { title: "Historial y reportes" };

const TABS: { key: ReportKey; label: string; adminOnly?: boolean }[] = [
  { key: "mantenimientos", label: "Mantenimientos" },
  { key: "entregas", label: "Entregas" },
  { key: "devoluciones", label: "Devoluciones" },
  { key: "movimientos", label: "Movimientos" },
  { key: "consumo", label: "Consumo por producto" },
  { key: "auditoria", label: "Auditoría", adminOnly: true },
];

type SP = ReportFilters & { r?: string };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const tabs = TABS.filter((t) => !t.adminOnly || profile.role === "admin");
  const key = (tabs.find((t) => t.key === sp.r)?.key ?? "mantenimientos") as ReportKey;
  const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const filters: ReportFilters = { ...sp, desde: valid(sp.desde), hasta: valid(sp.hasta) };

  const supabase = await createClient();
  const [report, { data: machines }, { data: operators }, { data: supplies }] = await Promise.all([
    buildReport(supabase, key, filters),
    supabase.from("machines").select("id, name").order("name"),
    supabase.from("operators").select("id, full_name").order("full_name"),
    supabase.from("supplies").select("id, code, name").order("name"),
  ]);
  const has = (f: keyof ReportFilters) => report.supports.includes(f);

  const subtitleParts = [
    filters.desde || filters.hasta ? `Periodo: ${filters.desde ? formatDate(filters.desde) : "inicio"} – ${filters.hasta ? formatDate(filters.hasta) : "hoy"}` : "Todo el periodo",
    filters.maquina && has("maquina") ? `Máquina: ${machines?.find((m) => m.id === filters.maquina)?.name}` : null,
    filters.operario && has("operario") ? `Operario: ${operators?.find((o) => o.id === filters.operario)?.full_name}` : null,
    filters.producto && has("producto") ? `Producto: ${supplies?.find((s) => s.id === filters.producto)?.name}` : null,
    `${report.rows.length} registro(s)`,
  ].filter(Boolean);

  const tabHref = (k: string) => {
    const q = new URLSearchParams();
    q.set("r", k);
    for (const f of ["desde", "hasta", "maquina", "operario", "producto"] as const) if (filters[f]) q.set(f, filters[f]!);
    return `/historial?${q}`;
  };

  return (
    <>
      <PageHeader title="Historial y reportes" description="Consultas sobre los registros reales. Los datos históricos no se pueden modificar." />

      <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Reportes">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            aria-current={t.key === key ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-2 text-sm",
              t.key === key ? "bg-primary text-white" : "bg-surface text-muted ring-1 ring-border hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <Card>
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4">
          <DateFilter name="desde" label="Desde" />
          <DateFilter name="hasta" label="Hasta" />
          {has("maquina") && (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Máquina
              <SelectFilter name="maquina" label="Máquina" allLabel="Todas" className="sm:w-full" options={(machines ?? []).map((m) => ({ value: m.id, label: m.name }))} />
            </label>
          )}
          {has("operario") && (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Operario
              <SelectFilter name="operario" label="Operario" allLabel="Todos" className="sm:w-full" options={(operators ?? []).map((o) => ({ value: o.id, label: o.full_name }))} />
            </label>
          )}
          {has("producto") && (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Producto
              <SelectFilter
                name="producto" label="Producto" allLabel="Todos" className="sm:w-full"
                options={(supplies ?? []).map((s) => ({ value: s.id, label: `${s.code ? `${s.code} · ` : ""}${s.name}` }))}
              />
            </label>
          )}
          {has("tipo") && (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Tipo de movimiento
              <SelectFilter name="tipo" label="Tipo de movimiento" allLabel="Todos" className="sm:w-full" options={Object.entries(MOVEMENT_TYPE).map(([value, v]) => ({ value, label: v.label }))} />
            </label>
          )}
          {has("estado") && (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Estado
              <SelectFilter
                name="estado" label="Estado" allLabel="Todos" className="sm:w-full"
                options={key === "entregas" ? [{ value: "abierta", label: "Abierta" }, { value: "cerrada", label: "Cerrada" }] : MAINTENANCE_STATUS_OPTIONS}
              />
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{report.title}</p>
            <p className="text-xs text-muted">{subtitleParts.join(" · ")}</p>
          </div>
          <ExportButtons title={report.title} subtitle={subtitleParts.join(" · ")} columns={report.columns} rows={report.rows} />
        </div>

        {report.rows.length === 0 ? (
          <EmptyState icon={FileSearch} title="Sin registros" description="No hay datos para los filtros seleccionados." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  {report.columns.map((c) => (
                    <Th key={c.key} className={c.numeric ? "text-right" : undefined}>{c.label}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-muted">
                    {report.columns.map((c) => (
                      <Td key={c.key} className={cn(c.numeric && "tabular text-right", c.key === "fecha" && "whitespace-nowrap")}>
                        {c.numeric && r[c.key] !== "" ? formatQty(r[c.key] as number) : (r[c.key] ?? "—")}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
            <MobileList>
              {report.rows.map((r, i) => (
                <li key={i} className="p-4">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                    {report.columns.map((c) => (
                      <div key={c.key} className="contents">
                        <dt className="text-muted">{c.label}</dt>
                        <dd className={cn("min-w-0 break-words", c.numeric && "tabular")}>
                          {c.numeric && r[c.key] !== "" ? formatQty(r[c.key] as number) : (r[c.key] || "—")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </MobileList>
          </>
        )}
      </Card>
    </>
  );
}
