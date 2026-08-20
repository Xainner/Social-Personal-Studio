import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, Plus, Trash2 } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { exportPersona } from "@/features/personas/persona-io";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  Separator,
  Textarea,
} from "@/components/ui/primitives";
import { ErrorMessage } from "@/components/error-message";
import {
  useAddExample,
  useAddMemory,
  useDeleteExample,
  useDeleteMemory,
  useDeletePersona,
  usePersona,
  usePersonaExamples,
  usePersonaMemories,
  usePersonaPlatformSettings,
  useToggleMemory,
  useUpdatePersona,
  useUpsertPlatformSettings,
} from "@/hooks/use-personas";
import { listPlatformAdapters } from "@/platforms/registry";
import { useAppStore } from "@/stores/app-store";
import type { EmojiLevel, HashtagLevel, PlatformId } from "@/types/domain";
import { cn } from "@/utils/cn";

type Tab = "core" | "examples" | "memory" | "platforms";

const TABS: { id: Tab; label: string }[] = [
  { id: "core", label: "Identidad" },
  { id: "examples", label: "Ejemplos" },
  { id: "memory", label: "Memoria de estilo" },
  { id: "platforms", label: "Plataformas" },
];

export function PersonaEditorView() {
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const { data: persona, isLoading } = usePersona(personaId ?? null);
  const setActivePersona = useAppStore((s) => s.setActivePersona);
  const [tab, setTab] = useState<Tab>("core");

  if (isLoading) {
    return <div className="p-6 text-sm text-[var(--muted-foreground)]">Cargando...</div>;
  }
  if (!persona || !personaId) {
    return <div className="p-6 text-sm">No se encontro la persona.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {persona.displayName || persona.name}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Identidad editorial independiente
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ExportPersonaButton personaId={personaId} personaName={persona.name} />
          <DeletePersonaButton
            personaId={personaId}
            onDeleted={() => {
              setActivePersona(null);
              navigate("/composer");
            }}
          />
        </div>
      </header>

      <nav className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === t.id
                ? "border-[var(--primary)] font-medium"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "core" ? <CoreTab personaId={personaId} /> : null}
      {tab === "examples" ? <ExamplesTab personaId={personaId} /> : null}
      {tab === "memory" ? <MemoryTab personaId={personaId} /> : null}
      {tab === "platforms" ? <PlatformsTab personaId={personaId} /> : null}
    </div>
  );
}

function ExportPersonaButton({
  personaId,
  personaName,
}: {
  personaId: string;
  personaName: string;
}) {
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  async function handleExport() {
    setError(null);
    try {
      const json = await exportPersona(personaId);
      const slug = personaName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const destination = await save({
        title: "Exportar persona",
        defaultPath: `${slug}.persona.json`,
        filters: [{ name: "Persona", extensions: ["json"] }],
      });
      if (!destination) return;

      await writeTextFile(destination, json);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleExport}>
        <Download className="h-3.5 w-3.5" />
        {done ? "Exportada" : "Exportar"}
      </Button>
      {error ? (
        <div className="absolute right-6 top-20 max-w-sm">
          <ErrorMessage error={error} />
        </div>
      ) : null}
    </>
  );
}

function DeletePersonaButton({
  personaId,
  onDeleted,
}: {
  personaId: string;
  onDeleted: () => void;
}) {
  const deletePersona = useDeletePersona();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        <Trash2 className="h-3.5 w-3.5" />
        Eliminar
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--muted-foreground)]">
        Se borran sus sesiones y posts.
      </span>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={async () => {
          await deletePersona.mutateAsync(personaId);
          onDeleted();
        }}
      >
        Confirmar
      </Button>
    </div>
  );
}

function CoreTab({ personaId }: { personaId: string }) {
  const { data: persona } = usePersona(personaId);
  const updatePersona = useUpdatePersona();
  const [form, setForm] = useState({
    displayName: "",
    description: "",
    personaPrompt: "",
    tone: "",
    language: "es",
    emojiLevel: "low" as EmojiLevel,
    hashtagLevel: "none" as HashtagLevel,
    personality: "",
    communicationStyle: "",
    forbiddenVocabulary: "",
    preferredVocabulary: "",
    commonExpressions: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!persona) return;
    setForm({
      displayName: persona.displayName,
      description: persona.description,
      personaPrompt: persona.personaPrompt,
      tone: persona.tone,
      language: persona.language,
      emojiLevel: persona.emojiLevel,
      hashtagLevel: persona.hashtagLevel,
      personality: persona.style.personality ?? "",
      communicationStyle: persona.style.communicationStyle ?? "",
      forbiddenVocabulary: (persona.style.forbiddenVocabulary ?? []).join(", "),
      preferredVocabulary: (persona.style.preferredVocabulary ?? []).join(", "),
      commonExpressions: (persona.style.commonExpressions ?? []).join(" | "),
    });
  }, [persona?.id]);

  if (!persona) return null;

  function splitList(value: string, separator = ","): string[] {
    return value
      .split(separator)
      .map((v) => v.trim())
      .filter(Boolean);
  }

  async function handleSave() {
    await updatePersona.mutateAsync({
      id: personaId,
      input: {
        displayName: form.displayName,
        description: form.description,
        personaPrompt: form.personaPrompt,
        tone: form.tone,
        language: form.language,
        emojiLevel: form.emojiLevel,
        hashtagLevel: form.hashtagLevel,
        style: {
          personality: form.personality,
          communicationStyle: form.communicationStyle,
          forbiddenVocabulary: splitList(form.forbiddenVocabulary),
          preferredVocabulary: splitList(form.preferredVocabulary),
          commonExpressions: splitList(form.commonExpressions, "|"),
        },
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted-foreground)]">
        Esta informacion solo cambia cuando vos la editas aca. La IA nunca la
        reescribe por su cuenta.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="displayName">Nombre visible</Label>
          <Input
            id="displayName"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="language">Idioma</Label>
          <Input
            id="language"
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            placeholder="es"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Descripcion</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="personaPrompt">Identidad</Label>
        <Textarea
          id="personaPrompt"
          value={form.personaPrompt}
          onChange={(e) => setForm({ ...form, personaPrompt: e.target.value })}
          placeholder="Quien es, como piensa, de que habla y como se dirige a su audiencia."
          className="min-h-28"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tone">Tono</Label>
          <Input
            id="tone"
            value={form.tone}
            onChange={(e) => setForm({ ...form, tone: e.target.value })}
            placeholder="Relajado, cercano, con humor seco"
          />
        </div>
        <div>
          <Label htmlFor="personality">Personalidad</Label>
          <Input
            id="personality"
            value={form.personality}
            onChange={(e) => setForm({ ...form, personality: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="emojiLevel">Uso de emojis</Label>
          <Select
            id="emojiLevel"
            value={form.emojiLevel}
            onChange={(e) =>
              setForm({ ...form, emojiLevel: e.target.value as EmojiLevel })
            }
          >
            <option value="none">Ninguno</option>
            <option value="low">Bajo</option>
            <option value="medium">Medio</option>
            <option value="high">Alto</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="hashtagLevel">Uso de hashtags</Label>
          <Select
            id="hashtagLevel"
            value={form.hashtagLevel}
            onChange={(e) =>
              setForm({ ...form, hashtagLevel: e.target.value as HashtagLevel })
            }
          >
            <option value="none">Ninguno</option>
            <option value="low">Bajo</option>
            <option value="medium">Medio</option>
            <option value="high">Alto</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="communicationStyle">Estilo de comunicacion</Label>
        <Textarea
          id="communicationStyle"
          value={form.communicationStyle}
          onChange={(e) => setForm({ ...form, communicationStyle: e.target.value })}
          className="min-h-16"
        />
      </div>

      <div>
        <Label htmlFor="preferredVocabulary">
          Vocabulario preferido (separado por comas)
        </Label>
        <Input
          id="preferredVocabulary"
          value={form.preferredVocabulary}
          onChange={(e) => setForm({ ...form, preferredVocabulary: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="forbiddenVocabulary">
          Vocabulario prohibido (separado por comas)
        </Label>
        <Input
          id="forbiddenVocabulary"
          value={form.forbiddenVocabulary}
          onChange={(e) => setForm({ ...form, forbiddenVocabulary: e.target.value })}
          placeholder="blessed, bendecida, vibes"
        />
      </div>

      <div>
        <Label htmlFor="commonExpressions">
          Expresiones habituales (separadas por |)
        </Label>
        <Input
          id="commonExpressions"
          value={form.commonExpressions}
          onChange={(e) => setForm({ ...form, commonExpressions: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={updatePersona.isPending}>
          {updatePersona.isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
        {saved ? <Badge variant="success">Guardado</Badge> : null}
      </div>

      <ErrorMessage error={updatePersona.error} />
    </div>
  );
}

function ExamplesTab({ personaId }: { personaId: string }) {
  const { data: examples = [] } = usePersonaExamples(personaId);
  const addExample = useAddExample(personaId);
  const deleteExample = useDeleteExample(personaId);
  const [goodText, setGoodText] = useState("");
  const [badText, setBadText] = useState("");

  const good = examples.filter((e) => e.kind === "good");
  const bad = examples.filter((e) => e.kind === "bad");

  return (
    <div className="space-y-6">
      <p className="text-xs text-[var(--muted-foreground)]">
        La IA usa estos textos como referencia de estilo: que suene asi, y que no
        suene asa.
      </p>

      <section className="space-y-2">
        <Label>Ejemplos que si suenan a ella</Label>
        <div className="flex gap-2">
          <Input
            value={goodText}
            onChange={(e) => setGoodText(e.target.value)}
            placeholder="Hoy toco desaparecer un rato"
            onKeyDown={(e) => {
              if (e.key === "Enter" && goodText.trim()) {
                addExample.mutate({ kind: "good", text: goodText.trim() });
                setGoodText("");
              }
            }}
          />
          <Button
            variant="outline"
            size="icon"
            disabled={!goodText.trim()}
            onClick={() => {
              addExample.mutate({ kind: "good", text: goodText.trim() });
              setGoodText("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ExampleList items={good} onDelete={(id) => deleteExample.mutate(id)} />
      </section>

      <Separator />

      <section className="space-y-2">
        <Label>Ejemplos que NO suenan a ella</Label>
        <div className="flex gap-2">
          <Input
            value={badText}
            onChange={(e) => setBadText(e.target.value)}
            placeholder="Living my best life #Blessed #BeachDay"
            onKeyDown={(e) => {
              if (e.key === "Enter" && badText.trim()) {
                addExample.mutate({ kind: "bad", text: badText.trim() });
                setBadText("");
              }
            }}
          />
          <Button
            variant="outline"
            size="icon"
            disabled={!badText.trim()}
            onClick={() => {
              addExample.mutate({ kind: "bad", text: badText.trim() });
              setBadText("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ExampleList items={bad} onDelete={(id) => deleteExample.mutate(id)} />
      </section>
    </div>
  );
}

function ExampleList({
  items,
  onDelete,
}: {
  items: { id: string; text: string }[];
  onDelete: (id: string) => void;
}) {
  if (!items.length) {
    return (
      <p className="text-xs text-[var(--muted-foreground)]">Todavia no hay ninguno.</p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2"
        >
          <span className="text-sm">{item.text}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function MemoryTab({ personaId }: { personaId: string }) {
  const { data: memories = [] } = usePersonaMemories(personaId);
  const addMemory = useAddMemory(personaId);
  const toggleMemory = useToggleMemory(personaId);
  const deleteMemory = useDeleteMemory(personaId);
  const [text, setText] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted-foreground)]">
        Preferencias que se acumulan con el tiempo. Podes desactivarlas sin
        borrarlas.
      </p>

      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Prefiere captions cortos, maximo un emoji."
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              addMemory.mutate(text.trim());
              setText("");
            }
          }}
        />
        <Button
          variant="outline"
          size="icon"
          disabled={!text.trim()}
          onClick={() => {
            addMemory.mutate(text.trim());
            setText("");
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {memories.length === 0 ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          Todavia no hay preferencias guardadas.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {memories.map((memory) => (
            <li
              key={memory.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2"
            >
              <label className="flex flex-1 items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={memory.active}
                  onChange={(e) =>
                    toggleMemory.mutate({ id: memory.id, active: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <span
                  className={cn(
                    "text-sm",
                    !memory.active && "text-[var(--muted-foreground)] line-through",
                  )}
                >
                  {memory.text}
                </span>
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => deleteMemory.mutate(memory.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlatformsTab({ personaId }: { personaId: string }) {
  const { data: persona } = usePersona(personaId);
  const { data: settings = [] } = usePersonaPlatformSettings(personaId);
  const upsert = useUpsertPlatformSettings(personaId);
  const updatePersona = useUpdatePersona();

  if (!persona) return null;

  function toggleDefault(platform: PlatformId) {
    if (!persona) return;
    const next = persona.defaultPlatforms.includes(platform)
      ? persona.defaultPlatforms.filter((p) => p !== platform)
      : [...persona.defaultPlatforms, platform];
    updatePersona.mutate({ id: personaId, input: { defaultPlatforms: next } });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted-foreground)]">
        Indicaciones extra que solo aplican a esta persona en cada plataforma.
      </p>

      {listPlatformAdapters().map((adapter) => {
        const current = settings.find((s) => s.platform === adapter.id);
        const isDefault = persona.defaultPlatforms.includes(adapter.id);

        return (
          <Card key={adapter.id}>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">{adapter.displayName}</h3>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={() => toggleDefault(adapter.id)}
                    className="h-3.5 w-3.5"
                  />
                  Seleccionada por defecto
                </label>
              </div>

              <Textarea
                defaultValue={current?.guidance ?? ""}
                placeholder={`Como escribe esta persona en ${adapter.displayName}.`}
                className="min-h-16"
                onBlur={(e) =>
                  upsert.mutate({
                    platform: adapter.id,
                    values: {
                      guidance: e.target.value,
                      maxLength: current?.maxLength ?? null,
                      enabled: true,
                    },
                  })
                }
              />

              <p className="text-xs text-[var(--muted-foreground)]">
                Limite de la plataforma:{" "}
                {adapter.maxLength ? `${adapter.maxLength} caracteres` : "sin limite"}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
