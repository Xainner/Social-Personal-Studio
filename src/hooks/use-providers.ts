import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProviderClient } from "@/ai/providers/factory";
import * as repo from "@/db/repositories/providers";
import type { ModelRole } from "@/types/domain";

const KEYS = {
  providers: ["providers"] as const,
  models: (providerId?: string) => ["models", providerId ?? "all"] as const,
};

export function useProviders() {
  return useQuery({ queryKey: KEYS.providers, queryFn: repo.listProviders });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.createProvider,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.providers }),
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<repo.ProviderInput> }) =>
      repo.updateProvider(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.providers }),
  });
}

export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.deleteProvider,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.providers });
      qc.invalidateQueries({ queryKey: KEYS.models() });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (providerId: string) => {
      const client = await createProviderClient(providerId);
      return client.testConnection();
    },
  });
}

export function useModels(providerId?: string) {
  return useQuery({
    queryKey: KEYS.models(providerId),
    queryFn: () => repo.listModels(providerId),
  });
}

export function useAddModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      providerId,
      modelName,
      role,
      isDefault,
    }: {
      providerId: string;
      modelName: string;
      role: ModelRole;
      isDefault?: boolean;
    }) => repo.addModel(providerId, modelName, role, isDefault),
    onSuccess: (model) => {
      qc.invalidateQueries({ queryKey: KEYS.models(model.providerId) });
      qc.invalidateQueries({ queryKey: KEYS.models() });
    },
  });
}

export function useDeleteModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.deleteModel,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.models() }),
  });
}
