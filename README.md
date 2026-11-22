# AsePrev · Control de aseo e insumos

Aplicación web para programar los **mantenimientos de aseo** previos a los **mantenimientos preventivos**,
asignar operarios y controlar el **inventario de insumos** (entradas, entregas, devoluciones, consumo),
con historial inalterable y reportes exportables a Excel y PDF.

- Análisis, arquitectura y modelo de datos: [docs/01-analisis-y-arquitectura.md](docs/01-analisis-y-arquitectura.md)
- Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, RLS) · Recharts · ExcelJS · jsPDF

## Módulos

| Ruta | Módulo | Quién |
|---|---|---|
| `/` | Panel principal: hoy, próximos preventivos, alertas, stock bajo, gráficos de consumo | Todos |
| `/programacion` | Preventivos y aseos (lista y calendario), operarios asignados, alertas de aseo pendiente | Preventivos: admin · Aseos: todos |
| `/maquinas` | Máquinas | Edita admin |
| `/operarios` | Operarios, sus aseos e insumos recibidos | Todos |
| `/inventario` | Catálogo, existencias, entradas, ajustes, kárdex por producto | Catálogo y ajustes: admin |
| `/entregas` | Entregas (asistente con resumen), devoluciones parciales y cierre con consumo | Todos |
| `/historial` | Reportes de mantenimientos, entregas, devoluciones, movimientos, consumo y auditoría (admin) | Todos |
| `/usuarios` | Usuarios del sistema y roles | Admin |

## Desarrollo local

Requisitos: Node 20+, Docker Desktop en ejecución.

```bash
npm install
npx supabase start          # levanta PostgreSQL, Auth y API locales; aplica migraciones y seed
```

Cree `.env.local` a partir de `.env.example` con los valores que muestra `npx supabase status`
(`API URL`, `anon key`, `service_role key`).

Cree el primer administrador (los demás usuarios se crean desde `/usuarios`):

```bash
node --env-file=.env.local scripts/create-user.mjs admin correo@empresa.com "Nombre Apellido"
```

Si no se indica contraseña se genera una. Las credenciales quedan en `credenciales.local.txt` (ignorado por git).

```bash
npm run dev                 # http://localhost:3000
```

### Pruebas de reglas de negocio

```bash
npm run test:db             # 11 pruebas contra la BD local: permisos, sin negativos, atomicidad,
                            # devoluciones, cierre, concurrencia, historial inmutable, auditoría
npx supabase db reset       # deja la base limpia (las pruebas crean datos "PRUEBA-…")
```

## Despliegue a producción

1. **Supabase**: cree un proyecto en supabase.com. Enlácelo y aplique las migraciones:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   Cargue el catálogo inicial ejecutando `supabase/seed.sql` en el SQL Editor (una sola vez).
   En *Authentication → Providers → Email* **desactive el registro público** (los usuarios los crea el administrador).
2. **Variables de entorno** en el hosting (Vercel u otro con Node):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — **solo servidor**, nunca con prefijo `NEXT_PUBLIC_`.
3. En Vercel: *Add New → Project*, importe el repositorio de GitHub, agregue las tres variables y despliegue.
4. Cree los usuarios en producción con un `.env.production.local` (ignorado por git) que tenga la URL y la service role del proyecto en la nube:
   ```bash
   node --env-file=.env.production.local scripts/create-user.mjs admin admin@empresa.com "Nombre Apellido"
   node --env-file=.env.production.local scripts/create-user.mjs supervisor sup@empresa.com "Nombre Apellido"
   ```
   Las contraseñas generadas quedan en `credenciales.local.txt` para compartirlas de forma privada.
5. Verificación final: iniciar sesión, crear un supervisor, registrar una entrada, una entrega, una devolución y revisar `/historial`.

## Seguridad

- Contraseñas gestionadas por Supabase Auth (bcrypt); registro público deshabilitado.
- Rutas privadas protegidas por middleware; cada Server Action vuelve a verificar sesión y rol.
- **RLS en todas las tablas**; entregas, devoluciones, cierres, entradas y ajustes solo por funciones
  `SECURITY DEFINER` que validan rol, bloquean filas y corren en una transacción.
- Existencias nunca negativas (`CHECK` + validación con bloqueo); `stock` solo cambia por movimientos.
- Kárdex, devoluciones y auditoría inmutables (triggers impiden UPDATE/DELETE, incluso con service role).
- Auditoría automática (quién, cuándo, antes/después) en todas las tablas operativas.
- Usuarios desactivados quedan bloqueados en Auth y en RLS.

## Datos iniciales y pendientes de validación

El seed carga solo la información entregada: 4 máquinas, los preventivos de la semana 48 y el catálogo.
Existencias en **0** (las cantidades de la lista quedan como *cantidad de referencia*).
Quedan **pendientes de validación** (no se pueden entregar hasta corregirlos en `/inventario`):

- **Lubricante Jax** y **WD-40 Multiusos**: ambos venían con el código 5101627.
- **Jabón líquido x galón**: código y presentación por confirmar (53 000 56 / 53 000 70).

No se cargan operarios ni usuarios: los registra el administrador.
