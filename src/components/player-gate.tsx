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
          className="w-full max-w-sm space-y-4"
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
            <h1 className="text-2xl font-semibold">¿Quién sos?</h1>
            <p className="text-sm text-neutral-500">Escribí tu nombre para entrar</p>
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-center text-lg outline-none focus:border-neutral-500"
          />
          {error && <p className="text-center text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-white disabled:opacity-40"
          >
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
