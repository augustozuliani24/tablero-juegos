"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PlayerOverallStats } from "@/lib/database.types";

const TABS = [
  { key: "wins", label: "Victorias" },
  { key: "total_points", label: "Puntos" },
  { key: "combined_score", label: "Combinado" },
] as const;

type SortKey = (typeof TABS)[number]["key"];

export default function RankingPage() {
  const [stats, setStats] = useState<PlayerOverallStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("wins");

  useEffect(() => {
    supabase
      .from("player_overall_stats")
      .select("*")
      .then(({ data }) => {
        setStats(data ?? []);
        setLoading(false);
      });
  }, []);

  const sorted = [...stats].sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-primary-dark">🏆 Ranking general</h1>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSortKey(tab.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              sortKey === tab.key
                ? "bg-gradient-to-r from-primary to-pink text-white shadow-md shadow-primary/30"
                : "bg-white border-2 border-primary/15 text-neutral-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Cargando...</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía no hay partidas cargadas.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border-2 border-primary/10 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-primary/5 text-left text-primary-dark">
              <tr>
                <th className="px-4 py-2 font-semibold">#</th>
                <th className="px-4 py-2 font-semibold">Jugador</th>
                <th className="px-4 py-2 font-semibold text-right">Partidas</th>
                <th className="px-4 py-2 font-semibold text-right">Victorias</th>
                <th className="px-4 py-2 font-semibold text-right">Puntos</th>
                <th className="px-4 py-2 font-semibold text-right">Combinado</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.player_id} className="border-t border-neutral-100">
                  <td className="px-4 py-2 text-neutral-400">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td className="px-4 py-2 font-medium">{s.player_name}</td>
                  <td className="px-4 py-2 text-right">{s.sessions_played}</td>
                  <td className="px-4 py-2 text-right">{s.wins}</td>
                  <td className="px-4 py-2 text-right">{s.total_points}</td>
                  <td className="px-4 py-2 text-right">{s.combined_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-neutral-400">Combinado = victorias × 3 + puntos acumulados.</p>
    </div>
  );
}
