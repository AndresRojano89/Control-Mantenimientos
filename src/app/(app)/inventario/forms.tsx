"use client";

import * as React from "react";
import { ArrowDownToLine, Pencil, Plus, Power, Scale } from "lucide-react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ConfirmDialog, Dialog, DialogFooter, useServerAction } from "@/components/ui/client";
import type { Supply } from "@/lib/types";
import { formatQty } from "@/lib/utils";
import { adjustStock, registerEntry, saveSupply, setSupplyActive } from "./actions";

/* ------------------------------------------------------------ Producto (admin) */
export function SupplyFormButton({ supply, categories }: { supply?: Supply; categories: string[] }) {
  const [open, setOpen] = React.useState(false);
  const [pendingValidation, setPendingValidation] = React.useState(supply?.pending_validation ?? false);
  const [save, pending] = useServerAction(saveSupply, { onSuccess: () => setOpen(false) });
  React.useEffect(() => {
    if (open) setPendingValidation(supply?.pending_validation ?? false);
  }, [open, supply]);

  return (
    <>
      {supply ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nuevo producto
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={supply ? "Editar producto" : "Registrar producto"}
        description="Las existencias no se editan aquí: se cargan con entradas y ajustes."
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            save(supply?.id ?? null, { ...f, pending_validation: pendingValidation });
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Código de almacén" htmlFor="p-code" hint="Único. Déjelo vacío si aún no se conoce.">
            <Input id="p-code" name="code" defaultValue={supply?.code ?? ""} maxLength={40} autoFocus />
          </Field>
          <Field label="Nombre del producto" htmlFor="p-name" required>
            <Input id="p-name" name="name" defaultValue={supply?.name} required maxLength={150} />
          </Field>
          <Field label="Categoría" htmlFor="p-cat" required>
            <Input id="p-cat" name="category" list="categories" defaultValue={supply?.category ?? ""} required maxLength={60} />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Unidad de medida" htmlFor="p-unit" required>
            <Input id="p-unit" name="unit" list="units" defaultValue={supply?.unit ?? "unidad"} required maxLength={30} />
            <datalist id="units">
              {["unidad", "rollo", "galón", "litro", "caja", "paquete", "kg"].map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
          <Field label="Stock mínimo" htmlFor="p-min" required hint="Por debajo o igual a este valor se alerta stock bajo.">
            <Input id="p-min" name="min_stock" type="number" min={0} step="0.01" defaultValue={supply?.min_stock ?? 0} required />
          </Field>
          <Field label="Cantidad de referencia" htmlFor="p-ref" hint="Lo que se suele pedir. No es existencia.">
            <Input id="p-ref" name="reference_qty" type="number" min={0} step="0.01" defaultValue={supply?.reference_qty ?? ""} />
          </Field>
          <Field label="Ubicación en almacén" htmlFor="p-loc" className="sm:col-span-2">
            <Input id="p-loc" name="location" defaultValue={supply?.location ?? ""} maxLength={100} />
          </Field>
          <Field label="Descripción" htmlFor="p-desc" className="sm:col-span-2">
            <Textarea id="p-desc" name="description" defaultValue={supply?.description ?? ""} rows={2} maxLength={500} />
          </Field>
          <div className="rounded-md border border-border p-3 sm:col-span-2">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--warning)]"
                checked={pendingValidation}
                onChange={(e) => setPendingValidation(e.target.checked)}
              />
              <span>
                <span className="font-medium">Pendiente de validación</span>
                <span className="block text-muted">Mientras esté marcado, el producto no se puede entregar ni recibir entradas.</span>
              </span>
            </label>
            {pendingValidation && (
              <Textarea
                name="validation_notes"
                className="mt-3"
                placeholder="¿Qué falta confirmar?"
                defaultValue={supply?.validation_notes ?? ""}
                rows={2}
                maxLength={500}
              />
            )}
          </div>
          <div className="sm:col-span-2">
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                {supply ? "Guardar cambios" : "Registrar"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function SupplyActiveToggle({ supply }: { supply: Supply }) {
  const [open, setOpen] = React.useState(false);
  const [toggle, pending] = useServerAction(setSupplyActive, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Power className="h-3.5 w-3.5" /> {supply.active ? "Desactivar" : "Activar"}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => toggle(supply.id, !supply.active)}
        loading={pending}
        tone={supply.active ? "danger" : "primary"}
        title={supply.active ? "¿Desactivar producto?" : "¿Activar producto?"}
        confirmLabel={supply.active ? "Desactivar" : "Activar"}
      >
        {supply.active
          ? `"${supply.name}" no podrá usarse en nuevas entregas. Su historial y existencias se conservan.`
          : `"${supply.name}" volverá a estar disponible.`}
      </ConfirmDialog>
    </>
  );
}

/* ------------------------------------------------------------ Entrada */
export function EntryButton({
  supplies,
  supplyId,
  size = "md",
}: {
  supplies: Pick<Supply, "id" | "code" | "name" | "unit" | "stock" | "active" | "pending_validation">[];
  supplyId?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState(supplyId ?? "");
  const [save, pending] = useServerAction(registerEntry, { onSuccess: () => setOpen(false) });
  const operable = supplies.filter((s) => s.active && !s.pending_validation);
  const current = supplies.find((s) => s.id === selected);
  React.useEffect(() => {
    if (open) setSelected(supplyId ?? "");
  }, [open, supplyId]);

  return (
    <>
      <Button variant={supplyId ? "outline" : "secondary"} size={size} onClick={() => setOpen(true)}>
        <ArrowDownToLine className="h-4 w-4" /> {supplyId ? "Entrada" : "Registrar entrada"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar entrada de inventario"
        description="Insumos recibidos del almacén o existencias iniciales contadas."
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(Object.fromEntries(new FormData(e.currentTarget)));
          }}
          className="grid gap-4"
        >
          <Field label="Producto" htmlFor="e-supply" required>
            <Select id="e-supply" name="supply_id" value={selected} onChange={(e) => setSelected(e.target.value)} required autoFocus>
              <option value="" disabled>
                Seleccione un producto
              </option>
              {operable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} · ` : ""}
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          {current && (
            <p className="-mt-2 text-xs text-muted">
              Existencia actual: {formatQty(current.stock)} {current.unit}
            </p>
          )}
          {supplies.length > operable.length && (
            <p className="-mt-2 text-xs text-muted">Los productos pendientes de validación o inactivos no aparecen.</p>
          )}
          <Field label={`Cantidad recibida${current ? ` (${current.unit})` : ""}`} htmlFor="e-qty" required>
            <Input id="e-qty" name="quantity" type="number" min={0.01} step="0.01" required inputMode="decimal" />
          </Field>
          <Field label="Motivo o referencia" htmlFor="e-reason" hint="Ej.: existencia inicial, vale de almacén N.º…">
            <Input id="e-reason" name="reason" maxLength={300} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Registrar entrada
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------ Ajuste (admin) */
export function AdjustButton({ supply }: { supply: Pick<Supply, "id" | "name" | "unit" | "stock"> }) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [save, pending] = useServerAction(adjustStock, { onSuccess: () => setOpen(false) });
  const delta = value === "" ? null : Number(value) - Number(supply.stock);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => { setValue(""); setOpen(true); }}>
        <Scale className="h-3.5 w-3.5" /> Ajustar
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Ajuste autorizado de inventario"
        description={`${supply.name} · existencia en sistema: ${formatQty(supply.stock)} ${supply.unit}`}
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save({ ...Object.fromEntries(new FormData(e.currentTarget)), supply_id: supply.id });
          }}
          className="grid gap-4"
        >
          <Alert tone="warning" title="Use ajustes solo para corregir diferencias de conteo.">
            Para entregas y devoluciones use su módulo; el ajuste queda en el historial con su motivo.
          </Alert>
          <Field label="Existencia física contada" htmlFor="a-qty" required>
            <Input id="a-qty" name="new_stock" type="number" min={0} step="0.01" required value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </Field>
          {delta !== null && !Number.isNaN(delta) && (
            <p className="-mt-2 text-sm">
              Diferencia:{" "}
              <span className={delta < 0 ? "text-danger" : delta > 0 ? "text-success" : "text-muted"}>
                {delta > 0 ? "+" : ""}
                {formatQty(delta)} {supply.unit}
              </span>
            </p>
          )}
          <Field label="Motivo" htmlFor="a-reason" required>
            <Textarea id="a-reason" name="reason" required rows={2} maxLength={300} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending} disabled={delta === 0}>
              Registrar ajuste
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
