"use client";

import * as React from "react";
import { Lock, Undo2 } from "lucide-react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog, DialogFooter, useServerAction } from "@/components/ui/client";
import { formatQty } from "@/lib/utils";
import { closeDelivery, registerReturn } from "../actions";

export interface PendingItem {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  delivered: number;
  returned: number;
  pending: number;
}

export function ReturnButton({
  deliveryId,
  items,
  operators,
  defaultOperatorId,
}: {
  deliveryId: string;
  items: PendingItem[];
  operators: { id: string; full_name: string }[];
  defaultOperatorId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [qty, setQty] = React.useState<Record<string, string>>({});
  const [run, pending] = useServerAction(registerReturn, { onSuccess: () => setOpen(false) });
  const withPending = items.filter((i) => i.pending > 0);

  const errors = Object.fromEntries(
    withPending.map((i) => {
      const v = qty[i.id];
      if (!v) return [i.id, null];
      const n = Number(v);
      if (!(n > 0)) return [i.id, "Debe ser mayor que cero."];
      if (n > i.pending) return [i.id, `Máximo ${formatQty(i.pending)}.`];
      return [i.id, null];
    }),
  );
  const chosen = withPending.filter((i) => qty[i.id] && Number(qty[i.id]) > 0);
  const valid = chosen.length > 0 && Object.values(errors).every((e) => !e);

  return (
    <>
      <Button variant="secondary" onClick={() => { setQty({}); setOpen(true); }} disabled={withPending.length === 0}>
        <Undo2 className="h-4 w-4" /> Registrar devolución
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Registrar devolución" description="Unidades sin usar que el operario devuelve. Vuelven al inventario." size="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run({
              delivery_id: deliveryId,
              operator_id: f.get("operator_id"),
              notes: f.get("notes"),
              items: chosen.map((i) => ({ delivery_item_id: i.id, quantity: Number(qty[i.id]) })),
            });
          }}
          className="grid gap-4"
        >
          <Field label="Devuelve" htmlFor="r-op">
            <Select id="r-op" name="operator_id" defaultValue={defaultOperatorId}>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>{o.full_name}</option>
              ))}
            </Select>
          </Field>
          <ul className="divide-y divide-border rounded-md border border-border">
            {withPending.map((i) => (
              <li key={i.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{i.name}</p>
                  <p className="text-xs text-muted">
                    Entregado {formatQty(i.delivered)} · devuelto {formatQty(i.returned)} · <strong>pendiente {formatQty(i.pending)}</strong> {i.unit}
                  </p>
                  {errors[i.id] && <p className="text-xs text-danger">{errors[i.id]}</p>}
                </div>
                <Input
                  type="number" min={0} max={i.pending} step="0.01" inputMode="decimal" placeholder="0"
                  value={qty[i.id] ?? ""} onChange={(e) => setQty((p) => ({ ...p, [i.id]: e.target.value }))}
                  aria-label={`Cantidad devuelta de ${i.name}`}
                />
              </li>
            ))}
          </ul>
          <Field label="Observaciones" htmlFor="r-notes">
            <Textarea id="r-notes" name="notes" rows={2} maxLength={1000} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" loading={pending} disabled={!valid}>Registrar devolución</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

export function CloseButton({ deliveryId, items }: { deliveryId: string; items: PendingItem[] }) {
  const [open, setOpen] = React.useState(false);
  const [run, pending] = useServerAction(closeDelivery, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Lock className="h-4 w-4" /> Cerrar entrega
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Cerrar entrega" description="Después de cerrar no se admiten más devoluciones." size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run({ delivery_id: deliveryId, notes: new FormData(e.currentTarget).get("notes") });
          }}
          className="grid gap-4"
        >
          <Alert tone="info" title="Se registrará como consumido:">
            <ul className="mt-1 space-y-0.5">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>{i.name}</span>
                  <span className="tabular font-medium text-foreground">{formatQty(i.pending)} {i.unit}</span>
                </li>
              ))}
            </ul>
          </Alert>
          <Field label="Resultado / observaciones del cierre" htmlFor="c-notes">
            <Textarea id="c-notes" name="notes" rows={2} maxLength={1000} placeholder="Ej.: aseo terminado sin novedades" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" loading={pending}>Cerrar entrega</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
