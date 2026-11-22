// Pruebas de reglas de negocio, permisos y transacciones contra la base de datos LOCAL.
// Ejecutar con:  npm run test:db   (requiere `npx supabase start`)
// Crea sus propios usuarios y registros de prueba con el prefijo "PRUEBA-". Después:
//   npx supabase db reset   para dejar la base limpia.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL?.includes("127.0.0.1") && !URL?.includes("localhost")) {
  throw new Error("Estas pruebas solo se ejecutan contra Supabase local.");
}

const run = randomBytes(3).toString("hex");
const service = createClient(URL, SERVICE, { auth: { persistSession: false } });

async function makeUser(role, active = true) {
  const email = `prueba-${role}-${active ? "on" : "off"}-${run}@control-aseo.test`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await service.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: `PRUEBA ${role}` }, app_metadata: { role },
  });
  if (error) throw error;
  if (!active) await service.from("profiles").update({ active: false }).eq("id", data.user.id);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return client;
}

let admin, sup, inactive, anon;
const ids = {};

before(async () => {
  admin = await makeUser("admin");
  sup = await makeUser("supervisor");
  inactive = await makeUser("supervisor", false);
  anon = createClient(URL, ANON, { auth: { persistSession: false } });
});

const stockOf = async (id) => Number((await admin.from("supplies").select("stock").eq("id", id).single()).data.stock);

test("anónimo e inactivo no ven datos", async () => {
  const a = await anon.from("supplies").select("id");
  assert.ok(a.error || a.data.length === 0);
  const i = await inactive.from("supplies").select("id");
  assert.equal(i.data.length, 0);
  const r = await inactive.rpc("register_stock_entry", { p_supply_id: randomUUID(), p_quantity: 1 });
  assert.match(r.error.message, /No autorizado/);
});

test("seed: catálogo con pendientes de validación y existencias en 0", async () => {
  const { data } = await sup.from("supplies").select("name, code, stock, pending_validation, reference_qty");
  const jax = data.find((s) => s.name === "Lubricante Jax");
  const wd = data.find((s) => s.name === "WD-40 Multiusos");
  assert.equal(jax.code, "5101627");
  assert.equal(wd.code, null);
  assert.ok(jax.pending_validation && wd.pending_validation);
  assert.ok(data.every((s) => Number(s.stock) === 0));
  assert.equal(Number(data.find((s) => s.name === "Rollo de Wypall").reference_qty), 2);
});

test("catálogo: solo admin crea; código único; stock no se fija al crear ni se edita directo", async () => {
  const bySup = await sup.from("supplies").insert({ code: `PRUEBA-X-${run}`, name: "PRUEBA X" });
  assert.ok(bySup.error, "supervisor no debe crear productos");

  const a = await admin.from("supplies").insert({ code: `PRUEBA-A-${run}`, name: "PRUEBA Producto A", min_stock: 3 }).select().single();
  assert.ifError(a.error);
  const b = await admin.from("supplies").insert({ code: `PRUEBA-B-${run}`, name: "PRUEBA Producto B" }).select().single();
  ids.a = a.data.id; ids.b = b.data.id;

  const dup = await admin.from("supplies").insert({ code: `PRUEBA-A-${run}`, name: "Duplicado" });
  assert.equal(dup.error?.code, "23505");

  const withStock = await admin.from("supplies").insert({ code: `PRUEBA-S-${run}`, name: "Con stock", stock: 5 });
  assert.match(withStock.error.message, /entrada de inventario/);

  const direct = await admin.from("supplies").update({ stock: 99 }).eq("id", ids.a);
  assert.match(direct.error.message, /solo se modifican/);
});

test("entradas y ajustes", async () => {
  const pending = (await admin.from("supplies").select("id").eq("name", "Lubricante Jax").single()).data.id;
  const p = await admin.rpc("register_stock_entry", { p_supply_id: pending, p_quantity: 5 });
  assert.match(p.error.message, /pendiente de validación/);

  const neg = await sup.rpc("register_stock_entry", { p_supply_id: ids.a, p_quantity: -1 });
  assert.match(neg.error.message, /mayor que cero/);

  assert.ifError((await sup.rpc("register_stock_entry", { p_supply_id: ids.a, p_quantity: 10, p_reason: "Inicial" })).error);
  assert.ifError((await admin.rpc("register_stock_entry", { p_supply_id: ids.b, p_quantity: 4 })).error);
  assert.equal(await stockOf(ids.a), 10);

  const supAdj = await sup.rpc("adjust_stock", { p_supply_id: ids.b, p_new_stock: 3, p_reason: "Conteo" });
  assert.match(supAdj.error.message, /Solo un administrador/);
  const noReason = await admin.rpc("adjust_stock", { p_supply_id: ids.b, p_new_stock: 3, p_reason: " " });
  assert.match(noReason.error.message, /motivo/);
  assert.ifError((await admin.rpc("adjust_stock", { p_supply_id: ids.b, p_new_stock: 3, p_reason: "Conteo físico" })).error);
  assert.equal(await stockOf(ids.b), 3);

  const { data: movs } = await admin.from("inventory_movements").select("movement_type, quantity, balance_after").eq("supply_id", ids.b).order("movement_number");
  assert.deepEqual(movs.map((m) => [m.movement_type, Number(m.quantity), Number(m.balance_after)]), [["entrada", 4, 4], ["ajuste_negativo", 1, 3]]);
});

test("programación: permisos y aseo antes del preventivo", async () => {
  const m = await admin.from("machines").insert({ name: `PRUEBA Máquina ${run}` }).select().single();
  assert.ifError(m.error);
  const supMachine = await sup.from("machines").insert({ name: `PRUEBA no ${run}` });
  assert.ok(supMachine.error);

  const s = await admin.from("maintenance_schedules").insert({ machine_id: m.data.id, scheduled_date: "2026-12-10" }).select().single();
  assert.ifError(s.error);
  ids.schedule = s.data.id;
  assert.ok((await sup.from("maintenance_schedules").insert({ machine_id: m.data.id, scheduled_date: "2026-12-11" })).error);

  const late = await sup.from("cleaning_maintenances").insert({ schedule_id: ids.schedule, scheduled_date: "2026-12-11" });
  assert.match(late.error.message, /antes o el mismo día/);
  const c = await sup.from("cleaning_maintenances").insert({ schedule_id: ids.schedule, scheduled_date: "2026-12-09" }).select().single();
  assert.ifError(c.error);
  ids.cleaning = c.data.id;

  const moved = await admin.from("maintenance_schedules").update({ scheduled_date: "2026-12-08" }).eq("id", ids.schedule);
  assert.match(moved.error.message, /reprograme el aseo/);

  const ops = await sup.from("operators").insert([{ full_name: `PRUEBA Operario Uno ${run}` }, { full_name: `PRUEBA Operario Dos ${run}` }]).select();
  assert.ifError(ops.error);
  ids.op1 = ops.data[0].id; ids.op2 = ops.data[1].id;
  const asg = await sup.from("maintenance_assignments").insert([{ cleaning_id: ids.cleaning, operator_id: ids.op1 }, { cleaning_id: ids.cleaning, operator_id: ids.op2 }]);
  assert.ifError(asg.error);
  const dupAsg = await sup.from("maintenance_assignments").insert({ cleaning_id: ids.cleaning, operator_id: ids.op1 });
  assert.equal(dupAsg.error?.code, "23505");
});

test("entrega: atómica, sin negativos, varios productos", async () => {
  const tooMuch = await sup.rpc("confirm_delivery", {
    p_cleaning_id: ids.cleaning, p_operator_id: ids.op1,
    p_items: [{ supply_id: ids.a, quantity: 5 }, { supply_id: ids.b, quantity: 50 }],
  });
  assert.match(tooMuch.error.message, /Existencias insuficientes/);
  assert.equal(await stockOf(ids.a), 10, "la primera línea no debe descontarse si falla la segunda");
  assert.equal((await admin.from("supply_deliveries").select("id").eq("cleaning_id", ids.cleaning)).data.length, 0);

  const dup = await sup.rpc("confirm_delivery", {
    p_cleaning_id: ids.cleaning, p_operator_id: ids.op1,
    p_items: [{ supply_id: ids.a, quantity: 1 }, { supply_id: ids.a, quantity: 1 }],
  });
  assert.match(dup.error.message, /repetidos/);

  const ok = await sup.rpc("confirm_delivery", {
    p_cleaning_id: ids.cleaning, p_operator_id: ids.op1, p_notes: "Prueba",
    p_items: [{ supply_id: ids.a, quantity: 5, requested_qty: 6 }, { supply_id: ids.b, quantity: 2 }],
  });
  assert.ifError(ok.error);
  ids.delivery = ok.data.id;
  assert.equal(await stockOf(ids.a), 5);
  assert.equal(await stockOf(ids.b), 1);
  const cl = (await sup.from("cleaning_maintenances").select("status").eq("id", ids.cleaning).single()).data;
  assert.equal(cl.status, "en_proceso");
});

test("devolución parcial, límites y cierre", async () => {
  const { data: items } = await sup.from("v_delivery_items").select("id, supply_id, pending_qty").eq("delivery_id", ids.delivery);
  const itemA = items.find((i) => i.supply_id === ids.a);
  assert.equal(Number(itemA.pending_qty), 5);

  const over = await sup.rpc("register_return", { p_delivery_id: ids.delivery, p_items: [{ delivery_item_id: itemA.id, quantity: 6 }] });
  assert.match(over.error.message, /solo hay 5/);

  assert.ifError((await sup.rpc("register_return", { p_delivery_id: ids.delivery, p_items: [{ delivery_item_id: itemA.id, quantity: 2 }] })).error);
  assert.equal(await stockOf(ids.a), 7);

  const over2 = await sup.rpc("register_return", { p_delivery_id: ids.delivery, p_items: [{ delivery_item_id: itemA.id, quantity: 4 }] });
  assert.match(over2.error.message, /solo hay 3/);

  const closed = await sup.rpc("close_delivery", { p_delivery_id: ids.delivery, p_notes: "Aseo terminado" });
  assert.ifError(closed.error);
  assert.equal(Number(closed.data.consumed_total), 5); // 3 de A + 2 de B

  const after = (await sup.from("supply_delivery_items").select("delivered_qty, returned_qty, consumed_qty").eq("id", itemA.id).single()).data;
  assert.deepEqual([after.delivered_qty, after.returned_qty, after.consumed_qty].map(Number), [5, 2, 3]);

  const late = await sup.rpc("register_return", { p_delivery_id: ids.delivery, p_items: [{ delivery_item_id: itemA.id, quantity: 1 }] });
  assert.match(late.error.message, /cerrada/);
});

test("historial inalterable y entregas no editables directamente", async () => {
  const before = (await admin.from("inventory_movements").select("id", { count: "exact", head: true }).eq("supply_id", ids.a)).count;
  await admin.from("inventory_movements").delete().eq("supply_id", ids.a);
  await admin.from("supply_deliveries").delete().eq("id", ids.delivery);
  await admin.from("supply_deliveries").update({ status: "abierta" }).eq("id", ids.delivery);
  const after = (await admin.from("inventory_movements").select("id", { count: "exact", head: true }).eq("supply_id", ids.a)).count;
  assert.equal(after, before);
  const d = (await admin.from("supply_deliveries").select("status").eq("id", ids.delivery).single()).data;
  assert.equal(d.status, "cerrada");
  // Ni siquiera la service role puede alterar el kardex
  const svc = await service.from("inventory_movements").update({ quantity: 1 }).eq("supply_id", ids.a);
  assert.match(svc.error.message, /históricos/);
});

test("auditoría registra quién hizo cada operación (solo admin la ve)", async () => {
  const supView = await sup.from("audit_logs").select("id").limit(1);
  assert.equal(supView.data.length, 0);
  const { data } = await admin.from("audit_logs").select("action, user_id").eq("table_name", "supply_deliveries").eq("record_id", ids.delivery);
  assert.ok(data.length >= 2);
  assert.ok(data.every((r) => r.user_id));
});

test("concurrencia: dos entregas simultáneas del total no dejan stock negativo", async () => {
  const c = await admin.from("supplies").insert({ code: `PRUEBA-C-${run}`, name: "PRUEBA Concurrencia" }).select().single();
  await admin.rpc("register_stock_entry", { p_supply_id: c.data.id, p_quantity: 3 });
  const call = (client) => client.rpc("confirm_delivery", {
    p_cleaning_id: ids.cleaning, p_operator_id: ids.op2, p_items: [{ supply_id: c.data.id, quantity: 3 }],
  });
  const results = await Promise.all([call(admin), call(sup), call(admin)]);
  assert.equal(results.filter((r) => !r.error).length, 1);
  assert.equal(await stockOf(c.data.id), 0);
});

test("no se entrega a un aseo completado ni a un operario inactivo", async () => {
  await sup.from("operators").update({ active: false }).eq("id", ids.op2);
  const r1 = await sup.rpc("confirm_delivery", { p_cleaning_id: ids.cleaning, p_operator_id: ids.op2, p_items: [{ supply_id: ids.a, quantity: 1 }] });
  assert.match(r1.error.message, /inactivo/);
  await sup.from("cleaning_maintenances").update({ status: "completado" }).eq("id", ids.cleaning);
  const r2 = await sup.rpc("confirm_delivery", { p_cleaning_id: ids.cleaning, p_operator_id: ids.op1, p_items: [{ supply_id: ids.a, quantity: 1 }] });
  assert.match(r2.error.message, /completado/);
  const cl = (await sup.from("cleaning_maintenances").select("completed_at").eq("id", ids.cleaning).single()).data;
  assert.ok(cl.completed_at);
});
