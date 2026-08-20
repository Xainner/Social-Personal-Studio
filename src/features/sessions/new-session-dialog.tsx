import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import { ErrorMessage } from "@/components/error-message";
import { useCreateSession } from "@/hooks/use-sessions";
import { useAppStore } from "@/stores/app-store";

export function NewSessionDialog({
  open,
  personaId,
  onClose,
}: {
  open: boolean;
  personaId: string;
  onClose: () => void;
}) {
  const createSession = useCreateSession(personaId);
  const setActiveSession = useAppStore((s) => s.setActiveSession);

  const [name, setName] = useState("");
  const [context, setContext] = useState("");

  function reset() {
    setName("");
    setContext("");
    createSession.reset();
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const session = await createSession.mutateAsync({
      name: trimmed,
      context: context.trim(),
    });
    setActiveSession(session.id);
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Nueva sesion"
      description="Agrupa imagenes y contexto de un mismo tema o salida."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createSession.isPending}
          >
            {createSession.isPending ? "Creando..." : "Crear"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="session-name">Nombre</Label>
          <Input
            id="session-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playa agosto"
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="session-context">Contexto (opcional)</Label>
          <Textarea
            id="session-context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={"Fin de semana en la playa.\nNo mencionar el hotel ni la ubicacion."}
          />
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            Este contexto aplica solo a esta sesion. No se vuelve memoria
            permanente de la persona.
          </p>
        </div>

        <ErrorMessage error={createSession.error} />
      </div>
    </Dialog>
  );
}
