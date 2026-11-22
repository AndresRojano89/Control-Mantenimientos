"use client";

import { AlertTriangle } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={AlertTriangle}
        title="No se pudo cargar esta sección"
        description={error.message || "Ocurrió un error inesperado al consultar la información."}
        action={<Button onClick={reset}>Reintentar</Button>}
      />
    </Card>
  );
}
