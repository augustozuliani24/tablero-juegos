"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayer } from "@/contexts/player-context";

type PlayResult = {
  playedAt: string;
  gameId: string;
  gameName: string;
  points: number;
  isWinner: boolean;
};

type GameBreakdown = {
  gameId: string;
  gameName: string;
  sessions: number;
  wins: number;
  points: number;
  winRate: number;
};

function computeStreak(resultsAsc: PlayResult[]) {
  if (resultsAsc.length === 0) return null;
  const last = resultsAsc[resultsAsc.length - 1].isWinner;
  let count = 0;
  for (let i = resultsAsc.length - 1; i >= 0; i--) {
    if (resultsAsc[i].isWinner === last) count++;
    else break;
  }
  return { isWinner: last, count };
}

function longestWinStreak(resultsAsc: PlayResult[]) {
  let best = 0;
  let current = 0;
  for (const r of resultsAsc) {
    if (r.isWinner) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

export default function ProfilePage() {
  const { player } = usePlayer();
  const [results, setResults] = useState<PlayResult[] | null>(null);

  useEffect(() => {
    if (!player) return;
    supabase
      .from("team_members")
      .select("teams(session_id, sessions(played_at, games(id, name)), scores(points, is_winner))")
      .eq("player_id", player.id)
      .then(({ data }) => {
        const flat: PlayResult[] = (data ?? [])
          .map((row: any) => {
            const team = row.teams;
            const session = team?.sessions;
            const game = session?.games;
            const score = team?.scores;
            if (!session || !game || !score) return null;
            return {
              playedAt: session.played_at,
              gameId: game.id,
              gameName: game.name,
              points: score.points ?? 0,
              isWinner: Boolean(score.is_winner),
            };
          })
          .filter((x: PlayResult | null): x is PlayResult => x !== null)
          .sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());
        setResults(flat);
      });
  }, [player]);

  if (!player) return null;
  if (results === null) return <p className="text-sm text-neutral-500">Cargando...</p>;

  if (results.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-primary-dark">📊 Mi perfil</h1>
        <p className="text-sm text-neutral-500">
          Todavía no jugaste ninguna partida, {player.name}. ¡Cargá una desde un juego!
        </p>
      </div>
    );
  }

  const totalGames = results.length;
  const totalWins = results.filter((r) => r.isWinner).length;
  const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
  const winRate = Math.round((totalWins / totalGames) * 100);

  const byGame = new Map<string, GameBreakdown>();
  for (const r of results) {
    const g = byGame.get(r.gameId) ?? { gameId: r.gameId, gameName: r.gameName, sessions: 0, wins: 0, points: 0, winRate: 0 };
    g.sessions += 1;
    g.wins += r.isWinner ? 1 : 0;
    g.points += r.points;
    byGame.set(r.gameId, g);
  }
  const gameBreakdown = Array.from(byGame.values())
    .map((g) => ({ ...g, winRate: Math.round((g.wins / g.sessions) * 100) }))
    .sort((a, b) => b.sessions - a.sessions);

  const bestGame = [...gameBreakdown].sort((a, b) => b.winRate - a.winRate || b.sessions - a.sessions)[0];
  const worstGame = [...gameBreakdown].sort((a, b) => a.winRate - b.winRate || b.sessions - a.sessions)[0];

  const streak = computeStreak(results);
  const bestStreak = longestWinStreak(results);
  const recentResults = [...results].slice(-10).reverse();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">📊 Mi perfil</h1>
        <p className="text-sm text-neutral-500">Estadísticas de {player.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Partidas jugadas" value={totalGames} />
        <StatCard label="Victorias" value={totalWins} sub={`${winRate}%`} />
        <StatCard label="Puntos totales" value={totalPoints} />
        <StatCard
          label="Racha actual"
          value={streak ? streak.count : 0}
          sub={streak ? (streak.isWinner ? "🏆 ganando" : "sin ganar") : ""}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {bestGame && (
          <div className="rounded-2xl border-2 border-teal/20 bg-teal/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">Mejor juego</p>
            <p className="text-lg font-bold text-neutral-800">{bestGame.gameName}</p>
            <p className="text-sm text-neutral-500">
              {bestGame.winRate}% de victorias ({bestGame.wins}/{bestGame.sessions})
            </p>
          </div>
        )}
        {worstGame && (
          <div className="rounded-2xl border-2 border-pink/20 bg-pink/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-pink">Juego para mejorar</p>
            <p className="text-lg font-bold text-neutral-800">{worstGame.gameName}</p>
            <p className="text-sm text-neutral-500">
              {worstGame.winRate}% de victorias ({worstGame.wins}/{worstGame.sessions})
            </p>
          </div>
        )}
      </div>

      {bestStreak > 1 && (
        <p className="text-sm text-neutral-500">
          🔥 Tu racha ganadora más larga fue de <span className="font-semibold text-primary-dark">{bestStreak}</span> partidas seguidas.
        </p>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">Últimas partidas</h2>
        <div className="flex flex-wrap gap-1.5">
          {recentResults.map((r, i) => (
            <span
              key={i}
              title={`${r.gameName} · ${r.points} pts`}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                r.isWinner ? "bg-teal/15 text-teal" : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {r.isWinner ? "🏆" : "•"}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">Por juego</h2>
        <div className="overflow-hidden rounded-2xl border-2 border-primary/10 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-primary/5 text-left text-primary-dark">
              <tr>
                <th className="px-4 py-2 font-semibold">Juego</th>
                <th className="px-4 py-2 font-semibold text-right">Partidas</th>
                <th className="px-4 py-2 font-semibold text-right">Victorias</th>
                <th className="px-4 py-2 font-semibold text-right">% Vict.</th>
                <th className="px-4 py-2 font-semibold text-right">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {gameBreakdown.map((g) => (
                <tr key={g.gameId} className="border-t border-neutral-100">
                  <td className="px-4 py-2 font-medium">{g.gameName}</td>
                  <td className="px-4 py-2 text-right">{g.sessions}</td>
                  <td className="px-4 py-2 text-right">{g.wins}</td>
                  <td className="px-4 py-2 text-right">{g.winRate}%</td>
                  <td className="px-4 py-2 text-right">{g.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border-2 border-primary/10 bg-white p-4 text-center">
      <p className="text-2xl font-bold text-primary-dark">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
      {sub && <p className="mt-0.5 text-xs font-medium text-neutral-400">{sub}</p>}
    </div>
  );
}
