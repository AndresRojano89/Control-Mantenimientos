export type AppRole = "admin" | "supervisor";
export type MaintenanceStatus = "pendiente" | "programado" | "en_proceso" | "completado" | "cancelado";
export type DeliveryStatus = "abierta" | "cerrada";
export type MovementType = "entrada" | "entrega" | "devolucion" | "ajuste_positivo" | "ajuste_negativo";
export type StockStatus = "ok" | "bajo" | "agotado";

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role: AppRole;
  active: boolean;
  created_at: string;
}

export interface Machine {
  id: string;
  name: string;
  code: string | null;
  area: string | null;
  description: string | null;
  active: boolean;
}

export interface Operator {
  id: string;
  code: string | null;
  full_name: string;
  position: string | null;
  active: boolean;
  notes: string | null;
}

export interface Supply {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
  reference_qty: number | null;
  location: string | null;
  active: boolean;
  pending_validation: boolean;
  validation_notes: string | null;
  stock_status?: StockStatus;
}

export interface Schedule {
  id: string;
  machine_id: string;
  maintenance_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  priorities: string | null;
  notes: string | null;
  status: MaintenanceStatus;
  completed_at: string | null;
}

export interface Cleaning {
  id: string;
  schedule_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  priorities: string | null;
  notes: string | null;
  status: MaintenanceStatus;
  completed_at: string | null;
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
