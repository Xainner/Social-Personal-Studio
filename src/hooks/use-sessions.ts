import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as repo from "@/db/repositories/sessions";
import type { Session } from "@/types/domain";

const KEYS = {
  byPersona: (personaId: string) => ["sessions", personaId] as const,
  detail: (id: string) => ["session", id] as const,
};

export function useSessions(personaId: string | null) {
  return useQuery({
    queryKey: KEYS.byPersona(personaId ?? ""),
    queryFn: () => repo.listSessions(personaId as string),
    enabled: Boolean(personaId),
  });
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ""),
    queryFn: () => repo.getSession(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateSession(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, context }: { name: string; context?: string }) =>
      repo.createSession(personaId, name, context),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.byPersona(personaId) }),
  });
}

export function useUpdateSession(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Partial<Pick<Session, "name" | "context" | "notes">>;
    }) => repo.updateSession(id, values),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.byPersona(personaId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function useDeleteSession(personaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.deleteSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.byPersona(personaId) }),
  });
}
