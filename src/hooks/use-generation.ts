import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  generatePosts,
  rewriteVariant,
  type GenerateInput,
  type GenerationStage,
  type RewriteInput,
} from "@/ai/generation/engine";
import { getGenerationByRequest } from "@/db/repositories/generations";
import type { GenerationOption } from "@/types/domain";
import { toAppError } from "@/types/errors";

const STAGE_LABELS: Record<GenerationStage, string> = {
  preparing: "Preparando contexto...",
  analyzing_images: "Analizando imagenes...",
  generating: "Generando opciones...",
  validating: "Validando resultado...",
  repairing: "Corrigiendo el formato...",
  saving: "Guardando...",
};

export function useGeneration() {
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [stage, setStage] = useState<GenerationStage | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [options, setOptions] = useState<GenerationOption[]>([]);
  const [requestId, setRequestId] = useState<string | null>(null);

  const run = useCallback(
    async (input: Omit<GenerateInput, "signal" | "onProgress">) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setError(null);
      setWarnings([]);
      setStage("preparing");

      try {
        const result = await generatePosts({
          ...input,
          signal: controller.signal,
          onProgress: setStage,
        });

        const stored = await getGenerationByRequest(result.requestId);
        setOptions(stored?.options ?? []);
        setRequestId(result.requestId);
        setWarnings(result.warnings);

        qc.invalidateQueries({ queryKey: ["sessions"] });
      } catch (err) {
        setError(toAppError(err));
        setOptions([]);
      } finally {
        setIsGenerating(false);
        setStage(null);
        abortRef.current = null;
      }
    },
    [qc],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort("cancelado por el usuario");
  }, []);

  /** Recarga las opciones desde la base tras editar o regenerar una variante. */
  const refresh = useCallback(async () => {
    if (!requestId) return;
    const stored = await getGenerationByRequest(requestId);
    setOptions(stored?.options ?? []);
  }, [requestId]);

  const reset = useCallback(() => {
    setOptions([]);
    setRequestId(null);
    setWarnings([]);
    setError(null);
  }, []);

  return {
    run,
    cancel,
    refresh,
    reset,
    isGenerating,
    stage,
    stageLabel: stage ? STAGE_LABELS[stage] : null,
    error,
    warnings,
    options,
    requestId,
  };
}

export function useRewrite() {
  const [isRewriting, setIsRewriting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const rewrite = useCallback(async (input: RewriteInput): Promise<string | null> => {
    setIsRewriting(true);
    setError(null);
    try {
      return await rewriteVariant(input);
    } catch (err) {
      setError(toAppError(err));
      return null;
    } finally {
      setIsRewriting(false);
    }
  }, []);

  return { rewrite, isRewriting, error };
}
