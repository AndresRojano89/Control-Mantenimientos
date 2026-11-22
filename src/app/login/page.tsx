import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-white">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold leading-tight">AsePrev</p>
            <p className="text-sm text-muted">Control de aseo e insumos</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-base font-semibold">Iniciar sesión</h1>
          <p className="mb-5 mt-1 text-sm text-muted">Use el correo y la contraseña que le asignó el administrador.</p>
          <LoginForm next={next} initialError={error === "inactivo" ? "Su usuario está inactivo. Contacte al administrador." : undefined} />
        </div>
      </div>
    </main>
  );
}
