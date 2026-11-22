"use server";

import { revalidatePath } from "next/cache";
import { authorize, dbErrorMessage, fail, isFail, zodErrorMessage } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { machineSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

export async function saveMachine(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("admin");
  if (isFail(auth)) return auth;
  const parsed = machineSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("machines").update(parsed.data).eq("id", id).select("id").single()
    : await supabase.from("machines").insert(parsed.data).select("id").single();
  if (error) {
    if (error.code === "23505") return fail("Ya existe una máquina con ese nombre o código.");
    return fail(dbErrorMessage(error));
  }
  revalidatePath("/maquinas");
  return { ok: true, data, message: id ? "Máquina actualizada." : "Máquina registrada." };
}

export async function setMachineActive(id: string, active: boolean): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (isFail(auth)) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("machines").update({ active }).eq("id", id).select("id").single();
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/maquinas");
  return { ok: true, message: active ? "Máquina activada." : "Máquina desactivada." };
}
