"use client";

import * as React from "react";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { Dialog, DialogFooter, useServerAction } from "@/components/ui/client";
import type { Profile } from "@/lib/types";
import { createUser, resetPassword, updateUser } from "./actions";

export function CreateUserButton() {
  const [open, setOpen] = React.useState(false);
  const [run, pending] = useServerAction(createUser, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nuevo usuario
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Crear usuario" description="Usuarios que inician sesión (administradores y supervisores). Los operarios no necesitan usuario." size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(Object.fromEntries(new FormData(e.currentTarget)));
          }}
          className="grid gap-4"
        >
          <Field label="Nombre completo" htmlFor="u-name" required>
            <Input id="u-name" name="full_name" required maxLength={150} autoFocus />
          </Field>
          <Field label="Correo" htmlFor="u-email" required>
            <Input id="u-email" name="email" type="email" required autoComplete="off" />
          </Field>
          <Field label="Contraseña inicial" htmlFor="u-pass" required hint="Mínimo 10 caracteres.">
            <Input id="u-pass" name="password" type="password" minLength={10} maxLength={72} required autoComplete="new-password" />
          </Field>
          <Field label="Rol" htmlFor="u-role" required>
            <Select id="u-role" name="role" defaultValue="supervisor">
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" loading={pending}>Crear usuario</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

export function EditUserButton({ user, isSelf }: { user: Profile; isSelf: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(user.active);
  const [run, pending] = useServerAction(updateUser, { onSuccess: () => setOpen(false) });
  React.useEffect(() => {
    if (open) setActive(user.active);
  }, [open, user.active]);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Editar
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Editar usuario" description={user.email ?? undefined} size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (!active && user.active && !window.confirm(`¿Desactivar a ${user.full_name}? No podrá iniciar sesión.`)) return;
            run({ id: user.id, full_name: f.get("full_name"), role: f.get("role"), active });
          }}
          className="grid gap-4"
        >
          <Field label="Nombre completo" htmlFor="eu-name" required>
            <Input id="eu-name" name="full_name" defaultValue={user.full_name} required maxLength={150} autoFocus />
          </Field>
          <Field label="Rol" htmlFor="eu-role" required hint={isSelf ? "No puede cambiar su propio rol." : undefined}>
            <Select id="eu-role" name="role" defaultValue={user.role} disabled={isSelf}>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
            </Select>
            {isSelf && <input type="hidden" name="role" value={user.role} />}
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={active} disabled={isSelf} onChange={(e) => setActive(e.target.checked)} />
            Usuario activo (puede iniciar sesión)
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" loading={pending}>Guardar</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

export function ResetPasswordButton({ user }: { user: Profile }) {
  const [open, setOpen] = React.useState(false);
  const [run, pending] = useServerAction(resetPassword, { onSuccess: () => setOpen(false), refresh: false });
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <KeyRound className="h-3.5 w-3.5" /> Contraseña
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Cambiar contraseña" description={user.full_name} size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(user.id, String(new FormData(e.currentTarget).get("password") ?? ""));
          }}
          className="grid gap-4"
        >
          <Field label="Nueva contraseña" htmlFor="rp-pass" required hint="Mínimo 10 caracteres.">
            <Input id="rp-pass" name="password" type="password" minLength={10} maxLength={72} required autoComplete="new-password" autoFocus />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" loading={pending}>Cambiar</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
