"use client";

import * as React from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { ConfirmDialog, Dialog, DialogFooter, useServerAction } from "@/components/ui/client";
import type { Operator } from "@/lib/types";
import { saveOperator, setOperatorActive } from "./actions";

export function OperatorFormButton({ operator }: { operator?: Operator }) {
  const [open, setOpen] = React.useState(false);
  const [save, pending] = useServerAction(saveOperator, { onSuccess: () => setOpen(false) });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save(operator?.id ?? null, Object.fromEntries(f));
  }

  return (
    <>
      {operator ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nuevo operario
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={operator ? "Editar operario" : "Registrar operario"}>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo" htmlFor="full_name" required className="sm:col-span-2">
            <Input id="full_name" name="full_name" defaultValue={operator?.full_name} required maxLength={150} autoFocus />
          </Field>
          <Field label="Código interno" htmlFor="code" hint="Opcional. Debe ser único.">
            <Input id="code" name="code" defaultValue={operator?.code ?? ""} maxLength={40} />
          </Field>
          <Field label="Cargo o función" htmlFor="position">
            <Input id="position" name="position" defaultValue={operator?.position ?? ""} maxLength={100} />
          </Field>
          <Field label="Observaciones" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={operator?.notes ?? ""} maxLength={500} />
          </Field>
          <div className="sm:col-span-2">
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                {operator ? "Guardar cambios" : "Registrar"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function OperatorActiveToggle({ operator }: { operator: Operator }) {
  const [open, setOpen] = React.useState(false);
  const [toggle, pending] = useServerAction(setOperatorActive, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Power className="h-3.5 w-3.5" /> {operator.active ? "Desactivar" : "Activar"}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => toggle(operator.id, !operator.active)}
        loading={pending}
        tone={operator.active ? "danger" : "primary"}
        title={operator.active ? "¿Desactivar operario?" : "¿Activar operario?"}
        confirmLabel={operator.active ? "Desactivar" : "Activar"}
      >
        {operator.active
          ? `${operator.full_name} no podrá ser asignado a nuevos aseos ni recibir insumos. Su historial se conserva.`
          : `${operator.full_name} volverá a estar disponible para asignaciones y entregas.`}
      </ConfirmDialog>
    </>
  );
}
