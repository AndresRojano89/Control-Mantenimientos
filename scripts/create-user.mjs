// Crea un usuario del sistema (admin o supervisor) directamente en Supabase.
// Úselo para el PRIMER administrador y para cuentas de prueba; luego se gestionan desde /usuarios.
//
// Uso:
//   node --env-file=<archivo-env> scripts/create-user.mjs <admin|supervisor> <correo> "<Nombre completo>" [contraseña]
//
// Ejemplos:
//   node --env-file=.env.local scripts/create-user.mjs admin admin@empresa.com "Nombre Apellido"
//   node --env-file=.env.production.local scripts/create-user.mjs supervisor sup@empresa.com "Nombre Apellido"
//
// Si no se indica contraseña se genera una segura. Las credenciales se guardan en
// credenciales.local.txt (ignorado por git) para compartirlas de forma privada.
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [role, email, fullName, givenPassword] = process.argv.slice(2);
if (!["admin", "supervisor"].includes(role) || !email || !fullName) {
  console.error('Uso: node --env-file=<archivo-env> scripts/create-user.mjs <admin|supervisor> <correo> "<Nombre completo>" [contraseña]');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo de entorno.");
  process.exit(1);
}

const password = givenPassword ?? randomBytes(9).toString("base64url");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
  app_metadata: { role },
});
if (error) {
  console.error("No se pudo crear el usuario:", error.message);
  process.exit(1);
}

const label = role === "admin" ? "Administrador" : "Supervisor";
appendFileSync(
  "credenciales.local.txt",
  `${label}\n  Sitio:      ${url.includes("127.0.0.1") || url.includes("localhost") ? "http://localhost:3000" : "(URL de Vercel)"}\n  Correo:     ${email}\n  Contraseña: ${password}\n\n`,
);
console.log(`${label} creado: ${email}. Credenciales guardadas en credenciales.local.txt`);
