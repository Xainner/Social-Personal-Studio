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
import { Separator, Spinner } from "@/components/ui/primitives";
import { NewPersonaDialog } from "@/features/personas/new-persona-dialog";
import { NewSessionDialog } from "@/features/sessions/new-session-dialog";
import { cn } from "@/utils/cn";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/composer", label: "Crear", icon: Sparkles },
  { to: "/posts", label: "Publicaciones", icon: Bookmark },
  { to: "/media", label: "Imagenes", icon: Images },
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
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)]">
        <div className="px-4 py-4">
          <h1 className="text-sm font-semibold tracking-tight">
            Social Persona Studio
          </h1>
        </div>

        <Separator />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
                Todavia no hay ninguna.
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
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        persona.id === activePersonaId
                          ? "bg-[var(--accent)] font-medium text-[var(--accent-foreground)]"
                          : "hover:bg-[var(--accent)]/60",
                      )}
                    >
                      <UserRound className="h-3.5 w-3.5 shrink-0 opacity-70" />
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
                      aria-label="Nueva sesion"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  }
                />

                {sessions.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-[var(--muted-foreground)]">
                    Crea una sesion para empezar.
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
                            "w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                            session.id === activeSessionId
                              ? "bg-[var(--accent)] font-medium text-[var(--accent-foreground)]"
                              : "hover:bg-[var(--accent)]/60",
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

        <nav className="p-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-[var(--accent)] font-medium text-[var(--accent-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]/60",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>

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

function SectionHeader({
  label,
  action,
}: {
  label: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between px-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </span>
      {action}
    </div>
  );
}
