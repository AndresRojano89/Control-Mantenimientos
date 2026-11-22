"use client";

import * as React from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { ConfirmDialog, Dialog, DialogFooter, useServerAction } from "@/components/ui/client";
import type { Machine } from "@/lib/types";
import { saveMachine, setMachineActive } from "./actions";

export function MachineFormButton({ machine }: { machine?: Machine }) {
  const [open, setOpen] = React.useState(false);
  const [save, pending] = useServerAction(saveMachine, { onSuccess: () => setOpen(false) });
  return (
    <>
      {machine ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nueva máquina
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={machine ? "Editar máquina" : "Registrar máquina"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(machine?.id ?? null, Object.fromEntries(new FormData(e.currentTarget)));
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Nombre" htmlFor="m-name" required className="sm:col-span-2">
            <Input id="m-name" name="name" defaultValue={machine?.name} required maxLength={100} autoFocus />
          </Field>
          <Field label="Código" htmlFor="m-code" hint="Opcional. Debe ser único.">
            <Input id="m-code" name="code" defaultValue={machine?.code ?? ""} maxLength={40} />
          </Field>
          <Field label="Área o línea" htmlFor="m-area">
            <Input id="m-area" name="area" defaultValue={machine?.area ?? ""} maxLength={100} />
          </Field>
          <Field label="Descripción" htmlFor="m-desc" className="sm:col-span-2">
            <Textarea id="m-desc" name="description" defaultValue={machine?.description ?? ""} maxLength={500} />
          </Field>
          <div className="sm:col-span-2">
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                {machine ? "Guardar cambios" : "Registrar"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function MachineActiveToggle({ machine }: { machine: Machine }) {
  const [open, setOpen] = React.useState(false);
  const [toggle, pending] = useServerAction(setMachineActive, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Power className="h-3.5 w-3.5" /> {machine.active ? "Desactivar" : "Activar"}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => toggle(machine.id, !machine.active)}
        loading={pending}
        tone={machine.active ? "danger" : "primary"}
        title={machine.active ? "¿Desactivar máquina?" : "¿Activar máquina?"}
        confirmLabel={machine.active ? "Desactivar" : "Activar"}
      >
        {machine.active
          ? `"${machine.name}" no estará disponible para nuevas programaciones. Su historial se conserva.`
          : `"${machine.name}" volverá a estar disponible para programaciones.`}
      </ConfirmDialog>
    </>
  );
}
