import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MaintenanceStatus } from "@/lib/types";

/** Selección estándar de un preventivo con su máquina, aseos y operarios. */
export const SCHEDULE_SELECT = `
  id, machine_id, maintenance_type, scheduled_date, scheduled_time, priorities, notes, status, completed_at,
  machine:machines(id, name),
  cleanings:cleaning_maintenances(
    id, schedule_id, scheduled_date, scheduled_time, priorities, notes, status, completed_at,
    assignments:maintenance_assignments(operator:operators(id, full_name, active))
  )
`;

export interface ScheduleRow {
  id: string;
  machine_id: string;
  maintenance_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  priorities: string | null;
  notes: string | null;
  status: MaintenanceStatus;
  completed_at: string | null;
  machine: { id: string; name: string };
  cleanings: CleaningRow[];
}
export interface CleaningRow {
  id: string;
  schedule_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  priorities: string | null;
  notes: string | null;
  status: MaintenanceStatus;
  completed_at: string | null;
  operators: { id: string; full_name: string; active: boolean }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeSchedule(raw: any): ScheduleRow {
  return {
    ...raw,
    cleanings: (raw.cleanings ?? [])
      .map((c: any) => ({ ...c, operators: (c.assignments ?? []).map((a: any) => a.operator).filter(Boolean), assignments: undefined }))
      .sort((a: CleaningRow, b: CleaningRow) => a.scheduled_date.localeCompare(b.scheduled_date)),
  };
}

export async function fetchSchedules(
  supabase: SupabaseClient,
  f: { from?: string; to?: string; machineId?: string; status?: string; ascending?: boolean } = {},
): Promise<ScheduleRow[]> {
  let q = supabase.from("maintenance_schedules").select(SCHEDULE_SELECT);
  if (f.from) q = q.gte("scheduled_date", f.from);
  if (f.to) q = q.lte("scheduled_date", f.to);
  if (f.machineId) q = q.eq("machine_id", f.machineId);
  if (f.status) q = q.eq("status", f.status);
  q = q.order("scheduled_date", { ascending: f.ascending ?? true }).order("scheduled_time", { ascending: true, nullsFirst: false });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeSchedule);
}
