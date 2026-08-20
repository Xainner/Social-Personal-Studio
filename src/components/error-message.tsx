import { AlertTriangle } from "lucide-react";
import { toAppError } from "@/types/errors";
import { cn } from "@/utils/cn";

/**
 * Muestra el error junto con qué puede hacer el usuario al respecto.
 * Nunca un "algo salió mal" a secas.
 */
export function ErrorMessage({
  error,
  className,
}: {
  error: unknown;
  className?: string;
}) {
  if (!error) return null;
  const appErr = toAppError(error);

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-md border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-3 py-2.5 text-sm",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--destructive)]" />
      <div className="space-y-1">
        <p className="font-medium">{appErr.message}</p>
        <p className="text-[var(--muted-foreground)]">{appErr.action}</p>
      </div>
    </div>
  );
}
