"use server";

import { revalidatePath } from "next/cache";
import { authorize, dbErrorMessage, fail, isFail, zodErrorMessage } from "@/lib/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { userCreateSchema, userUpdateSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

/** Crea un usuario de Auth (solo admin). El perfil se crea por trigger y el rol sale de app_metadata. */
export async function createUser(input: unknown): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (isFail(auth)) return auth;
  const parsed = userCreateSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
    app_metadata: { role: parsed.data.role },
  });
  if (error) {
    if (error.code === "email_exists" || /already/i.test(error.message)) return fail("Ya existe un usuario con ese correo.");
    if (error.code === "weak_password") return fail("La contraseña es demasiado débil. Use al menos 10 caracteres combinando letras y números.");
    return fail("No se pudo crear el usuario. Intente de nuevo.");
  }
  revalidatePath("/usuarios");
  return { ok: true, message: "Usuario creado. Comparta la contraseña de forma privada con la persona." };
}

export async function updateUser(input: unknown): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (isFail(auth)) return auth;
  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(zodErrorMessage(parsed.error));
  const { id, full_name, role, active } = parsed.data;

  if (id === auth.id && (role !== "admin" || !active)) {
    return fail("No puede quitarse el rol de administrador ni desactivar su propio usuario.");
  }

  // Rol en app_metadata (fuente de verdad, sincronizado al perfil por trigger) y bloqueo de sesión si se desactiva.
  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    app_metadata: { role },
    ban_duration: active ? "none" : "876000h",
  });
  if (authError) return fail("No se pudo actualizar el usuario en el sistema de autenticación.");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name, role, active }).eq("id", id).select("id").single();
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/usuarios");
  return { ok: true, message: active ? "Usuario actualizado." : "Usuario desactivado. Ya no podrá iniciar sesión." };
}

export async function resetPassword(id: string, password: string): Promise<ActionResult> {
  const auth = await authorize("admin");
  if (isFail(auth)) return auth;
  if (typeof password !== "string" || password.length < 10 || password.length > 72) {
    return fail("La contraseña debe tener entre 10 y 72 caracteres.");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return fail("No se pudo cambiar la contraseña.");
  return { ok: true, message: "Contraseña actualizada." };
}
