"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Game, Player } from "@/lib/database.types";

const SESSION_KEY = "tablero.isAdmin";
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "";

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") setUnlocked(true);
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: playersData }, { data: gamesData }] = await Promise.all([
      supabase.from("players").select("*").order("name"),
      supabase.from("games").select("*").order("name"),
    ]);
    setPlayers(playersData ?? []);
    setGames(gamesData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (unlocked) loadData();
  }, [unlocked]);

  function tryUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!ADMIN_PASSWORD) {
      setError("No hay contraseña de admin configurada (NEXT_PUBLIC_ADMIN_PASSWORD).");
      return;
    }
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
    } else {
      setError("Contraseña incorrecta.");
    }
  }

  async function deletePlayer(p: Player) {
    if (!confirm(`¿Borrar a "${p.name}"? Esto lo saca de todas las partidas donde jugó.`)) return;
    setBusyId(p.id);
    await supabase.from("players").delete().eq("id", p.id);
    await loadData();
    setBusyId(null);
  }

  async function deleteGame(g: Game) {
    if (!confirm(`¿Borrar "${g.name}"? Esto borra también todas sus partidas cargadas.`)) return;
    setBusyId(g.id);
    await supabase.from("games").delete().eq("id", g.id);
    await loadData();
    setBusyId(null);
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <form onSubmit={tryUnlock} className="animate-pop-in w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lg">
          <div className="text-center space-y-1">
            <div className="text-4xl">🔒</div>
            <h1 className="text-xl font-bold text-primary-dark">Panel de administrador</h1>
          </div>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full rounded-xl border-2 border-primary/20 px-4 py-3 text-center outline-none focus:border-primary"
          />
          {error && <p className="text-center text-sm text-pink">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-primary to-pink px-4 py-2.5 font-semibold text-white"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-primary-dark">⚙️ Administrador</h1>

      {loading ? (
        <p className="text-sm text-neutral-500">Cargando...</p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-500">Juegos</h2>
            <div className="space-y-2">
              {games.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-xl border-2 border-primary/10 bg-white px-4 py-2.5">
                  <span className="font-medium">{g.name}</span>
                  <button
                    onClick={() => deleteGame(g)}
                    disabled={busyId === g.id}
                    className="text-sm font-medium text-pink hover:underline disabled:opacity-40"
                  >
                    Borrar
                  </button>
                </div>
              ))}
              {games.length === 0 && <p className="text-sm text-neutral-400">No hay juegos cargados.</p>}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-500">Jugadores</h2>
            <div className="space-y-2">
              {players.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border-2 border-primary/10 bg-white px-4 py-2.5">
                  <span className="font-medium">{p.name}</span>
                  <button
                    onClick={() => deletePlayer(p)}
                    disabled={busyId === p.id}
                    className="text-sm font-medium text-pink hover:underline disabled:opacity-40"
                  >
                    Borrar
                  </button>
                </div>
              ))}
              {players.length === 0 && <p className="text-sm text-neutral-400">No hay jugadores cargados.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
