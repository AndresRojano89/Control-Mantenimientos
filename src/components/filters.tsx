"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Actualiza parámetros de la URL (los filtros sobreviven a recargas y se pueden compartir). */
export function useQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const set = React.useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      next.delete("page");
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
    },
    [params, pathname, router],
  );
  return { params, set, pending };
}

export function SearchInput({ name = "q", placeholder, className }: { name?: string; placeholder: string; className?: string }) {
  const { params, set } = useQueryParams();
  const [value, setValue] = React.useState(params.get(name) ?? "");
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => set({ [name]: value.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
        aria-label={placeholder}
        type="search"
      />
      {value && (
        <button
          onClick={() => setValue("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function SelectFilter({
  name,
  label,
  options,
  allLabel = "Todos",
  className,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  className?: string;
}) {
  const { params, set } = useQueryParams();
  return (
    <Select
      aria-label={label}
      value={params.get(name) ?? ""}
      onChange={(e) => set({ [name]: e.target.value || null })}
      className={cn("sm:w-48", className)}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function DateFilter({ name, label, className }: { name: string; label: string; className?: string }) {
  const { params, set } = useQueryParams();
  return (
    <label className={cn("flex flex-col gap-1 text-xs font-medium text-muted", className)}>
      {label}
      <Input type="date" value={params.get(name) ?? ""} onChange={(e) => set({ [name]: e.target.value || null })} />
    </label>
  );
}
