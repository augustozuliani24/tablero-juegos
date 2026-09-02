"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { usePlayer } from "@/contexts/player-context";
import type { Game, GameMode } from "@/lib/database.types";

const TILE_STYLES = [
  "border-primary/30 hover:border-primary",
  "border-accent/30 hover:border-accent",
  "border-pink/30 hover:border-pink",
  "border-teal/30 hover:border-teal",
];

export default function HomePage() {
  const { player } = usePlayer();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newGame, setNewGame] = useState("");
  const [newMode, setNewMode] = useState<GameMode>("ffa");
  const [adding, setAdding] = useState(false);

  async function loadGames() {
    const { data } = await supabase.from("games").select("*").order("name");
    setGames(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadGames();
  }, []);

  async function addGame(e: React.FormEvent) {
    e.preventDefault();
    const name = newGame.trim();
    if (!name || !player) return;
    setAdding(true);
    const { error } = await supabase.from("games").insert({ name, mode: newMode, created_by: player.id });
    if (!error) {
      setNewGame("");
      setNewMode("ffa");
      setShowModal(false);
      await loadGames();
    }
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary-dark">🎲 Juegos</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-gradient-to-r from-primary to-pink px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 transition active:scale-95"
        >
          + Agregar juego
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Cargando...</p>
      ) : games.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía no hay juegos cargados. Agregá el primero.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {games.map((game, i) => (
            <Link
              key={game.id}
              href={`/games/${game.id}`}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`animate-pop-in hover-wiggle flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-4 bg-white p-4 text-center text-lg font-bold text-neutral-800 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${TILE_STYLES[i % TILE_STYLES.length]}`}
            >
              <span>{game.name}</span>
              <span className="text-xs font-medium text-neutral-400">
                {game.mode === "teams" ? "👥 Equipos" : "🙋 Todos contra todos"}
              </span>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0"
          onClick={() => setShowModal(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={addGame}
            className="animate-pop-in w-full max-w-sm space-y-4 rounded-2xl bg-white p-5"
          >
            <h2 className="text-lg font-bold text-primary-dark">Nuevo juego</h2>
            <input
              autoFocus
              value={newGame}
              onChange={(e) => setNewGame(e.target.value)}
              placeholder="Nombre del juego"
              className="w-full rounded-xl border-2 border-primary/20 px-3 py-3 text-base outline-none focus:border-primary transition-colors"
            />

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-600">¿Cómo se juega normalmente?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewMode("ffa")}
                  className={`rounded-xl border-2 px-3 py-2 text-sm font-medium transition ${
                    newMode === "ffa" ? "border-primary bg-primary/10 text-primary-dark" : "border-neutral-200 text-neutral-500"
                  }`}
                >
                  🙋 Todos contra todos
                </button>
                <button
                  type="button"
                  onClick={() => setNewMode("teams")}
                  className={`rounded-xl border-2 px-3 py-2 text-sm font-medium transition ${
                    newMode === "teams" ? "border-primary bg-primary/10 text-primary-dark" : "border-neutral-200 text-neutral-500"
                  }`}
                >
                  👥 Equipos
                </button>
              </div>
              <p className="mt-1 text-xs text-neutral-400">Lo podés cambiar después desde Admin.</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={adding || !newGame.trim()}
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-pink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {adding ? "Agregando..." : "Agregar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
