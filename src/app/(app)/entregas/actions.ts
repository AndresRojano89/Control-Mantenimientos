"use server";

import { revalidatePath } from "next/cache";
import { authorize, dbErrorMessage, fail, isFail, zodErrorMessage } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { closeDeliverySchema, deliverySchema, returnSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

function revalidate() {
  revalidatePath("/entregas", "layout");
  revalidatePath("/inventario", "layout");
  revalidatePath("/programacion", "layout");
  revalidatePath("/");
}

/** Confirma una entrega: descuenta inventario y registra movimientos en una sola transacción. */
export async function confirmDelivery(input: unknown): Promise<ActionResult<{ id: string; delivery_number: number }>> {
  const auth = await authorize();
  if (isFail(auth)) return auth;
  const parsed = deliverySchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_delivery", {
    p_cleaning_id: parsed.data.cleaning_id,
    p_operator_id: parsed.data.operator_id,
    p_items: parsed.data.items,
    p_notes: parsed.data.notes,
  });
  if (error) return fail(dbErrorMessage(error));
  revalidate();
  return { ok: true, data, message: `Entrega #${data.delivery_number} confirmada. El inventario se actualizó.` };
}

export async function registerReturn(input: unknown): Promise<ActionResult<{ id: string; return_number: number }>> {
  const auth = await authorize();
  if (isFail(auth)) return auth;
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_return", {
    p_delivery_id: parsed.data.delivery_id,
    p_items: parsed.data.items,
    p_operator_id: parsed.data.operator_id ?? null,
    p_notes: parsed.data.notes,
  });
  if (error) return fail(dbErrorMessage(error));
  revalidate();
  return { ok: true, data, message: `Devolución #${data.return_number} registrada. Las unidades volvieron al inventario.` };
}

export async function closeDelivery(input: unknown): Promise<ActionResult> {
  const auth = await authorize();
  if (isFail(auth)) return auth;
  const parsed = closeDeliverySchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_delivery", { p_delivery_id: parsed.data.delivery_id, p_notes: parsed.data.notes });
  if (error) return fail(dbErrorMessage(error));
  revalidate();
  return { ok: true, message: `Entrega #${data.delivery_number} cerrada. Lo no devuelto quedó registrado como consumido.` };
}
