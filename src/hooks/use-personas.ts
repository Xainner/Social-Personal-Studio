import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as repo from "@/db/repositories/personas";
import type { PersonaExampleKind, PlatformId } from "@/types/domain";

const KEYS = {
  all: ["personas"] as const,
  detail: (id: string) => ["personas", id] as const,
  examples: (id: string) => ["personas", id, "examples"] as const,
  memories: (id: string) => ["personas", id, "memories"] as const,
  platformSettings: (id: string) => ["personas", id, "platform-settings"] as const,
};

export function usePersonas() {
  return useQuery({ queryKey: KEYS.all, queryFn: repo.listPersonas });
}

export function usePersona(id: string | null) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ""),
    queryFn: () => repo.getPersona(id as string),
    enabled: Boolean(id),
  });
}

export function useCreatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.createPersona,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<repo.PersonaInput> }) =>
      repo.updatePersona(id, input),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function useDeletePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.deletePersona,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

// ---------- Ejemplos ----------

export function usePersonaExamples(personaId: string | null) {
  return useQuery({
    queryKey: KEYS.examples(personaId ?? ""),
    queryFn: () => repo.listExamples(personaId as string),
    enabled: Boolean(personaId),
  });
}

export function useAddExample(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, text }: { kind: PersonaExampleKind; text: string }) =>
      repo.addExample(personaId, kind, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.examples(personaId) }),
  });
}

export function useDeleteExample(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.deleteExample,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.examples(personaId) }),
  });
}

// ---------- Style Memory ----------

export function usePersonaMemories(personaId: string | null) {
  return useQuery({
    queryKey: KEYS.memories(personaId ?? ""),
    queryFn: () => repo.listMemories(personaId as string),
    enabled: Boolean(personaId),
  });
}

export function useAddMemory(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => repo.addMemory(personaId, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.memories(personaId) }),
  });
}

export function useToggleMemory(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      repo.setMemoryActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.memories(personaId) }),
  });
}

export function useDeleteMemory(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.deleteMemory,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.memories(personaId) }),
  });
}

// ---------- Ajustes por plataforma ----------

export function usePersonaPlatformSettings(personaId: string | null) {
  return useQuery({
    queryKey: KEYS.platformSettings(personaId ?? ""),
    queryFn: () => repo.listPlatformSettings(personaId as string),
    enabled: Boolean(personaId),
  });
}

export function useUpsertPlatformSettings(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      platform,
      values,
    }: {
      platform: PlatformId;
      values: { guidance: string; maxLength: number | null; enabled: boolean };
    }) => repo.upsertPlatformSettings(personaId, platform, values),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: KEYS.platformSettings(personaId) }),
  });
}
