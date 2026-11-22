import type { Metadata } from "next";
import Link from "next/link";
import { Factory } from "lucide-react";
import { Badge, Card, EmptyState, MobileList, PageHeader, Table, Td, Th } from "@/components/ui";
import { SearchInput } from "@/components/filters";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, ilikeEscape, todayISO } from "@/lib/utils";
import type { Machine } from "@/lib/types";
import { MachineActiveToggle, MachineFormButton } from "./machine-form";

export const metadata: Metadata = { title: "Máquinas" };

export default async function MachinesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const profile = await requireProfile();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  let query = supabase.from("machines").select("*").order("active", { ascending: false }).order("name");
  if (q) {
    const t = ilikeEscape(q);
    query = query.or(`name.ilike.%${t}%,code.ilike.%${t}%,area.ilike.%${t}%`);
  }
  const [{ data, error }, { data: next }] = await Promise.all([
    query,
    supabase
      .from("maintenance_schedules")
      .select("machine_id, scheduled_date")
      .gte("scheduled_date", todayISO())
      .not("status", "in", "(completado,cancelado)")
      .order("scheduled_date"),
  ]);
  if (error) throw new Error(error.message);
  const machines = (data ?? []) as Machine[];
  const nextByMachine = new Map<string, string>();
  for (const s of next ?? []) if (!nextByMachine.has(s.machine_id)) nextByMachine.set(s.machine_id, s.scheduled_date);

  return (
    <>
      <PageHeader
        title="Máquinas"
        description={isAdmin ? "Equipos a los que se programan mantenimientos." : "Consulta de equipos. Solo el administrador puede modificarlos."}
        actions={isAdmin ? <MachineFormButton /> : undefined}
      />
      <Card>
        <div className="border-b border-border p-3 sm:p-4">
          <SearchInput placeholder="Buscar por nombre, código o área" />
        </div>
        {machines.length === 0 ? (
          <EmptyState icon={Factory} title={q ? "Sin resultados" : "No hay máquinas registradas"} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Máquina</Th>
                  <Th>Código</Th>
                  <Th>Área</Th>
                  <Th>Próximo preventivo</Th>
                  <Th>Estado</Th>
                  {isAdmin && <Th className="text-right">Acciones</Th>}
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-muted">
                    <Td>
                      <p className="font-medium">{m.name}</p>
                      {m.description && <p className="text-xs text-muted">{m.description}</p>}
                    </Td>
                    <Td className="text-muted">{m.code ?? "—"}</Td>
                    <Td className="text-muted">{m.area ?? "—"}</Td>
                    <Td>
                      {nextByMachine.has(m.id) ? (
                        <Link href={`/programacion?maquina=${m.id}`} className="text-primary hover:underline">
                          {formatDate(nextByMachine.get(m.id))}
                        </Link>
                      ) : (
                        <span className="text-muted">Sin programar</span>
                      )}
                    </Td>
                    <Td>{m.active ? <Badge tone="success">Activa</Badge> : <Badge>Inactiva</Badge>}</Td>
                    {isAdmin && (
                      <Td>
                        <div className="flex justify-end gap-1">
                          <MachineFormButton machine={m} />
                          <MachineActiveToggle machine={m} />
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
            <MobileList>
              {machines.map((m) => (
                <li key={m.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-sm text-muted">
                        Próximo preventivo: {nextByMachine.has(m.id) ? formatDate(nextByMachine.get(m.id)) : "sin programar"}
                      </p>
                    </div>
                    {m.active ? <Badge tone="success">Activa</Badge> : <Badge>Inactiva</Badge>}
                  </div>
                  {isAdmin && (
                    <div className="mt-2 flex gap-1">
                      <MachineFormButton machine={m} />
                      <MachineActiveToggle machine={m} />
                    </div>
                  )}
                </li>
              ))}
            </MobileList>
          </>
        )}
      </Card>
    </>
  );
}
