import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { Badge, Card, EmptyState, MobileList, PageHeader, Table, Td, Th } from "@/components/ui";
import { SearchInput, SelectFilter } from "@/components/filters";
import { createClient } from "@/lib/supabase/server";
import { ilikeEscape } from "@/lib/utils";
import type { Operator } from "@/lib/types";
import { OperatorActiveToggle, OperatorFormButton } from "./operator-form";

export const metadata: Metadata = { title: "Operarios" };

export default async function OperatorsPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const { q, estado } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("operators").select("*").order("active", { ascending: false }).order("full_name");
  if (q) {
    const t = ilikeEscape(q);
    query = query.or(`full_name.ilike.%${t}%,code.ilike.%${t}%,position.ilike.%${t}%`);
  }
  if (estado === "activo") query = query.eq("active", true);
  if (estado === "inactivo") query = query.eq("active", false);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const operators = (data ?? []) as Operator[];

  return (
    <>
      <PageHeader
        title="Operarios"
        description="Personal que realiza los aseos y recibe insumos."
        actions={<OperatorFormButton />}
      />
      <Card>
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:p-4">
          <SearchInput placeholder="Buscar por nombre, código o cargo" className="flex-1" />
          <SelectFilter
            name="estado"
            label="Estado"
            allLabel="Todos los estados"
            options={[
              { value: "activo", label: "Activos" },
              { value: "inactivo", label: "Inactivos" },
            ]}
          />
        </div>

        {operators.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q || estado ? "Sin resultados" : "Aún no hay operarios registrados"}
            description={
              q || estado
                ? "Ningún operario coincide con la búsqueda o el filtro."
                : "Registre a las personas que realizan los aseos para poder asignarlas y entregarles insumos."
            }
            action={!q && !estado ? <OperatorFormButton /> : undefined}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Código</Th>
                  <Th>Cargo</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {operators.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-muted">
                    <Td>
                      <Link href={`/operarios/${o.id}`} className="font-medium text-primary hover:underline">
                        {o.full_name}
                      </Link>
                      {o.notes && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{o.notes}</p>}
                    </Td>
                    <Td className="text-muted">{o.code ?? "—"}</Td>
                    <Td className="text-muted">{o.position ?? "—"}</Td>
                    <Td>{o.active ? <Badge tone="success">Activo</Badge> : <Badge>Inactivo</Badge>}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <OperatorFormButton operator={o} />
                        <OperatorActiveToggle operator={o} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <MobileList>
              {operators.map((o) => (
                <li key={o.id} className="p-4">
                  <Link href={`/operarios/${o.id}`} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{o.full_name}</p>
                      <p className="text-sm text-muted">
                        {[o.position, o.code].filter(Boolean).join(" · ") || "Sin cargo registrado"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {o.active ? <Badge tone="success">Activo</Badge> : <Badge>Inactivo</Badge>}
                      <ChevronRight className="h-4 w-4 text-muted" />
                    </div>
                  </Link>
                  <div className="mt-2 flex gap-1">
                    <OperatorFormButton operator={o} />
                    <OperatorActiveToggle operator={o} />
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
