import { z } from "zod";

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const requiredText = (label: string, max = 150) =>
  z.string({ error: `${label} es obligatorio.` }).trim().min(1, `${label} es obligatorio.`).max(max, `Máximo ${max} caracteres.`);

const isoDate = (label: string) =>
  z.string({ error: `${label} es obligatoria.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} no es válida.`);

const optionalTime = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{2}:\d{2}(:\d{2})?$/.test(v), "La hora no es válida.");

const qty = (label: string) =>
  z.coerce
    .number({ error: `${label} debe ser un número.` })
    .refine((n) => Number.isFinite(n), `${label} debe ser un número.`)
    .refine((n) => Math.round(n * 100) === n * 100, `${label} admite máximo 2 decimales.`);

export const statusEnum = z.enum(["pendiente", "programado", "en_proceso", "completado", "cancelado"], {
  error: "Seleccione un estado válido.",
});

export const operatorSchema = z.object({
  full_name: requiredText("El nombre completo"),
  code: optionalText(40),
  position: optionalText(100),
  notes: optionalText(),
});

export const machineSchema = z.object({
  name: requiredText("El nombre de la máquina", 100),
  code: optionalText(40),
  area: optionalText(100),
  description: optionalText(),
});

export const supplySchema = z.object({
  code: optionalText(40).refine((v) => v === null || !/\s/.test(v), "El código no puede contener espacios."),
  name: requiredText("El nombre del producto"),
  description: optionalText(),
  category: requiredText("La categoría", 60),
  unit: requiredText("La unidad de medida", 30),
  min_stock: qty("El stock mínimo").refine((n) => n >= 0, "El stock mínimo no puede ser negativo."),
  reference_qty: z
    .union([z.literal(""), z.null(), z.undefined(), qty("La cantidad de referencia")])
    .transform((v) => (v === "" || v === undefined ? null : v))
    .refine((v) => v === null || v >= 0, "La cantidad de referencia no puede ser negativa."),
  location: optionalText(100),
  pending_validation: z.coerce.boolean(),
  validation_notes: optionalText(),
});

export const stockEntrySchema = z.object({
  supply_id: z.string().uuid("Seleccione un producto."),
  quantity: qty("La cantidad").refine((n) => n > 0, "La cantidad debe ser mayor que cero."),
  reason: optionalText(300),
});

export const adjustmentSchema = z.object({
  supply_id: z.string().uuid("Seleccione un producto."),
  new_stock: qty("La existencia contada").refine((n) => n >= 0, "La existencia no puede ser negativa."),
  reason: requiredText("El motivo del ajuste", 300),
});

export const scheduleSchema = z.object({
  machine_id: z.string().uuid("Seleccione una máquina."),
  maintenance_type: requiredText("El tipo de mantenimiento", 60),
  scheduled_date: isoDate("La fecha"),
  scheduled_time: optionalTime,
  priorities: optionalText(2000),
  notes: optionalText(2000),
  status: statusEnum,
});

export const cleaningSchema = z.object({
  schedule_id: z.string().uuid("Seleccione el mantenimiento preventivo."),
  scheduled_date: isoDate("La fecha del aseo"),
  scheduled_time: optionalTime,
  priorities: optionalText(2000),
  notes: optionalText(2000),
  status: statusEnum,
  operator_ids: z.array(z.string().uuid()).default([]),
});

export const deliverySchema = z.object({
  cleaning_id: z.string().uuid("Seleccione el mantenimiento de aseo."),
  operator_id: z.string().uuid("Seleccione el operario que recibe."),
  notes: optionalText(1000),
  items: z
    .array(
      z.object({
        supply_id: z.string().uuid(),
        quantity: qty("La cantidad a entregar").refine((n) => n > 0, "Las cantidades a entregar deben ser mayores que cero."),
        requested_qty: z
          .union([z.null(), z.undefined(), qty("La cantidad solicitada")])
          .transform((v) => (v === undefined ? null : v))
          .refine((v) => v === null || v >= 0, "La cantidad solicitada no puede ser negativa."),
      }),
    )
    .min(1, "Agregue al menos un producto.")
    .refine((items) => new Set(items.map((i) => i.supply_id)).size === items.length, "Hay productos repetidos."),
});

export const returnSchema = z.object({
  delivery_id: z.string().uuid(),
  operator_id: z.string().uuid().optional().nullable(),
  notes: optionalText(1000),
  items: z
    .array(z.object({ delivery_item_id: z.string().uuid(), quantity: qty("La cantidad devuelta").refine((n) => n > 0, "Las cantidades deben ser mayores que cero.") }))
    .min(1, "Indique al menos un producto a devolver."),
});

export const closeDeliverySchema = z.object({
  delivery_id: z.string().uuid(),
  notes: optionalText(1000),
});

export const userCreateSchema = z.object({
  full_name: requiredText("El nombre"),
  email: z.string().trim().toLowerCase().email("Ingrese un correo válido."),
  password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres.").max(72),
  role: z.enum(["admin", "supervisor"], { error: "Seleccione un rol." }),
});

export const userUpdateSchema = z.object({
  id: z.string().uuid(),
  full_name: requiredText("El nombre"),
  role: z.enum(["admin", "supervisor"]),
  active: z.boolean(),
});
