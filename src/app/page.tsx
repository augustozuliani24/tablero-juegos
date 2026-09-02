"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { usePlayer } from "@/contexts/player-context";
import type { Game } from "@/lib/database.types";

export default function HomePage() {
  const { player } = usePlayer();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newGame, setNewGame] = useState("");
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
    const { error } = await supabase.from("games").insert({ name, created_by: player.id });
    if (!error) {
      setNewGame("");
      setShowModal(false);
      await loadGames();
    }
    setAdding(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Juegos</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
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
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/games/${game.id}`}
              className="flex aspect-square flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white p-4 text-center text-lg font-semibold shadow-sm hover:border-neutral-400 hover:shadow transition"
            >
              {game.name}
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
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5"
          >
            <h2 className="text-lg font-semibold">Nuevo juego</h2>
            <input
              autoFocus
              value={newGame}
              onChange={(e) => setNewGame(e.target.value)}
              placeholder="Nombre del juego"
              className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base outline-none focus:border-neutral-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={adding || !newGame.trim()}
                className="flex-1 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
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
