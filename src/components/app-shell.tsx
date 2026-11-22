"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Factory,
  Users,
  Package,
  ClipboardList,
  History,
  UserCog,
  Menu,
  X,
  LogOut,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { signOut } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "Panel principal", icon: LayoutDashboard },
  { href: "/programacion", label: "Programación", icon: CalendarDays },
  { href: "/maquinas", label: "Máquinas", icon: Factory },
  { href: "/operarios", label: "Operarios", icon: Users },
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/entregas", label: "Entregas y devoluciones", icon: ClipboardList },
  { href: "/historial", label: "Historial y reportes", icon: History },
  { href: "/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Módulos">
      {NAV.filter((n) => !n.adminOnly || profile.role === "admin").map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",
              active ? "bg-sidebar-active font-medium text-white" : "text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-white",
            )}
          >
            <Icon className={cn("h-4 w-4", active ? "text-[#8fb6dc]" : "text-[#7f8ea0]")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white">
        <Wrench className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Control de Aseo</p>
        <p className="text-xs text-[#7f8ea0]">Mantenimientos e insumos</p>
      </div>
    </div>
  );
}

function UserMenu({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{profile.full_name}</p>
        <p className="text-xs text-muted">{ROLE_LABEL[profile.role]}</p>
      </div>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
        aria-hidden
      >
        {profile.full_name
          .split(" ")
          .slice(0, 2)
          .map((p) => p[0])
          .join("")
          .toUpperCase()}
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted hover:bg-neutral-soft hover:text-foreground"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden lg:inline">Salir</span>
        </button>
      </form>
    </div>
  );
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-dvh">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar lg:flex">
        <Brand />
        <NavLinks profile={profile} />
      </aside>

      {/* Drawer móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button onClick={() => setOpen(false)} className="rounded p-2 text-sidebar-foreground" aria-label="Cerrar menú">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks profile={profile} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="-ml-1 rounded-md p-2 text-muted hover:bg-neutral-soft lg:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="text-sm font-semibold text-foreground lg:hidden">Control de Aseo</p>
            <p className="hidden text-sm text-muted lg:block">Sistema de control de mantenimientos de aseo e insumos</p>
          </div>
          <UserMenu profile={profile} />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
