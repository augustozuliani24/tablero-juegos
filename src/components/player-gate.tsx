"use client";

import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayer } from "@/contexts/player-context";
import type { Player } from "@/lib/database.types";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function PlayerGate({ children }: { children: ReactNode }) {
  const { player, loading, selectPlayer, loginAs } = usePlayer();
  const [existingPlayers, setExistingPlayers] = useState<Player[] | null>(null);
  const [mode, setMode] = useState<"landing" | "pick" | "new">("landing");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (player || loading) return;
    supabase
      .from("players")
      .select("*")
      .then(({ data }) => {
        const sorted = [...(data ?? [])].sort((a, b) =>
          firstName(a.name).localeCompare(firstName(b.name), "es", { sensitivity: "base" })
        );
        setExistingPlayers(sorted);
        if (sorted.length === 0) setMode("new");
      });
  }, [player, loading]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">Cargando...</div>;
  }

  if (!player) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="animate-pop-in w-full max-w-sm space-y-5 rounded-3xl bg-white p-8 shadow-xl shadow-primary/10">
          <div className="text-center space-y-1">
            <div className="text-5xl">🎲</div>
            <h1 className="text-2xl font-bold text-primary-dark">
              {mode === "landing" ? "¡Bienvenido!" : mode === "pick" ? "¿Quién juega?" : "¿Quién sos?"}
            </h1>
            <p className="text-sm text-neutral-500">
              {mode === "landing"
                ? "Iniciá para elegir tu perfil"
                : mode === "pick"
                  ? "Tocá tu perfil para entrar"
                  : "Escribí tu nombre para entrar"}
            </p>
          </div>

          {mode === "landing" && (
            <div className="space-y-2">
              <button
                onClick={() => setMode("pick")}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-pink px-4 py-3 font-semibold text-white shadow-lg shadow-primary/30 transition active:scale-95"
              >
                Iniciar
              </button>
              <button
                onClick={() => setMode("new")}
                className="w-full rounded-xl border-2 border-dashed border-neutral-300 py-2.5 text-sm font-medium text-neutral-500 hover:border-primary hover:text-primary transition-colors"
              >
                + Soy nuevo
              </button>
            </div>
          )}

          {mode === "pick" &&
            (existingPlayers === null ? (
              <p className="text-center text-sm text-neutral-400">Cargando perfiles...</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {existingPlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => loginAs(p)}
                      className="rounded-xl border-2 border-primary/15 bg-primary/5 px-3 py-3 text-center font-medium text-primary-dark transition hover:border-primary hover:bg-primary/10 active:scale-95"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setMode("landing")}
                  className="w-full text-center text-sm text-neutral-400 hover:text-primary transition-colors"
                >
                  ← Volver
                </button>
              </>
            ))}

          {mode === "new" && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setSubmitting(true);
                try {
                  await selectPlayer(name);
                } catch {
                  setError("No se pudo cargar el perfil. Probá de nuevo.");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-center text-lg outline-none focus:border-primary transition-colors"
              />
              {error && <p className="text-center text-sm text-pink">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-pink px-4 py-3 font-semibold text-white shadow-lg shadow-primary/30 transition active:scale-95 disabled:opacity-40 disabled:active:scale-100"
              >
                {submitting ? "Entrando..." : "¡Entrar a jugar!"}
              </button>
              <button
                type="button"
                onClick={() => setMode(existingPlayers && existingPlayers.length > 0 ? "pick" : "landing")}
                className="w-full text-center text-sm text-neutral-400 hover:text-primary transition-colors"
              >
                ← Volver
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
