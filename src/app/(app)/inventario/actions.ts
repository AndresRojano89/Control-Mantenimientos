"use server";

import { revalidatePath } from "next/cache";
import { authorize, dbErrorMessage, fail, isFail, zodErrorMessage } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { adjustmentSchema, stockEntrySchema, supplySchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

function revalidate() {
  revalidatePath("/inventario", "layout");
  revalidatePath("/");
}

export async function saveSupply(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("admin");
  if (isFail(auth)) return auth;
  const parsed = supplySchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("supplies").update(parsed.data).eq("id", id).select("id").single()
    : await supabase.from("supplies").insert(parsed.data).select("id").single();
  if (error) {
    if (error.code === "23505") return fail(`Ya existe un producto con el código ${parsed.data.code}. Los códigos no pueden repetirse.`);
    return fail(dbErrorMessage(error));
  }
  revalidate();
  return { ok: true, data, message: id ? "Producto actualizado." : "Producto registrado. Registre una entrada para cargar sus existencias." };
}

export async function setSupplyActive(id: string, active: boolean): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (isFail(auth)) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("supplies").update({ active }).eq("id", id).select("id").single();
  if (error) return fail(dbErrorMessage(error));
  revalidate();
  return { ok: true, message: active ? "Producto activado." : "Producto desactivado. Su historial se conserva." };
}

export async function registerEntry(input: unknown): Promise<ActionResult> {
  const auth = await authorize();
  if (isFail(auth)) return auth;
  const parsed = stockEntrySchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_stock_entry", {
    p_supply_id: parsed.data.supply_id,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(dbErrorMessage(error));
  revalidate();
  return { ok: true, message: "Entrada registrada. Las existencias se actualizaron." };
}

export async function adjustStock(input: unknown): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (isFail(auth)) return auth;
  const parsed = adjustmentSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", {
    p_supply_id: parsed.data.supply_id,
    p_new_stock: parsed.data.new_stock,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(dbErrorMessage(error));
  revalidate();
  return { ok: true, message: "Ajuste registrado." };
}
