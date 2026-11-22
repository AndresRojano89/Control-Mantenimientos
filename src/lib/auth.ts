import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Perfil del usuario autenticado (o null). Cacheado por petición. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, active, created_at")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile) ?? null;
});

/** Para páginas: exige sesión y perfil activo. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.active) redirect("/login?error=inactivo");
  return profile;
}

export async function requireAdminPage(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/?error=sin-permiso");
  return profile;
}
