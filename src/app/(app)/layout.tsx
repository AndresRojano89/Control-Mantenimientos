import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <ToastProvider>
      <AppShell profile={profile}>{children}</AppShell>
    </ToastProvider>
  );
}
