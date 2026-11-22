import type { BadgeTone } from "@/components/ui/badge";
import type { DeliveryStatus, MaintenanceStatus, MovementType, StockStatus } from "@/lib/types";

export const MAINTENANCE_STATUS: Record<MaintenanceStatus, { label: string; tone: BadgeTone }> = {
  pendiente: { label: "Pendiente", tone: "warning" },
  programado: { label: "Programado", tone: "info" },
  en_proceso: { label: "En proceso", tone: "primary" },
  completado: { label: "Completado", tone: "success" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};
export const MAINTENANCE_STATUS_OPTIONS = Object.entries(MAINTENANCE_STATUS).map(([value, v]) => ({
  value: value as MaintenanceStatus,
  label: v.label,
}));

export const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; tone: BadgeTone }> = {
  abierta: { label: "Abierta", tone: "warning" },
  cerrada: { label: "Cerrada", tone: "success" },
};

export const MOVEMENT_TYPE: Record<MovementType, { label: string; tone: BadgeTone; sign: 1 | -1 }> = {
  entrada: { label: "Entrada", tone: "success", sign: 1 },
  entrega: { label: "Entrega", tone: "primary", sign: -1 },
  devolucion: { label: "Devolución", tone: "info", sign: 1 },
  ajuste_positivo: { label: "Ajuste (+)", tone: "warning", sign: 1 },
  ajuste_negativo: { label: "Ajuste (−)", tone: "danger", sign: -1 },
};

export const STOCK_STATUS: Record<StockStatus, { label: string; tone: BadgeTone }> = {
  ok: { label: "Disponible", tone: "success" },
  bajo: { label: "Stock bajo", tone: "warning" },
  agotado: { label: "Agotado", tone: "danger" },
};

export const ROLE_LABEL = { admin: "Administrador", supervisor: "Supervisor" } as const;
