import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportColumn, ReportRow } from "@/components/export-buttons";
import { DELIVERY_STATUS, MAINTENANCE_STATUS, MOVEMENT_TYPE } from "@/lib/labels";
import type { DeliveryStatus, MaintenanceStatus, MovementType } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export type ReportKey = "mantenimientos" | "entregas" | "devoluciones" | "movimientos" | "consumo" | "auditoria";

export interface ReportFilters {
  desde?: string;
  hasta?: string;
  maquina?: string;
  operario?: string;
  producto?: string;
  tipo?: string;
  estado?: string;
}

export interface Report {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Valores para filtros que el informe soporta. */
  supports: (keyof ReportFilters)[];
}

const LIMIT = 3000;
const TZ_OFFSET = "-05:00"; // America/Bogota (sin horario de verano)
const startTs = (d: string) => `${d}T00:00:00${TZ_OFFSET}`;
const endTs = (d: string) => `${d}T23:59:59.999${TZ_OFFSET}`;
const n = (v: unknown) => Number(v ?? 0);

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function buildReport(supabase: SupabaseClient, key: ReportKey, f: ReportFilters): Promise<Report> {
  switch (key) {
    case "mantenimientos": {
      let q = supabase
        .from("maintenance_schedules")
        .select(
          "id, maintenance_type, scheduled_date, status, completed_at, machine_id, machine:machines(name), cleanings:cleaning_maintenances(id, scheduled_date, status, completed_at, assignments:maintenance_assignments(operator_id, operator:operators(full_name)))",
        )
        .order("scheduled_date", { ascending: false })
        .limit(LIMIT);
      if (f.maquina) q = q.eq("machine_id", f.maquina);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows: ReportRow[] = [];
      for (const s of (data ?? []) as any[]) {
        const inRange = (d: string) => (!f.desde || d >= f.desde) && (!f.hasta || d <= f.hasta);
        const sOps: string[] = [];
        if (inRange(s.scheduled_date) && (!f.estado || s.status === f.estado) && !f.operario) {
          rows.push({
            fecha: formatDate(s.scheduled_date),
            tipo: s.maintenance_type,
            maquina: s.machine.name,
            estado: MAINTENANCE_STATUS[s.status as MaintenanceStatus].label,
            operarios: sOps.join(", ") || "—",
            completado: s.completed_at ? formatDateTime(s.completed_at) : "—",
            _sort: s.scheduled_date,
          });
        }
        for (const c of s.cleanings ?? []) {
          const opIds = (c.assignments ?? []).map((a: any) => a.operator_id);
          if (!inRange(c.scheduled_date) || (f.estado && c.status !== f.estado) || (f.operario && !opIds.includes(f.operario))) continue;
          rows.push({
            fecha: formatDate(c.scheduled_date),
            tipo: `Aseo (previo al ${formatDate(s.scheduled_date, { year: false })})`,
            maquina: s.machine.name,
            estado: MAINTENANCE_STATUS[c.status as MaintenanceStatus].label,
            operarios: (c.assignments ?? []).map((a: any) => a.operator?.full_name).filter(Boolean).join(", ") || "Sin asignar",
            completado: c.completed_at ? formatDateTime(c.completed_at) : "—",
            _sort: c.scheduled_date,
          });
        }
      }
      rows.sort((a, b) => String(b._sort).localeCompare(String(a._sort)));
      rows.forEach((r) => delete r._sort);
      return {
        title: "Historial de mantenimientos",
        supports: ["desde", "hasta", "maquina", "operario", "estado"],
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "tipo", label: "Tipo" },
          { key: "maquina", label: "Máquina" },
          { key: "estado", label: "Estado" },
          { key: "operarios", label: "Operarios" },
          { key: "completado", label: "Completado" },
        ],
        rows,
      };
    }

    case "entregas":
    case "consumo": {
      let q = supabase
        .from("supply_delivery_items")
        .select(
          "id, requested_qty, delivered_qty, returned_qty, consumed_qty, supply_id, supply:supplies(code, name, unit), delivery:supply_deliveries!inner(delivery_number, delivered_at, status, operator_id, operator:operators(full_name), deliverer:profiles!supply_deliveries_delivered_by_fkey(full_name), cleaning:cleaning_maintenances(scheduled_date, schedule:maintenance_schedules(machine_id, machine:machines(name))))",
        )
        .limit(LIMIT);
      if (f.desde) q = q.gte("delivery.delivered_at", startTs(f.desde));
      if (f.hasta) q = q.lte("delivery.delivered_at", endTs(f.hasta));
      if (f.producto) q = q.eq("supply_id", f.producto);
      if (f.operario) q = q.eq("delivery.operator_id", f.operario);
      if (key === "entregas" && (f.estado === "abierta" || f.estado === "cerrada")) q = q.eq("delivery.status", f.estado);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let items = (data ?? []) as any[];
      if (f.maquina) items = items.filter((i) => i.delivery.cleaning.schedule.machine_id === f.maquina);
      items.sort((a, b) => b.delivery.delivery_number - a.delivery.delivery_number);

      if (key === "entregas") {
        return {
          title: "Historial de entregas",
          supports: ["desde", "hasta", "maquina", "operario", "producto", "estado"],
          columns: [
            { key: "numero", label: "N.º" },
            { key: "fecha", label: "Fecha" },
            { key: "maquina", label: "Máquina" },
            { key: "recibe", label: "Recibe" },
            { key: "entrega", label: "Entregó" },
            { key: "codigo", label: "Código" },
            { key: "producto", label: "Producto" },
            { key: "solicitado", label: "Solicitado", numeric: true },
            { key: "entregado", label: "Entregado", numeric: true },
            { key: "devuelto", label: "Devuelto", numeric: true },
            { key: "consumido", label: "Consumido", numeric: true },
            { key: "estado", label: "Estado" },
          ],
          rows: items.map((i) => ({
            numero: i.delivery.delivery_number,
            fecha: formatDateTime(i.delivery.delivered_at),
            maquina: i.delivery.cleaning.schedule.machine.name,
            recibe: i.delivery.operator.full_name,
            entrega: i.delivery.deliverer?.full_name ?? "",
            codigo: i.supply.code ?? "",
            producto: i.supply.name,
            solicitado: i.requested_qty === null ? "" : n(i.requested_qty),
            entregado: n(i.delivered_qty),
            devuelto: n(i.returned_qty),
            consumido: i.delivery.status === "cerrada" ? n(i.consumed_qty) : "",
            estado: DELIVERY_STATUS[i.delivery.status as DeliveryStatus].label,
          })),
        };
      }

      const agg = new Map<string, ReportRow>();
      for (const i of items) {
        const row = agg.get(i.supply_id) ?? {
          codigo: i.supply.code ?? "",
          producto: i.supply.name,
          unidad: i.supply.unit,
          entregas: 0,
          entregado: 0,
          devuelto: 0,
          consumido: 0,
          pendiente: 0,
        };
        row.entregas = n(row.entregas) + 1;
        row.entregado = n(row.entregado) + n(i.delivered_qty);
        row.devuelto = n(row.devuelto) + n(i.returned_qty);
        row.consumido = n(row.consumido) + n(i.consumed_qty);
        if (i.delivery.status === "abierta") row.pendiente = n(row.pendiente) + n(i.delivered_qty) - n(i.returned_qty);
        agg.set(i.supply_id, row);
      }
      return {
        title: "Consumo de insumos por producto",
        supports: ["desde", "hasta", "maquina", "operario", "producto"],
        columns: [
          { key: "codigo", label: "Código" },
          { key: "producto", label: "Producto" },
          { key: "unidad", label: "Unidad" },
          { key: "entregas", label: "Entregas", numeric: true },
          { key: "entregado", label: "Entregado", numeric: true },
          { key: "devuelto", label: "Devuelto", numeric: true },
          { key: "consumido", label: "Consumido", numeric: true },
          { key: "pendiente", label: "Pendiente dev.", numeric: true },
        ],
        rows: [...agg.values()].sort((a, b) => n(b.entregado) - n(a.entregado)),
      };
    }

    case "devoluciones": {
      let q = supabase
        .from("supply_return_items")
        .select(
          "id, quantity, item:supply_delivery_items!inner(supply_id, supply:supplies(code, name, unit)), ret:supply_returns!inner(return_number, returned_at, notes, operator_id, operator:operators(full_name), receiver:profiles!supply_returns_received_by_fkey(full_name), delivery:supply_deliveries(delivery_number, cleaning:cleaning_maintenances(schedule:maintenance_schedules(machine_id, machine:machines(name)))))",
        )
        .limit(LIMIT);
      if (f.desde) q = q.gte("ret.returned_at", startTs(f.desde));
      if (f.hasta) q = q.lte("ret.returned_at", endTs(f.hasta));
      if (f.producto) q = q.eq("item.supply_id", f.producto);
      if (f.operario) q = q.eq("ret.operator_id", f.operario);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let rows = (data ?? []) as any[];
      if (f.maquina) rows = rows.filter((r) => r.ret.delivery.cleaning.schedule.machine_id === f.maquina);
      rows.sort((a, b) => b.ret.return_number - a.ret.return_number);
      return {
        title: "Historial de devoluciones",
        supports: ["desde", "hasta", "maquina", "operario", "producto"],
        columns: [
          { key: "numero", label: "N.º dev." },
          { key: "fecha", label: "Fecha" },
          { key: "entrega", label: "Entrega" },
          { key: "maquina", label: "Máquina" },
          { key: "devolvio", label: "Devolvió" },
          { key: "recibio", label: "Recibió" },
          { key: "producto", label: "Producto" },
          { key: "cantidad", label: "Cantidad", numeric: true },
          { key: "unidad", label: "Unidad" },
        ],
        rows: rows.map((r) => ({
          numero: r.ret.return_number,
          fecha: formatDateTime(r.ret.returned_at),
          entrega: `#${r.ret.delivery.delivery_number}`,
          maquina: r.ret.delivery.cleaning.schedule.machine.name,
          devolvio: r.ret.operator.full_name,
          recibio: r.ret.receiver?.full_name ?? "",
          producto: r.item.supply.name,
          cantidad: n(r.quantity),
          unidad: r.item.supply.unit,
        })),
      };
    }

    case "movimientos": {
      let q = supabase
        .from("inventory_movements")
        .select(
          "movement_number, movement_type, quantity, balance_after, reason, created_at, supply_id, supply:supplies(code, name, unit), user:profiles!inventory_movements_created_by_fkey(full_name), delivery:supply_deliveries(operator_id, operator:operators(full_name), cleaning:cleaning_maintenances(schedule:maintenance_schedules(machine_id, machine:machines(name))))",
        )
        .order("movement_number", { ascending: false })
        .limit(LIMIT);
      if (f.desde) q = q.gte("created_at", startTs(f.desde));
      if (f.hasta) q = q.lte("created_at", endTs(f.hasta));
      if (f.producto) q = q.eq("supply_id", f.producto);
      if (f.tipo && f.tipo in MOVEMENT_TYPE) q = q.eq("movement_type", f.tipo);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      let rows = (data ?? []) as any[];
      if (f.maquina) rows = rows.filter((m) => m.delivery?.cleaning?.schedule?.machine_id === f.maquina);
      if (f.operario) rows = rows.filter((m) => m.delivery?.operator_id === f.operario);
      return {
        title: "Movimientos de inventario",
        supports: ["desde", "hasta", "maquina", "operario", "producto", "tipo"],
        columns: [
          { key: "numero", label: "N.º" },
          { key: "fecha", label: "Fecha" },
          { key: "tipo", label: "Tipo" },
          { key: "codigo", label: "Código" },
          { key: "producto", label: "Producto" },
          { key: "cantidad", label: "Cantidad", numeric: true },
          { key: "saldo", label: "Saldo", numeric: true },
          { key: "maquina", label: "Máquina" },
          { key: "operario", label: "Operario" },
          { key: "detalle", label: "Detalle" },
          { key: "usuario", label: "Usuario" },
        ],
        rows: rows.map((m) => {
          const t = MOVEMENT_TYPE[m.movement_type as MovementType];
          return {
            numero: m.movement_number,
            fecha: formatDateTime(m.created_at),
            tipo: t.label,
            codigo: m.supply.code ?? "",
            producto: m.supply.name,
            cantidad: t.sign * n(m.quantity),
            saldo: n(m.balance_after),
            maquina: m.delivery?.cleaning?.schedule?.machine?.name ?? "",
            operario: m.delivery?.operator?.full_name ?? "",
            detalle: m.reason ?? "",
            usuario: m.user?.full_name ?? "",
          };
        }),
      };
    }

    case "auditoria": {
      let q = supabase.from("audit_logs").select("id, table_name, record_id, action, user_id, created_at").order("id", { ascending: false }).limit(LIMIT);
      if (f.desde) q = q.gte("created_at", startTs(f.desde));
      if (f.hasta) q = q.lte("created_at", endTs(f.hasta));
      const [{ data, error }, { data: profiles }] = await Promise.all([q, supabase.from("profiles").select("id, full_name")]);
      if (error) throw new Error(error.message);
      const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      const TABLES: Record<string, string> = {
        profiles: "Usuarios", machines: "Máquinas", operators: "Operarios", supplies: "Insumos",
        maintenance_schedules: "Preventivos", cleaning_maintenances: "Aseos", maintenance_assignments: "Asignaciones",
        supply_deliveries: "Entregas", supply_delivery_items: "Ítems de entrega", supply_returns: "Devoluciones",
        supply_return_items: "Ítems de devolución", inventory_movements: "Movimientos",
      };
      const ACTIONS: Record<string, string> = { INSERT: "Creó", UPDATE: "Modificó", DELETE: "Eliminó" };
      return {
        title: "Registro de auditoría",
        supports: ["desde", "hasta"],
        columns: [
          { key: "fecha", label: "Fecha" },
          { key: "usuario", label: "Usuario" },
          { key: "accion", label: "Acción" },
          { key: "modulo", label: "Módulo" },
          { key: "registro", label: "Registro" },
        ],
        rows: ((data ?? []) as any[]).map((a) => ({
          fecha: formatDateTime(a.created_at),
          usuario: a.user_id ? names.get(a.user_id) ?? "—" : "Sistema",
          accion: ACTIONS[a.action] ?? a.action,
          modulo: TABLES[a.table_name] ?? a.table_name,
          registro: a.record_id?.slice(0, 8) ?? "",
        })),
      };
    }
  }
}
