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
      await loadGames();
    }
    setAdding(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-4">Juegos</h1>
        {loading ? (
          <p className="text-sm text-neutral-500">Cargando...</p>
        ) : games.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no hay juegos cargados. Agregá el primero abajo.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/games/${game.id}`}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center font-medium hover:border-neutral-400 transition"
              >
                {game.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={addGame} className="flex gap-2">
        <input
          value={newGame}
          onChange={(e) => setNewGame(e.target.value)}
          placeholder="Nombre de un juego nuevo"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          disabled={adding || !newGame.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-40"
        >
          Agregar
        </button>
      </form>
    </div>
  );
}
