"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

/* ------------------------------------------------------------------ Toasts */
type Toast = { id: number; tone: "success" | "error"; message: string };
const ToastContext = React.createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), t.tone === "error" ? 7000 : 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border bg-surface px-3.5 py-3 text-sm shadow-lg",
              t.tone === "success" ? "border-success/30" : "border-danger/40",
            )}
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            )}
            <p className="flex-1 text-foreground">{t.message}</p>
            <button
              className="text-muted hover:text-foreground"
              aria-label="Cerrar notificación"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastContext);
}

/**
 * Ejecuta una Server Action, muestra notificación y refresca los datos.
 * Devuelve [run, pending].
 */
export function useServerAction<A extends unknown[], T>(
  action: (...args: A) => Promise<ActionResult<T>>,
  opts: { onSuccess?: (data: T | undefined) => void; successMessage?: string; refresh?: boolean } = {},
) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  const run = React.useCallback(
    (...args: A) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          let res: ActionResult<T>;
          try {
            res = await action(...args);
          } catch {
            res = { ok: false, error: "No se pudo conectar con el servidor. Verifique su conexión e intente de nuevo." };
          }
          if (res.ok) {
            const msg = res.message ?? optsRef.current.successMessage;
            if (msg) toast({ tone: "success", message: msg });
            optsRef.current.onSuccess?.(res.data);
            if (optsRef.current.refresh !== false) router.refresh();
          } else {
            toast({ tone: "error", message: res.error });
          }
          resolve(res);
        });
      }),
    [action, router, toast],
  );
  return [run, pending] as const;
}

/* ------------------------------------------------------------------ Dialog */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      const target = d.querySelector<HTMLElement>("[autofocus], [data-autofocus]") ??
        d.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea");
      target?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const width = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl" }[size];
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-xl border border-border bg-surface p-0 text-foreground shadow-2xl",
        "sm:m-auto sm:rounded-xl",
        width,
      )}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button onClick={onClose} className="rounded p-1 text-muted hover:bg-neutral-soft" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}

/** Diálogo de confirmación para operaciones importantes. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirmar",
  tone = "primary",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      <div className="text-sm text-muted">{children}</div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant={tone} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
