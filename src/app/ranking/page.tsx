"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GroupFilter, matchesGroupFilter } from "@/components/group-filter";
import { ALL_GROUPS, fetchGroups, recallGroup } from "@/lib/groups";
import type { PlayerGroup, PlayerOverallStats } from "@/lib/database.types";

const TABS = [
  { key: "wins", label: "Victorias" },
  { key: "total_points", label: "Puntos" },
  { key: "combined_score", label: "Combinado" },
] as const;

type SortKey = (typeof TABS)[number]["key"];

type AggregatedStats = {
  player_id: string;
  player_name: string;
  sessions_played: number;
  wins: number;
  total_points: number;
  combined_score: number;
};

export default function RankingPage() {
  const [stats, setStats] = useState<PlayerOverallStats[]>([]);
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("wins");
  const [groupFilter, setGroupFilter] = useState<string>(ALL_GROUPS);

  useEffect(() => {
    Promise.all([
      supabase.from("player_overall_stats").select("*"),
      fetchGroups(),
    ]).then(([{ data }, groupsData]) => {
      setStats(data ?? []);
      setGroups(groupsData);

      // Arrancamos en el último grupo con el que cargaron una partida
      const remembered = recallGroup();
      if (remembered && groupsData.some((g) => g.id === remembered)) setGroupFilter(remembered);

      setLoading(false);
    });
  }, []);

  const hasUngrouped = stats.some((s) => s.group_id === null);

  // Las vistas traen una fila por jugador y grupo: acá las sumamos según el filtro.
  const sorted = useMemo(() => {
    const byPlayer = new Map<string, AggregatedStats>();
    for (const row of stats) {
      if (!matchesGroupFilter(row.group_id, groupFilter)) continue;
      const acc = byPlayer.get(row.player_id) ?? {
        player_id: row.player_id,
        player_name: row.player_name,
        sessions_played: 0,
        wins: 0,
        total_points: 0,
        combined_score: 0,
      };
      acc.sessions_played += row.sessions_played;
      acc.wins += row.wins;
      acc.total_points += row.total_points;
      acc.combined_score += row.combined_score;
      byPlayer.set(row.player_id, acc);
    }
    return Array.from(byPlayer.values()).sort((a, b) => b[sortKey] - a[sortKey]);
  }, [stats, groupFilter, sortKey]);

  const activeGroup = groups.find((g) => g.id === groupFilter);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">🏆 Ranking general</h1>
        {activeGroup && <p className="text-sm text-neutral-500">Solo partidas de {activeGroup.name}</p>}
      </div>

      <GroupFilter groups={groups} value={groupFilter} onChange={setGroupFilter} showNoGroup={hasUngrouped} />

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
        <p className="text-sm text-neutral-500">
          {groupFilter === ALL_GROUPS
            ? "Todavía no hay partidas cargadas."
            : "Este grupo todavía no tiene partidas cargadas."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-primary/10 bg-white">
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
