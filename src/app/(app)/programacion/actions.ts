"use server";

import { revalidatePath } from "next/cache";
import { authorize, dbErrorMessage, fail, isFail, zodErrorMessage } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { cleaningSchema, scheduleSchema, statusEnum } from "@/lib/validations";
import type { ActionResult, MaintenanceStatus } from "@/lib/types";

function revalidate() {
  revalidatePath("/programacion", "layout");
  revalidatePath("/");
}

/* ------------------------------------------------------------ Preventivos (admin) */
export async function saveSchedule(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("admin");
  if (isFail(auth)) return auth;
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));

  const supabase = await createClient();
  const { data: machine } = await supabase.from("machines").select("active").eq("id", parsed.data.machine_id).maybeSingle();
  if (!machine) return fail("La máquina seleccionada no existe.");
  if (!machine.active && !id) return fail("La máquina está inactiva. Actívela antes de programarle mantenimientos.");

  const { data, error } = id
    ? await supabase.from("maintenance_schedules").update(parsed.data).eq("id", id).select("id").single()
    : await supabase.from("maintenance_schedules").insert(parsed.data).select("id").single();
  if (error) return fail(dbErrorMessage(error));
  revalidate();
  return { ok: true, data, message: id ? "Mantenimiento preventivo actualizado." : "Mantenimiento preventivo programado." };
}

export async function setScheduleStatus(id: string, status: MaintenanceStatus): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (isFail(auth)) return auth;
  if (!statusEnum.safeParse(status).success) return fail("Estado no válido.");
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_schedules").update({ status }).eq("id", id).select("id").single();
  if (error) return fail(dbErrorMessage(error));
  revalidate();
  return { ok: true, message: "Estado del preventivo actualizado." };
}

/* ------------------------------------------------------------ Aseos (admin y supervisor) */
export async function saveCleaning(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if (isFail(auth)) return auth;
  const parsed = cleaningSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));
  const { operator_ids, ...fields } = parsed.data;

  const supabase = await createClient();

  // Asignaciones actuales (si es edición) para calcular altas y bajas.
  const { data: current } = id
    ? await supabase.from("maintenance_assignments").select("id, operator_id").eq("cleaning_id", id)
    : { data: [] as { id: string; operator_id: string }[] };
  const currentIds = new Set((current ?? []).map((a) => a.operator_id));
  const wanted = new Set(operator_ids);
  const toRemove = (current ?? []).filter((a) => !wanted.has(a.operator_id)).map((a) => a.id);
  const toAdd = operator_ids.filter((o) => !currentIds.has(o));

  // Validar operarios nuevos ANTES de guardar: deben existir y estar activos.
  if (toAdd.length) {
    const { data: ops } = await supabase.from("operators").select("id, active, full_name").in("id", toAdd);
    if ((ops ?? []).length !== toAdd.length) return fail("Alguno de los operarios seleccionados no existe.");
    const inactive = (ops ?? []).filter((o) => !o.active);
    if (inactive.length) return fail(`No se puede asignar a operarios inactivos: ${inactive.map((o) => o.full_name).join(", ")}.`);
  }

  const { data, error } = id
    ? await supabase.from("cleaning_maintenances").update(fields).eq("id", id).select("id").single()
    : await supabase.from("cleaning_maintenances").insert(fields).select("id").single();
  if (error) return fail(dbErrorMessage(error));

  if (toAdd.length) {
    const { error: e } = await supabase
      .from("maintenance_assignments")
      .insert(toAdd.map((operator_id) => ({ cleaning_id: data.id, operator_id })));
    if (e) return fail(`El aseo se guardó, pero no se pudieron asignar los operarios: ${dbErrorMessage(e)}`);
  }
  if (toRemove.length) {
    const { error: e } = await supabase.from("maintenance_assignments").delete().in("id", toRemove);
    if (e) return fail(`El aseo se guardó, pero no se pudieron quitar operarios: ${dbErrorMessage(e)}`);
  }

  revalidate();
  return { ok: true, data, message: id ? "Aseo actualizado." : "Aseo programado." };
}

export async function setCleaningStatus(id: string, status: MaintenanceStatus): Promise<ActionResult> {
  const auth = await authorize();
  if (isFail(auth)) return auth;
  if (!statusEnum.safeParse(status).success) return fail("Estado no válido.");
  const supabase = await createClient();
  const { error } = await supabase.from("cleaning_maintenances").update({ status }).eq("id", id).select("id").single();
  if (error) return fail(dbErrorMessage(error));
  revalidate();
  const msg =
    status === "completado" ? "Aseo marcado como completado." : status === "cancelado" ? "Aseo cancelado." : "Estado del aseo actualizado.";
  return { ok: true, message: msg };
}
