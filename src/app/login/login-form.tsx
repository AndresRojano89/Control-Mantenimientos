"use client";

import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { signIn } from "./actions";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [state, formAction, pending] = useActionState(signIn, { error: initialError ?? "" });
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Correo electrónico" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error && (
        <p className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Ingresar
      </Button>
    </form>
  );
}
