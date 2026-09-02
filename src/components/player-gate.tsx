"use client";

import { useState, ReactNode } from "react";
import { usePlayer } from "@/contexts/player-context";

export function PlayerGate({ children }: { children: ReactNode }) {
  const { player, loading, selectPlayer } = usePlayer();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">Cargando...</div>;
  }

  if (!player) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <form
          className="animate-pop-in w-full max-w-sm space-y-5 rounded-3xl bg-white p-8 shadow-xl shadow-primary/10"
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
          <div className="text-center space-y-1">
            <div className="text-5xl">🎲</div>
            <h1 className="text-2xl font-bold text-primary-dark">¿Quién sos?</h1>
            <p className="text-sm text-neutral-500">Escribí tu nombre para entrar</p>
          </div>
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
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
