"use server";

import { revalidatePath } from "next/cache";
import { authorize, dbErrorMessage, fail, isFail, zodErrorMessage } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { operatorSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

export async function saveOperator(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize();
  if (isFail(auth)) return auth;
  const parsed = operatorSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));

  const supabase = await createClient();
  const query = id
    ? supabase.from("operators").update(parsed.data).eq("id", id).select("id").single()
    : supabase.from("operators").insert(parsed.data).select("id").single();
  const { data, error } = await query;
  if (error) {
    if (error.code === "23505") return fail("Ya existe un operario con ese código interno.");
    return fail(dbErrorMessage(error));
  }
  revalidatePath("/operarios");
  return { ok: true, data, message: id ? "Operario actualizado." : "Operario registrado." };
}

export async function setOperatorActive(id: string, active: boolean): Promise<ActionResult> {
  const auth = await authorize();
  if (isFail(auth)) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("operators").update({ active }).eq("id", id).select("id").single();
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/operarios");
  return { ok: true, message: active ? "Operario activado." : "Operario desactivado. Ya no aparecerá para nuevas asignaciones." };
}
