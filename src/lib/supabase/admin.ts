import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente con service role. SOLO para el servidor y SOLO para gestión de usuarios de Auth.
 * Nunca importar desde componentes de cliente.
 */
export function createAdminClient() {
  if (!env.supabaseServiceRoleKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.");
  }
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
