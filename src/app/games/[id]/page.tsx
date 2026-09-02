"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LogSessionForm } from "@/components/log-session-form";
import type { Game, PlayerGameStats } from "@/lib/database.types";

type SessionRow = {
  id: string;
  played_at: string;
  duration_minutes: number | null;
  teams: {
    id: string;
    label: string | null;
    points: number;
    is_winner: boolean;
    members: string[];
  }[];
};

function spotifySearchUrl(gameName: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${gameName} playlist para jugar`)}`;
}

export default function GameDetailPage() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;

  const [game, setGame] = useState<Game | null>(null);
  const [stats, setStats] = useState<PlayerGameStats[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [{ data: gameData }, { data: statsData }, { data: sessionsData }] = await Promise.all([
      supabase.from("games").select("*").eq("id", gameId).single(),
      supabase.from("player_game_stats").select("*").eq("game_id", gameId).order("wins", { ascending: false }),
      supabase
        .from("sessions")
        .select("id, played_at, duration_minutes, teams(id, label, scores(points, is_winner), team_members(players(name)))")
        .eq("game_id", gameId)
        .order("played_at", { ascending: false }),
    ]);

    setGame(gameData ?? null);
    setStats(statsData ?? []);

    setSessions(
      (sessionsData ?? []).map((s: any) => ({
        id: s.id,
        played_at: s.played_at,
        duration_minutes: s.duration_minutes,
        teams: (s.teams ?? []).map((t: any) => ({
          id: t.id,
          label: t.label,
          points: t.scores?.points ?? 0,
          is_winner: t.scores?.is_winner ?? false,
          members: (t.team_members ?? []).map((tm: any) => tm.players?.name).filter(Boolean),
        })),
      }))
    );
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) return <p className="text-sm text-neutral-500">Cargando...</p>;
  if (!game) return <p className="text-sm text-neutral-500">Juego no encontrado.</p>;

  return (
    <div className="space-y-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-primary transition-colors">
        ← Volver a juegos
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary-dark">{game.name}</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 rounded-xl bg-gradient-to-r from-primary to-pink px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/30 transition active:scale-95"
        >
          {showForm ? "Cancelar" : "Cargar partida"}
        </button>
      </div>

      <a
        href={spotifySearchUrl(game.name)}
        target="_blank"
        rel="noopener noreferrer"
        className="hover-wiggle flex items-center gap-3 rounded-2xl bg-[#1db954] px-4 py-3 text-white shadow-md shadow-[#1db954]/30 transition active:scale-95"
      >
        <span className="text-2xl">🎧</span>
        <span className="font-semibold">Buscar playlists en Spotify para {game.name}</span>
      </a>

      {showForm && (
        <LogSessionForm
          gameId={gameId}
          mode={game.mode}
          onLogged={() => {
            setShowForm(false);
            loadAll();
          }}
        />
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">Tabla del juego</h2>
        {stats.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no hay partidas registradas.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border-2 border-primary/10 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-primary/5 text-left text-primary-dark">
                <tr>
                  <th className="px-4 py-2 font-semibold">Jugador</th>
                  <th className="px-4 py-2 font-semibold text-right">Partidas</th>
                  <th className="px-4 py-2 font-semibold text-right">Victorias</th>
                  <th className="px-4 py-2 font-semibold text-right">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.player_id} className="border-t border-neutral-100">
                    <td className="px-4 py-2 font-medium">{s.player_name}</td>
                    <td className="px-4 py-2 text-right">{s.sessions_played}</td>
                    <td className="px-4 py-2 text-right">{s.wins}</td>
                    <td className="px-4 py-2 text-right">{s.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">Historial</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin partidas todavía.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="rounded-2xl border-2 border-primary/10 bg-white p-3 text-sm">
                <div className="mb-2 flex justify-between text-neutral-400">
                  <span>{new Date(s.played_at).toLocaleString("es-AR")}</span>
                  {s.duration_minutes && <span>{s.duration_minutes} min</span>}
                </div>
                <div className="space-y-1">
                  {s.teams.map((t) => (
                    <div key={t.id} className="flex justify-between">
                      <span className={t.is_winner ? "font-semibold text-primary-dark" : ""}>
                        {t.is_winner ? "🏆 " : ""}
                        {t.members.join(", ")}
                      </span>
                      <span className="text-neutral-500">{t.points} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
