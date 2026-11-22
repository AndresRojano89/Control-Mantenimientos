import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ZodError } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";

/** Traduce errores de Postgres/Supabase a mensajes comprensibles. */
export function dbErrorMessage(error: PostgrestError | { message: string; code?: string }): string {
  const code = "code" in error ? error.code : undefined;
  if (code === "23505") return "Ya existe un registro con ese código o nombre. Use uno diferente.";
  if (code === "23503") return "El registro está relacionado con otros datos y no puede quedar inconsistente.";
  if (code === "42501") return error.message.startsWith("No autorizado") || error.message.startsWith("Solo")
    ? error.message
    : "No tiene permisos para realizar esta operación.";
  if (code === "23514") return "Algún valor no cumple las reglas (por ejemplo, cantidades negativas).";
  if (code === "PGRST116") return "No se encontró el registro o no tiene permisos para modificarlo.";
  return error.message || "Ocurrió un error inesperado. Intente de nuevo.";
}

export function zodErrorMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Revise los datos del formulario.";
}

type Failure = { ok: false; error: string };

export function fail(error: string): Failure {
  return { ok: false, error };
}

/** Verifica sesión/rol al inicio de cada Server Action (además de RLS en la BD). */
export async function authorize(role?: "admin"): Promise<Profile | Failure> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active) return fail("Su sesión expiró o su usuario está inactivo. Inicie sesión de nuevo.");
  if (role === "admin" && profile.role !== "admin") return fail("Solo un administrador puede realizar esta operación.");
  return profile;
}

export function isFail(x: unknown): x is { ok: false; error: string } {
  return typeof x === "object" && x !== null && "ok" in x && (x as { ok: boolean }).ok === false;
}

/** Convierte "" en null para columnas opcionales. */
export function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  return out as T;
}
