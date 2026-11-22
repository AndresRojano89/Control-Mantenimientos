// Crea el PRIMER usuario administrador (los demás se crean desde el módulo Usuarios).
// Uso:  node --env-file=.env.local scripts/create-admin.mjs <correo> "<Nombre completo>" [contraseña]
// Si no se indica contraseña se genera una y se guarda en .dev-credentials.local (ignorado por git).
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [email, fullName, givenPassword] = process.argv.slice(2);
if (!email || !fullName) {
  console.error('Uso: node --env-file=.env.local scripts/create-admin.mjs <correo> "<Nombre completo>" [contraseña]');
  process.exit(1);
}
const password = givenPassword ?? randomBytes(12).toString("base64url");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
  app_metadata: { role: "admin" },
});
if (error) {
  console.error("No se pudo crear el administrador:", error.message);
  process.exit(1);
}
if (!givenPassword) {
  appendFileSync(".dev-credentials.local", `${email}\t${password}\n`);
  console.log(`Administrador creado (${data.user.id}). Contraseña guardada en .dev-credentials.local`);
} else {
  console.log(`Administrador creado (${data.user.id}).`);
}
