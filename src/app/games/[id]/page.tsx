"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LogSessionForm } from "@/components/log-session-form";
import { GroupFilter, matchesGroupFilter } from "@/components/group-filter";
import { ALL_GROUPS, fetchGroups, groupLabel, recallGroup } from "@/lib/groups";
import type { Game, PlayerGameStats, PlayerGroup } from "@/lib/database.types";

type SessionRow = {
  id: string;
  played_at: string;
  duration_minutes: number | null;
  group_id: string | null;
  teams: {
    id: string;
    label: string | null;
    points: number;
    is_winner: boolean;
    members: string[];
  }[];
};

type AggregatedGameStats = {
  player_id: string;
  player_name: string;
  sessions_played: number;
  wins: number;
  total_points: number;
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
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>(ALL_GROUPS);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const initialGroupApplied = useRef(false);

  const HISTORY_PREVIEW_COUNT = 3;
  const CONDENSED_THRESHOLD = 15;

  const loadAll = useCallback(async () => {
    const [{ data: gameData }, { data: statsData }, { data: sessionsData }, groupsData] = await Promise.all([
      supabase.from("games").select("*").eq("id", gameId).single(),
      supabase.from("player_game_stats").select("*").eq("game_id", gameId),
      supabase
        .from("sessions")
        .select(
          "id, played_at, duration_minutes, group_id, teams(id, label, scores(points, is_winner), team_members(players(name)))"
        )
        .eq("game_id", gameId)
        .order("played_at", { ascending: false }),
      fetchGroups(),
    ]);

    setGame(gameData ?? null);
    setStats(statsData ?? []);
    setGroups(groupsData);

    // Solo la primera vez: arrancamos en el último grupo con el que se cargó
    // una partida, sin pisar el filtro si ya lo cambiaron a mano.
    if (!initialGroupApplied.current) {
      initialGroupApplied.current = true;
      const remembered = recallGroup();
      if (remembered && groupsData.some((g) => g.id === remembered)) setGroupFilter(remembered);
    }

    setSessions(
      (sessionsData ?? []).map((s: any) => ({
        id: s.id,
        played_at: s.played_at,
        duration_minutes: s.duration_minutes,
        group_id: s.group_id ?? null,
        teams: (s.teams ?? [])
          .map((t: any) => ({
            id: t.id,
            label: t.label,
            points: t.scores?.points ?? 0,
            is_winner: t.scores?.is_winner ?? false,
            members: (t.team_members ?? []).map((tm: any) => tm.players?.name).filter(Boolean),
          }))
          .sort((a: any, b: any) => b.points - a.points),
      }))
    );
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const hasUngrouped = sessions.some((s) => s.group_id === null);

  // La vista trae una fila por jugador y grupo: sumamos según el filtro elegido.
  const visibleStats = useMemo(() => {
    const byPlayer = new Map<string, AggregatedGameStats>();
    for (const row of stats) {
      if (!matchesGroupFilter(row.group_id, groupFilter)) continue;
      const acc = byPlayer.get(row.player_id) ?? {
        player_id: row.player_id,
        player_name: row.player_name,
        sessions_played: 0,
        wins: 0,
        total_points: 0,
      };
      acc.sessions_played += row.sessions_played;
      acc.wins += row.wins;
      acc.total_points += row.total_points;
      byPlayer.set(row.player_id, acc);
    }
    return Array.from(byPlayer.values()).sort((a, b) => b.wins - a.wins || b.total_points - a.total_points);
  }, [stats, groupFilter]);

  const visibleSessions = useMemo(
    () => sessions.filter((s) => matchesGroupFilter(s.group_id, groupFilter)),
    [sessions, groupFilter]
  );

  const groupNameById = useMemo(() => new Map(groups.map((g) => [g.id, groupLabel(g)])), [groups]);

  /** Permite asignarle un grupo a una partida vieja que quedó sin grupo. */
  async function assignGroup(sessionId: string, groupId: string) {
    if (!groupId) return;
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, group_id: groupId } : s)));
    await supabase.from("sessions").update({ group_id: groupId }).eq("id", sessionId);
    loadAll();
  }

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

      <GroupFilter groups={groups} value={groupFilter} onChange={setGroupFilter} showNoGroup={hasUngrouped} />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">Tabla del juego</h2>
        {visibleStats.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {groupFilter === ALL_GROUPS
              ? "Todavía no hay partidas registradas."
              : "Este grupo todavía no jugó a este juego."}
          </p>
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
                {visibleStats.map((s) => (
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
        {visibleSessions.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {groupFilter === ALL_GROUPS ? "Sin partidas todavía." : "Este grupo todavía no jugó a este juego."}
          </p>
        ) : (
          <div className="space-y-3">
            {(showAllHistory ? visibleSessions : visibleSessions.slice(0, HISTORY_PREVIEW_COUNT)).map((s, i) => {
              const condensed = visibleSessions.length > CONDENSED_THRESHOLD && i >= HISTORY_PREVIEW_COUNT;
              const winners = s.teams.filter((t) => t.is_winner);
              return (
                <div key={s.id} className="rounded-2xl border-2 border-primary/10 bg-white p-3 text-sm">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-neutral-400">
                    <span>{new Date(s.played_at).toLocaleString("es-AR")}</span>
                    <div className="flex items-center gap-2">
                      {s.group_id && groupNameById.has(s.group_id) ? (
                        groupFilter === ALL_GROUPS && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-dark">
                            {groupNameById.get(s.group_id)}
                          </span>
                        )
                      ) : (
                        groups.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => assignGroup(s.id, e.target.value)}
                            className="rounded-full border border-dashed border-neutral-300 bg-transparent px-2 py-0.5 text-xs text-neutral-500 outline-none focus:border-primary"
                          >
                            <option value="">Asignar grupo…</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {groupLabel(g)}
                              </option>
                            ))}
                          </select>
                        )
                      )}
                      {!condensed && s.duration_minutes && <span>{s.duration_minutes} min</span>}
                    </div>
                  </div>
                  {condensed ? (
                    <div className="space-y-1">
                      {winners.map((t) => (
                        <div key={t.id} className="flex justify-between">
                          <span className="font-semibold text-primary-dark">🏆 {t.members.join(", ")}</span>
                          <span className="text-neutral-500">{t.points} pts</span>
                        </div>
                      ))}
                    </div>
                  ) : (
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
                  )}
                </div>
              );
            })}
            {!showAllHistory && visibleSessions.length > HISTORY_PREVIEW_COUNT && (
              <button
                onClick={() => setShowAllHistory(true)}
                className="w-full rounded-xl border-2 border-dashed border-primary/30 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
              >
                Ver más ({visibleSessions.length - HISTORY_PREVIEW_COUNT} más)
              </button>
            )}
            {showAllHistory && visibleSessions.length > HISTORY_PREVIEW_COUNT && (
              <button
                onClick={() => setShowAllHistory(false)}
                className="w-full rounded-xl border-2 border-dashed border-neutral-200 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-50 transition-colors"
              >
                Ver menos
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
