"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatQty } from "@/lib/utils";

const SERIES = "var(--primary)";
const GRID = "var(--border)";
const INK_MUTED = "var(--muted)";

function TooltipBox({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      <p className="tabular text-muted">
        {formatQty(payload[0].value)} {unit}
      </p>
    </div>
  );
}

/** Consumo neto (entregado − devuelto) por semana. Una sola serie: sin leyenda, el título la nombra. */
export function WeeklyConsumptionChart({ data }: { data: { week: string; qty: number }[] }) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Consumo neto de insumos por semana">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="0" />
          <XAxis dataKey="week" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: INK_MUTED, fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: INK_MUTED, fontSize: 11 }} allowDecimals={false} />
          <Tooltip cursor={{ fill: "var(--neutral-soft)" }} content={<TooltipBox unit="unidades netas" />} />
          <Bar dataKey="qty" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Productos con mayor cantidad entregada en el periodo. */
export function TopProductsChart({ data }: { data: { name: string; qty: number }[] }) {
  return (
    <div className="w-full" style={{ height: Math.max(140, data.length * 38) }} role="img" aria-label="Productos con mayor movimiento">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: INK_MUTED, fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={{ fill: "var(--foreground)", fontSize: 12 }} />
          <Tooltip cursor={{ fill: "var(--neutral-soft)" }} content={<TooltipBox unit="entregadas" />} />
          <Bar dataKey="qty" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
