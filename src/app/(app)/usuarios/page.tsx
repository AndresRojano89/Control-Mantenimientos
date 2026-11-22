import type { Metadata } from "next";
import { Badge, Card, MobileList, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { CreateUserButton, EditUserButton, ResetPasswordButton } from "./forms";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const me = await requireAdminPage();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name, email, role, active, created_at").order("active", { ascending: false }).order("full_name");
  if (error) throw new Error(error.message);
  const users = (data ?? []) as Profile[];

  return (
    <>
      <PageHeader title="Usuarios" description="Personas que pueden iniciar sesión y su rol." actions={<CreateUserButton />} />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Correo</Th>
              <Th>Rol</Th>
              <Th>Estado</Th>
              <Th>Creado</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-muted">
                <Td className="font-medium">{u.full_name}{u.id === me.id && <span className="ml-1 text-xs text-muted">(usted)</span>}</Td>
                <Td className="text-muted">{u.email}</Td>
                <Td><Badge tone={u.role === "admin" ? "primary" : "info"}>{ROLE_LABEL[u.role]}</Badge></Td>
                <Td>{u.active ? <Badge tone="success">Activo</Badge> : <Badge>Inactivo</Badge>}</Td>
                <Td className="whitespace-nowrap text-muted">{formatDateTime(u.created_at)}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <EditUserButton user={u} isSelf={u.id === me.id} />
                    <ResetPasswordButton user={u} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <MobileList>
          {users.map((u) => (
            <li key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{u.full_name}</p>
                  <p className="truncate text-sm text-muted">{u.email}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={u.role === "admin" ? "primary" : "info"}>{ROLE_LABEL[u.role]}</Badge>
                  {!u.active && <Badge>Inactivo</Badge>}
                </div>
              </div>
              <div className="mt-2 flex gap-1">
                <EditUserButton user={u} isSelf={u.id === me.id} />
                <ResetPasswordButton user={u} />
              </div>
            </li>
          ))}
        </MobileList>
      </Card>
    </>
  );
}
