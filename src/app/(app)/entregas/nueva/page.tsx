import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/utils";
import type { Supply } from "@/lib/types";
import { DeliveryWizard, type CleaningOption } from "./wizard";

export const metadata: Metadata = { title: "Nueva entrega" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function NewDeliveryPage({ searchParams }: { searchParams: Promise<{ aseo?: string }> }) {
  const { aseo } = await searchParams;
  const supabase = await createClient();

  const [{ data: cleanings }, { data: operators }, { data: supplies }] = await Promise.all([
    supabase
      .from("cleaning_maintenances")
      .select("id, scheduled_date, scheduled_time, status, schedule:maintenance_schedules(id, scheduled_date, machine:machines(name)), assignments:maintenance_assignments(operator_id)")
      .in("status", ["pendiente", "programado", "en_proceso"])
      .gte("scheduled_date", addDaysISO(todayISO(), -30))
      .order("scheduled_date"),
    supabase.from("operators").select("id, full_name").eq("active", true).order("full_name"),
    supabase.from("v_supply_stock_status").select("*").eq("active", true).order("name"),
  ]);

  const options: CleaningOption[] = ((cleanings ?? []) as any[]).map((c) => ({
    id: c.id,
    date: c.scheduled_date,
    status: c.status,
    machine: c.schedule.machine.name,
    scheduleId: c.schedule.id,
    preventiveDate: c.schedule.scheduled_date,
    operatorIds: (c.assignments ?? []).map((a: any) => a.operator_id),
  }));

  return (
    <>
      <Link href="/entregas" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Entregas
      </Link>
      <PageHeader
        title="Registrar entrega de insumos"
        description="Las existencias se descuentan solo al confirmar. Antes verá un resumen."
      />
      {options.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="No hay aseos abiertos"
            description="Toda entrega debe estar asociada a un mantenimiento de aseo pendiente, programado o en proceso. Prográmelo primero."
            action={<Link href="/programacion" className={buttonClass("primary")}>Ir a Programación</Link>}
          />
        </Card>
      ) : (
        <DeliveryWizard
          cleanings={options}
          operators={(operators ?? []) as { id: string; full_name: string }[]}
          supplies={(supplies ?? []) as Supply[]}
          initialCleaningId={options.some((o) => o.id === aseo) ? aseo : undefined}
        />
      )}
    </>
  );
}
