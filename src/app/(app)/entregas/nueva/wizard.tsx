"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardCheck, Search, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog, DialogFooter, useServerAction } from "@/components/ui/client";
import { MAINTENANCE_STATUS } from "@/lib/labels";
import type { MaintenanceStatus, Supply } from "@/lib/types";
import { cn, formatDate, formatQty } from "@/lib/utils";
import { confirmDelivery } from "../actions";

export interface CleaningOption {
  id: string;
  date: string;
  status: MaintenanceStatus;
  machine: string;
  scheduleId: string;
  preventiveDate: string;
  operatorIds: string[];
}

type Line = { supply: Supply; quantity: string; requested: string };

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", done ? "bg-success text-white" : "bg-primary-soft text-primary")}>
              {n}
            </span>
            {title}
          </span>
        }
      />
      <div className="p-4 sm:p-5">{children}</div>
    </Card>
  );
}

function SupplySearch({ supplies, exclude, onPick }: { supplies: Supply[]; exclude: Set<string>; onPick: (s: Supply) => void }) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const term = q.trim().toLowerCase();
  const results = supplies
    .filter((s) => !exclude.has(s.id))
    .filter((s) => !term || s.name.toLowerCase().includes(term) || (s.code ?? "").includes(term))
    .slice(0, 12);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar producto por código o nombre"
        className="pl-9"
        aria-label="Buscar producto"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">Sin coincidencias.</li>}
          {results.map((s) => {
            const blocked = s.pending_validation || Number(s.stock) <= 0;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={blocked}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(s);
                    setQ("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="font-mono text-xs text-muted">{s.code ?? "Sin código"}</span>
                  </span>
                  {s.pending_validation ? (
                    <Badge tone="warning">Por validar</Badge>
                  ) : Number(s.stock) <= 0 ? (
                    <Badge tone="danger">Agotado</Badge>
                  ) : (
                    <span className="tabular whitespace-nowrap text-xs text-muted">
                      Disp. {formatQty(s.stock)} {s.unit}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DeliveryWizard({
  cleanings,
  operators,
  supplies,
  initialCleaningId,
}: {
  cleanings: CleaningOption[];
  operators: { id: string; full_name: string }[];
  supplies: Supply[];
  initialCleaningId?: string;
}) {
  const router = useRouter();
  const [cleaningId, setCleaningId] = React.useState(initialCleaningId ?? "");
  const [operatorId, setOperatorId] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([]);
  const [notes, setNotes] = React.useState("");
  const [review, setReview] = React.useState(false);
  const [confirm, pending] = useServerAction(confirmDelivery, {
    refresh: false,
    onSuccess: (d) => d && router.push(`/entregas/${d.id}`),
  });

  const cleaning = cleanings.find((c) => c.id === cleaningId);
  const assigned = operators.filter((o) => cleaning?.operatorIds.includes(o.id));
  const others = operators.filter((o) => !cleaning?.operatorIds.includes(o.id));

  React.useEffect(() => {
    // Si el aseo tiene un solo operario asignado, se preselecciona.
    if (cleaning && cleaning.operatorIds.length === 1 && operators.some((o) => o.id === cleaning.operatorIds[0])) {
      setOperatorId(cleaning.operatorIds[0]);
    }
  }, [cleaning, operators]);

  const lineErrors = lines.map((l) => {
    const q = Number(l.quantity);
    if (l.quantity === "" || !(q > 0)) return "Indique una cantidad mayor que cero.";
    if (q > Number(l.supply.stock)) return `Solo hay ${formatQty(l.supply.stock)} ${l.supply.unit} disponibles.`;
    if (l.requested !== "" && Number(l.requested) < 0) return "La cantidad solicitada no puede ser negativa.";
    return null;
  });
  const valid = !!cleaningId && !!operatorId && lines.length > 0 && lineErrors.every((e) => !e);
  const operatorName = operators.find((o) => o.id === operatorId)?.full_name;

  function submit() {
    confirm({
      cleaning_id: cleaningId,
      operator_id: operatorId,
      notes,
      items: lines.map((l) => ({
        supply_id: l.supply.id,
        quantity: Number(l.quantity),
        requested_qty: l.requested === "" ? null : Number(l.requested),
      })),
    });
  }

  return (
    <div className="space-y-5">
      <Step n={1} title="Mantenimiento de aseo" done={!!cleaning}>
        <Field label="Aseo al que corresponde la entrega" htmlFor="w-cleaning" required>
          <Select id="w-cleaning" value={cleaningId} onChange={(e) => { setCleaningId(e.target.value); setOperatorId(""); }}>
            <option value="" disabled>
              Seleccione el aseo
            </option>
            {cleanings.map((c) => (
              <option key={c.id} value={c.id}>
                {c.machine} · aseo {formatDate(c.date)} ({MAINTENANCE_STATUS[c.status].label.toLowerCase()})
              </option>
            ))}
          </Select>
        </Field>
        {cleaning && (
          <p className="mt-2 text-sm text-muted">
            Máquina <strong className="text-foreground">{cleaning.machine}</strong> · preventivo el {formatDate(cleaning.preventiveDate)}
          </p>
        )}
      </Step>

      <Step n={2} title="Operario que recibe" done={!!operatorId}>
        <Field label="Operario" htmlFor="w-operator" required hint={cleaning && assigned.length === 0 ? "Este aseo no tiene operarios asignados; puede elegir cualquier operario activo." : undefined}>
          <Select id="w-operator" value={operatorId} onChange={(e) => setOperatorId(e.target.value)} disabled={!cleaning}>
            <option value="" disabled>
              {cleaning ? "Seleccione el operario" : "Primero seleccione el aseo"}
            </option>
            {assigned.length > 0 && (
              <optgroup label="Asignados a este aseo">
                {assigned.map((o) => (
                  <option key={o.id} value={o.id}>{o.full_name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label={assigned.length ? "Otros operarios activos" : "Operarios activos"}>
              {others.map((o) => (
                <option key={o.id} value={o.id}>{o.full_name}</option>
              ))}
            </optgroup>
          </Select>
        </Field>
      </Step>

      <Step n={3} title="Productos a entregar" done={lines.length > 0 && lineErrors.every((e) => !e)}>
        <SupplySearch
          supplies={supplies}
          exclude={new Set(lines.map((l) => l.supply.id))}
          onPick={(s) => setLines((prev) => [...prev, { supply: s, quantity: "", requested: s.reference_qty != null ? String(s.reference_qty) : "" }])}
        />
        {lines.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Busque y agregue uno o varios productos. Los pendientes de validación o agotados no se pueden entregar.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-md border border-border">
            {lines.map((l, i) => (
              <li key={l.supply.id} className="grid gap-3 p-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-start">
                <div className="min-w-0">
                  <p className="font-medium">{l.supply.name}</p>
                  <p className="text-xs text-muted">
                    <span className="font-mono">{l.supply.code ?? "Sin código"}</span> · Disponible{" "}
                    <span className="tabular font-medium text-foreground">{formatQty(l.supply.stock)}</span> {l.supply.unit}
                  </p>
                  {lineErrors[i] && l.quantity !== "" && <p className="mt-1 text-xs text-danger">{lineErrors[i]}</p>}
                </div>
                <label className="text-xs font-medium text-muted">
                  Solicitado
                  <Input
                    type="number" min={0} step="0.01" inputMode="decimal" value={l.requested}
                    onChange={(e) => setLines((p) => p.map((x, j) => (j === i ? { ...x, requested: e.target.value } : x)))}
                    aria-label={`Cantidad solicitada de ${l.supply.name}`}
                  />
                </label>
                <label className="text-xs font-medium text-muted">
                  A entregar *
                  <Input
                    type="number" min={0.01} step="0.01" inputMode="decimal" value={l.quantity} max={Number(l.supply.stock)}
                    className={cn(lineErrors[i] && l.quantity !== "" && "border-danger")}
                    onChange={(e) => setLines((p) => p.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                    aria-label={`Cantidad a entregar de ${l.supply.name}`}
                  />
                </label>
                <Button variant="ghost" size="icon" className="sm:mt-5" aria-label={`Quitar ${l.supply.name}`} onClick={() => setLines((p) => p.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Field label="Observaciones" htmlFor="w-notes" className="mt-4">
          <Textarea id="w-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} />
        </Field>
      </Step>

      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        <Button variant="outline" size="lg" onClick={() => router.back()}>Cancelar</Button>
        <Button size="lg" disabled={!valid} onClick={() => setReview(true)}>
          <ClipboardCheck className="h-4 w-4" /> Revisar y confirmar
        </Button>
      </div>

      <Dialog open={review} onClose={() => setReview(false)} title="Resumen de la entrega" description="Al confirmar se descuentan las existencias. No se puede eliminar después; solo corregir con devoluciones." size="md">
        {cleaning && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted">Máquina</dt><dd className="font-medium">{cleaning.machine}</dd></div>
            <div><dt className="text-xs text-muted">Aseo</dt><dd className="font-medium">{formatDate(cleaning.date)}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted">Recibe</dt><dd className="font-medium">{operatorName}</dd></div>
          </dl>
        )}
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted">
              <th className="py-2">Producto</th>
              <th className="py-2 text-right">Entregar</th>
              <th className="py-2 text-right">Queda</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.supply.id} className="border-b border-border">
                <td className="py-2">{l.supply.name}<span className="block font-mono text-xs text-muted">{l.supply.code}</span></td>
                <td className="tabular py-2 text-right font-medium">{formatQty(l.quantity)} {l.supply.unit}</td>
                <td className={cn("tabular py-2 text-right", Number(l.supply.stock) - Number(l.quantity) <= Number(l.supply.min_stock) ? "text-warning" : "text-muted")}>
                  {formatQty(Number(l.supply.stock) - Number(l.quantity))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lines.some((l) => Number(l.supply.stock) - Number(l.quantity) <= Number(l.supply.min_stock)) && (
          <Alert tone="warning" icon={AlertTriangle} className="mt-3" title="Algunos productos quedarán en stock bajo o agotados." />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setReview(false)} disabled={pending}>Volver</Button>
          <Button onClick={submit} loading={pending}>Confirmar entrega</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
