"use client";

import * as React from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Dialog, DialogFooter, useServerAction } from "@/components/ui/client";
import { MAINTENANCE_STATUS, MAINTENANCE_STATUS_OPTIONS } from "@/lib/labels";
import type { MaintenanceStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { saveCleaning, saveSchedule, setCleaningStatus, setScheduleStatus } from "./actions";

type Opt = { id: string; name: string; active?: boolean };

/* ------------------------------------------------------------ Preventivo */
export interface ScheduleFormValue {
  id: string;
  machine_id: string;
  maintenance_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  priorities: string | null;
  notes: string | null;
  status: MaintenanceStatus;
}

export function ScheduleFormButton({
  machines,
  schedule,
  defaultDate,
  label,
}: {
  machines: Opt[];
  schedule?: ScheduleFormValue;
  defaultDate?: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [save, pending] = useServerAction(saveSchedule, { onSuccess: () => setOpen(false) });
  const available = machines.filter((m) => m.active !== false || m.id === schedule?.machine_id);
  return (
    <>
      {schedule ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {label ?? "Nuevo preventivo"}
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={schedule ? "Editar mantenimiento preventivo" : "Programar mantenimiento preventivo"}
        description="Después podrá programar el aseo previo y asignar operarios."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(schedule?.id ?? null, Object.fromEntries(new FormData(e.currentTarget)));
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Máquina" htmlFor="s-machine" required className="sm:col-span-2">
            <Select id="s-machine" name="machine_id" defaultValue={schedule?.machine_id ?? ""} required autoFocus>
              <option value="" disabled>
                Seleccione una máquina
              </option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo de mantenimiento" htmlFor="s-type" required>
            <Input id="s-type" name="maintenance_type" defaultValue={schedule?.maintenance_type ?? "Preventivo"} required maxLength={60} />
          </Field>
          <Field label="Estado" htmlFor="s-status" required>
            <Select id="s-status" name="status" defaultValue={schedule?.status ?? "programado"}>
              {MAINTENANCE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha" htmlFor="s-date" required>
            <Input id="s-date" name="scheduled_date" type="date" defaultValue={schedule?.scheduled_date ?? defaultDate} required />
          </Field>
          <Field label="Hora" htmlFor="s-time" hint="Opcional">
            <Input id="s-time" name="scheduled_time" type="time" defaultValue={schedule?.scheduled_time?.slice(0, 5) ?? ""} />
          </Field>
          <Field label="Prioridades o aspectos a revisar" htmlFor="s-prio" className="sm:col-span-2" hint="Una por línea. Ej.: lo que envían los supervisores.">
            <Textarea id="s-prio" name="priorities" defaultValue={schedule?.priorities ?? ""} rows={4} maxLength={2000} />
          </Field>
          <Field label="Observaciones" htmlFor="s-notes" className="sm:col-span-2">
            <Textarea id="s-notes" name="notes" defaultValue={schedule?.notes ?? ""} maxLength={2000} />
          </Field>
          <div className="sm:col-span-2">
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                {schedule ? "Guardar cambios" : "Programar"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------ Aseo */
export interface CleaningFormValue {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  priorities: string | null;
  notes: string | null;
  status: MaintenanceStatus;
  operators: { id: string; full_name: string }[];
}

function OperatorPicker({
  operators,
  selected,
  onChange,
}: {
  operators: { id: string; full_name: string; active: boolean }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = React.useState("");
  const visible = operators.filter(
    (o) => (o.active || selected.includes(o.id)) && o.full_name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="rounded-md border border-border">
      <div className="relative border-b border-border">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar operario"
          className="h-9 w-full rounded-t-md bg-transparent pl-9 pr-3 text-sm focus:outline-none"
          aria-label="Buscar operario"
        />
      </div>
      <ul className="max-h-44 overflow-y-auto py-1">
        {visible.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted">
            {operators.length === 0 ? "No hay operarios registrados. Regístrelos en el módulo Operarios." : "Sin coincidencias."}
          </li>
        )}
        {visible.map((o) => (
          <li key={o.id}>
            <label className="flex min-h-10 cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-surface-muted">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--primary)]"
                checked={selected.includes(o.id)}
                onChange={() => toggle(o.id)}
              />
              <span className="flex-1">{o.full_name}</span>
              {!o.active && <Badge>Inactivo</Badge>}
            </label>
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-3 py-1.5 text-xs text-muted">{selected.length} seleccionado(s)</p>
    </div>
  );
}

export function CleaningFormButton({
  scheduleId,
  preventiveDate,
  operators,
  cleaning,
  variant = "primary",
}: {
  scheduleId: string;
  preventiveDate: string;
  operators: { id: string; full_name: string; active: boolean }[];
  cleaning?: CleaningFormValue;
  variant?: "primary" | "outline" | "secondary";
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(cleaning?.operators.map((o) => o.id) ?? []);
  const [save, pending] = useServerAction(saveCleaning, { onSuccess: () => setOpen(false) });

  React.useEffect(() => {
    if (open) setSelected(cleaning?.operators.map((o) => o.id) ?? []);
  }, [open, cleaning]);

  return (
    <>
      {cleaning ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
      ) : (
        <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Programar aseo
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={cleaning ? "Editar mantenimiento de aseo" : "Programar mantenimiento de aseo"}
        description={`El preventivo es el ${formatDate(preventiveDate)}. El aseo debe ser ese día o antes.`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            save(cleaning?.id ?? null, { ...f, schedule_id: scheduleId, operator_ids: selected });
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Fecha del aseo" htmlFor="c-date" required>
            <Input id="c-date" name="scheduled_date" type="date" max={preventiveDate} defaultValue={cleaning?.scheduled_date ?? ""} required autoFocus />
          </Field>
          <Field label="Hora" htmlFor="c-time" hint="Opcional">
            <Input id="c-time" name="scheduled_time" type="time" defaultValue={cleaning?.scheduled_time?.slice(0, 5) ?? ""} />
          </Field>
          <Field label="Estado" htmlFor="c-status" required className="sm:col-span-2">
            <Select id="c-status" name="status" defaultValue={cleaning?.status ?? "programado"}>
              {MAINTENANCE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium">Operarios responsables</p>
            <OperatorPicker operators={operators} selected={selected} onChange={setSelected} />
          </div>
          <Field label="Prioridades o aspectos a revisar" htmlFor="c-prio" className="sm:col-span-2">
            <Textarea id="c-prio" name="priorities" defaultValue={cleaning?.priorities ?? ""} rows={3} maxLength={2000} />
          </Field>
          <Field label="Observaciones" htmlFor="c-notes" className="sm:col-span-2">
            <Textarea id="c-notes" name="notes" defaultValue={cleaning?.notes ?? ""} rows={2} maxLength={2000} />
          </Field>
          <div className="sm:col-span-2">
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                {cleaning ? "Guardar cambios" : "Programar aseo"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------ Cambio rápido de estado */
export function StatusSelect({
  kind,
  id,
  status,
  disabled,
}: {
  kind: "schedule" | "cleaning";
  id: string;
  status: MaintenanceStatus;
  disabled?: boolean;
}) {
  const [run, pending] = useServerAction(kind === "schedule" ? setScheduleStatus : setCleaningStatus);
  const [value, setValue] = React.useState(status);
  React.useEffect(() => setValue(status), [status]);
  if (disabled) return <Badge tone={MAINTENANCE_STATUS[status].tone}>{MAINTENANCE_STATUS[status].label}</Badge>;
  return (
    <Select
      aria-label="Cambiar estado"
      value={value}
      disabled={pending}
      onChange={async (e) => {
        const next = e.target.value as MaintenanceStatus;
        const prev = value;
        if (next === "cancelado" && !window.confirm("¿Cancelar esta actividad? Podrá reactivarla cambiando el estado.")) return;
        setValue(next);
        const res = await run(id, next);
        if (!res.ok) setValue(prev);
      }}
      className={cn("h-8 w-36 text-xs font-medium", pending && "opacity-60")}
    >
      {MAINTENANCE_STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
