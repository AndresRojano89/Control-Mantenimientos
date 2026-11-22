import type { BadgeTone } from "@/components/ui";
import type { MaintenanceStatus } from "@/lib/types";
import { diffDaysISO } from "@/lib/utils";

/** Días antes del preventivo a partir de los cuales un aseo no completado se considera urgente. */
export const CLEANING_WARNING_DAYS = 2;
/** Días hacia adelante en que un preventivo sin aseo programado genera alerta. */
export const MISSING_CLEANING_WINDOW_DAYS = 7;

export interface CleaningLike {
  id: string;
  scheduled_date: string;
  status: MaintenanceStatus;
  operators?: { id: string; full_name: string }[];
}
export interface ScheduleLike {
  id: string;
  scheduled_date: string;
  status: MaintenanceStatus;
  machine: { name: string };
  cleanings: CleaningLike[];
}

export interface ScheduleAlert {
  tone: BadgeTone;
  message: string;
}

/** Calcula las advertencias de aseo para un preventivo. */
export function scheduleAlerts(s: ScheduleLike, today: string): ScheduleAlert[] {
  if (s.status === "completado" || s.status === "cancelado") return [];
  const daysToPreventive = diffDaysISO(today, s.scheduled_date);
  if (daysToPreventive < 0) {
    return [{ tone: "danger", message: `El preventivo estaba programado hace ${-daysToPreventive} día(s) y no se ha cerrado.` }];
  }
  const active = s.cleanings.filter((c) => c.status !== "cancelado");
  const alerts: ScheduleAlert[] = [];
  const when = daysToPreventive === 0 ? "hoy" : daysToPreventive === 1 ? "mañana" : `en ${daysToPreventive} días`;

  if (active.length === 0) {
    if (daysToPreventive <= MISSING_CLEANING_WINDOW_DAYS) {
      alerts.push({
        tone: daysToPreventive <= CLEANING_WARNING_DAYS ? "danger" : "warning",
        message: `Sin aseo programado. El preventivo es ${when}.`,
      });
    }
    return alerts;
  }
  if (active.some((c) => c.status === "completado")) return alerts;

  for (const c of active) {
    if (diffDaysISO(today, c.scheduled_date) < 0) {
      alerts.push({ tone: "danger", message: `Aseo atrasado: estaba programado para el ${c.scheduled_date.split("-").reverse().join("/")} y no se ha completado.` });
    } else if (daysToPreventive <= CLEANING_WARNING_DAYS) {
      alerts.push({ tone: "warning", message: `Aseo aún no completado y el preventivo es ${when}.` });
    }
    if (c.operators && c.operators.length === 0) {
      alerts.push({ tone: "warning", message: "El aseo no tiene operarios asignados." });
    }
  }
  return alerts;
}
