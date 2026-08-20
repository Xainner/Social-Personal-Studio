import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import { ErrorMessage } from "@/components/error-message";
import { useCreatePersona } from "@/hooks/use-personas";
import { useAppStore } from "@/stores/app-store";
import { ALL_PLATFORMS } from "@/types/domain";

export function NewPersonaDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const createPersona = useCreatePersona();
  const setActivePersona = useAppStore((s) => s.setActivePersona);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function reset() {
    setName("");
    setDescription("");
    createPersona.reset();
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const persona = await createPersona.mutateAsync({
      name: trimmed,
      displayName: trimmed,
      avatarAssetId: null,
      description: description.trim(),
      personaPrompt: "",
      language: "es",
      tone: "",
      defaultPlatforms: [...ALL_PLATFORMS],
      emojiLevel: "low",
      hashtagLevel: "none",
      style: {},
    });

    setActivePersona(persona.id);
    reset();
    onClose();
    navigate(`/persona/${persona.id}`);
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Nueva persona"
      description="Una identidad editorial con su propia voz, estilo e historial."
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
            disabled={!name.trim() || createPersona.isPending}
          >
            {createPersona.isPending ? "Creando..." : "Crear"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="persona-name">Nombre</Label>
          <Input
            id="persona-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ari"
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="persona-description">Descripcion breve</Label>
          <Textarea
            id="persona-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Quien es, de que habla, que la hace distinta."
          />
        </div>

        <p className="text-xs text-[var(--muted-foreground)]">
          Despues vas a poder definir su tono, ejemplos de estilo y reglas por
          plataforma.
        </p>

        <ErrorMessage error={createPersona.error} />
      </div>
    </Dialog>
  );
}
