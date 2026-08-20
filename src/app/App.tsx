import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { failStaleRequests } from "@/db/repositories/generations";
import { useAppStore } from "@/stores/app-store";
import { AppLayout } from "@/app/layout/app-layout";
import { ComposerView } from "@/features/composer/composer-view";
import { PersonaEditorView } from "@/features/personas/persona-editor-view";
import { SavedPostsView } from "@/features/saved-posts/saved-posts-view";
import { MediaView } from "@/features/media/media-view";
import { SettingsView } from "@/features/settings/settings-view";
import { ErrorMessage } from "@/components/error-message";
import { Spinner } from "@/components/ui/primitives";

export function App() {
  const loadSettingsFromDb = useAppStore((s) => s.loadSettingsFromDb);
  const settingsLoaded = useAppStore((s) => s.settingsLoaded);
  const [bootError, setBootError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        await loadSettingsFromDb();
        // Si la app se cerró a mitad de una generación, ese registro quedaría
        // colgado en "generating" para siempre. Lo cerramos al arrancar.
        await failStaleRequests();
      } catch (error) {
        if (!cancelled) setBootError(error);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadSettingsFromDb]);

  if (bootError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md space-y-3">
          <h1 className="text-lg font-semibold">No se pudo iniciar la aplicacion</h1>
          <ErrorMessage error={bootError} />
        </div>
      </div>
    );
  }

  if (!settingsLoaded) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-sm text-[var(--muted-foreground)]">
        <Spinner />
        Cargando...
      </div>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/composer" replace />} />
        <Route path="/composer" element={<ComposerView />} />
        <Route path="/persona/:personaId" element={<PersonaEditorView />} />
        <Route path="/posts" element={<SavedPostsView />} />
        <Route path="/media" element={<MediaView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<Navigate to="/composer" replace />} />
      </Routes>
    </AppLayout>
  );
}
