import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Images,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  UserRound,
} from "lucide-react";
import { usePersonas } from "@/hooks/use-personas";
import { useSessions } from "@/hooks/use-sessions";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Separator, Spinner, SectionHeader } from "@/components/ui/primitives";
import { NewPersonaDialog } from "@/features/personas/new-persona-dialog";
import { NewSessionDialog } from "@/features/sessions/new-session-dialog";
import { cn } from "@/utils/cn";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/composer", label: "Crear", icon: Sparkles },
  { to: "/posts", label: "Publicaciones", icon: Bookmark },
  { to: "/media", label: "Imágenes", icon: Images },
  { to: "/settings", label: "Ajustes", icon: SettingsIcon },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { data: personas = [], isLoading } = usePersonas();
  const activePersonaId = useAppStore((s) => s.activePersonaId);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const setActivePersona = useAppStore((s) => s.setActivePersona);
  const setActiveSession = useAppStore((s) => s.setActiveSession);

  const { data: sessions = [] } = useSessions(activePersonaId);
  const [personaDialogOpen, setPersonaDialogOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);

  return (
    <div className="relative z-10 flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-xl">
        {/* Marca */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[oklch(0.45_0.24_292)] shadow-[var(--shadow-glow)]">
            <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight">
              Social Persona Studio
            </h1>
            <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
              Estudio de contenidos
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Personas */}
          <section className="px-3 py-3">
            <SectionHeader
              label="Personas"
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setPersonaDialogOpen(true)}
                  aria-label="Nueva persona"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              }
            />

            {isLoading ? (
              <div className="px-2 py-2 text-xs text-[var(--muted-foreground)]">
                <Spinner className="h-3 w-3" />
              </div>
            ) : personas.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-[var(--muted-foreground)]">
                Todavía no hay ninguna.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {personas.map((persona) => (
                  <li key={persona.id}>
                    <button
                      onClick={() => {
                        setActivePersona(persona.id);
                        navigate("/composer");
                      }}
                      className={cn(
                        "group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-all duration-150",
                        persona.id === activePersonaId
                          ? "bg-[var(--primary)]/12 font-medium text-[var(--card-foreground)] shadow-[inset_0_0_0_1px_var(--primary)/25]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--card-foreground)]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] transition-colors",
                          persona.id === activePersonaId &&
                            "border-[var(--primary)]/30 bg-[var(--primary)]/15 text-[var(--primary)]",
                        )}
                      >
                        <UserRound className="h-3 w-3" />
                      </span>
                      <span className="truncate">
                        {persona.displayName || persona.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {activePersonaId ? (
            <>
              <Separator />
              <section className="px-3 py-3">
                <SectionHeader
                  label="Sesiones"
                  action={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setSessionDialogOpen(true)}
                      aria-label="Nueva sesión"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  }
                />

                {sessions.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-[var(--muted-foreground)]">
                    Crea una sesión para empezar.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {sessions.map((session) => (
                      <li key={session.id}>
                        <button
                          onClick={() => {
                            setActiveSession(session.id);
                            navigate("/composer");
                          }}
                          className={cn(
                            "w-full cursor-pointer truncate rounded-lg px-2 py-1.5 text-left text-sm transition-all duration-150",
                            session.id === activeSessionId
                              ? "bg-[var(--primary)]/12 font-medium text-[var(--card-foreground)] shadow-[inset_0_0_0_1px_var(--primary)/25]"
                              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--card-foreground)]",
                          )}
                        >
                          {session.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full justify-start text-xs text-[var(--muted-foreground)]"
                  onClick={() => navigate(`/persona/${activePersonaId}`)}
                >
                  Editar persona
                </Button>
              </section>
            </>
          ) : null}
        </div>

        <Separator />

        {/* Navegación principal */}
        <nav className="p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "group mb-1 flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-gradient-to-r from-[var(--primary)]/15 to-transparent text-[var(--card-foreground)] shadow-[inset_2px_0_0_var(--primary)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--card-foreground)]",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg border border-transparent transition-colors",
                      isActive
                        ? "border-[var(--primary)]/30 bg-[var(--primary)]/15 text-[var(--primary)]"
                        : "group-hover:border-[var(--border)] group-hover:bg-[var(--surface-2)]",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-y-auto">{children}</main>

      <NewPersonaDialog
        open={personaDialogOpen}
        onClose={() => setPersonaDialogOpen(false)}
      />
      {activePersonaId ? (
        <NewSessionDialog
          open={sessionDialogOpen}
          personaId={activePersonaId}
          onClose={() => setSessionDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}