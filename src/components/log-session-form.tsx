"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayer } from "@/contexts/player-context";
import { fetchGroupMembers, fetchGroups, groupLabel, recallGroup, rememberGroup } from "@/lib/groups";
import type { GameMode, GroupMember, Player, PlayerGroup } from "@/lib/database.types";

type FfaEntry = {
  playerId: string;
  playerName: string;
  points: string;
};

type TeamEntry = {
  id: string;
  name: string;
  playerIds: string[];
  points: string;
};

let uid = 0;
const nextId = () => `t${Date.now()}${uid++}`;

export function LogSessionForm({ gameId, mode, onLogged }: { gameId: string; mode: GameMode; onLogged: () => void }) {
  const { player } = usePlayer();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [ffaEntries, setFfaEntries] = useState<FfaEntry[]>([]);
  const [teams, setTeams] = useState<TeamEntry[]>([
    { id: nextId(), name: "Equipo 1", playerIds: [], points: "" },
    { id: nextId(), name: "Equipo 2", playerIds: [], points: "" },
  ]);
  const [newPlayerName, setNewPlayerName] = useState("");

  useEffect(() => {
    supabase
      .from("players")
      .select("*")
      .order("name")
      .then(({ data }) => setAllPlayers(data ?? []));
  }, []);

  useEffect(() => {
    Promise.all([fetchGroups(), fetchGroupMembers()]).then(([groupsData, membersData]) => {
      setGroups(groupsData);
      setGroupMembers(membersData);

      // Preseleccionamos el último grupo usado (o el único que haya) para que
      // cargar una partida siga siendo un par de toques.
      const remembered = recallGroup();
      if (remembered && groupsData.some((g) => g.id === remembered)) setSelectedGroupId(remembered);
      else if (groupsData.length === 1) setSelectedGroupId(groupsData[0].id);
    });
  }, []);

  async function ensurePlayer(name: string): Promise<Player | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { data: existing } = await supabase.from("players").select("*").ilike("name", trimmed).maybeSingle();
    if (existing) return existing;
    const { data: created, error } = await supabase.from("players").insert({ name: trimmed }).select("*").single();
    if (error) return null;
    return created;
  }

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    setCreatingGroup(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("player_groups")
      .insert({ name, created_by: player?.id ?? null })
      .select("*")
      .single();
    setCreatingGroup(false);
    if (insertError || !data) {
      setError("Ya existe un grupo con ese nombre.");
      return;
    }
    setGroups((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedGroupId(data.id);
    setNewGroupName("");
  }

  const usedPlayerIds =
    mode === "ffa" ? ffaEntries.map((e) => e.playerId) : teams.flatMap((t) => t.playerIds);
  const availablePlayers = allPlayers.filter((p) => !usedPlayerIds.includes(p.id));

  const selectedGroupMemberIds = useMemo(
    () => new Set(groupMembers.filter((m) => m.group_id === selectedGroupId).map((m) => m.player_id)),
    [groupMembers, selectedGroupId]
  );

  // Con un grupo elegido mostramos primero a sus integrantes; el resto queda
  // detrás de un botón para no llenar la pantalla de nombres.
  const suggestedPlayers =
    selectedGroupId && !showAllPlayers
      ? availablePlayers.filter((p) => selectedGroupMemberIds.has(p.id))
      : availablePlayers;
  const hiddenPlayersCount = availablePlayers.length - suggestedPlayers.length;

  function addExistingPlayer(p: Player, teamId?: string) {
    if (mode === "ffa") {
      setFfaEntries((prev) => [...prev, { playerId: p.id, playerName: p.name, points: "" }]);
    } else if (teamId) {
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, playerIds: [...t.playerIds, p.id] } : t))
      );
      setAllPlayers((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
    }
  }

  async function addNewPlayer(teamId?: string) {
    const name = newPlayerName.trim();
    if (!name) return;
    const p = await ensurePlayer(name);
    if (!p) return;
    setAllPlayers((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
    addExistingPlayer(p, teamId);
    setNewPlayerName("");
  }

  function removeFfaEntry(playerId: string) {
    setFfaEntries((prev) => prev.filter((e) => e.playerId !== playerId));
  }

  function updateFfaEntry(playerId: string, patch: Partial<FfaEntry>) {
    setFfaEntries((prev) => prev.map((e) => (e.playerId === playerId ? { ...e, ...patch } : e)));
  }

  function addTeam() {
    setTeams((prev) => [...prev, { id: nextId(), name: `Equipo ${prev.length + 1}`, playerIds: [], points: "" }]);
  }

  function removeTeam(teamId: string) {
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  }

  function updateTeam(teamId: string, patch: Partial<TeamEntry>) {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, ...patch } : t)));
  }

  function removePlayerFromTeam(teamId: string, playerId: string) {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, playerIds: t.playerIds.filter((id) => id !== playerId) } : t))
    );
  }

  function playerName(id: string) {
    return allPlayers.find((p) => p.id === id)?.name ?? "?";
  }

  /** Suma al grupo a los que jugaron y todavía no eran integrantes. */
  async function syncGroupMembers(groupId: string, playerIds: string[]) {
    const nuevos = playerIds.filter((id) => !selectedGroupMemberIds.has(id));
    if (nuevos.length === 0) return;
    const rows = nuevos.map((playerId) => ({ group_id: groupId, player_id: playerId }));
    const { error: membersError } = await supabase
      .from("group_members")
      .upsert(rows, { onConflict: "group_id,player_id", ignoreDuplicates: true });
    if (!membersError) setGroupMembers((prev) => [...prev, ...rows]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const rawGroups =
      mode === "ffa"
        ? ffaEntries.map((e) => ({ name: e.playerName, playerIds: [e.playerId], points: e.points }))
        : teams
            .filter((t) => t.playerIds.length > 0)
            .map((t) => ({ name: t.name, playerIds: t.playerIds, points: t.points }));

    if (rawGroups.length === 0) {
      setError(mode === "ffa" ? "Agregá al menos un jugador." : "Agregá al menos un equipo con jugadores.");
      return;
    }

    const numericPoints = rawGroups.map((g) => Number(g.points) || 0);
    const maxPoints = Math.max(...numericPoints);
    const groupsToSave = rawGroups.map((g, i) => ({ ...g, winner: maxPoints > 0 && numericPoints[i] === maxPoints }));

    setSaving(true);
    try {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          game_id: gameId,
          group_id: selectedGroupId,
          duration_minutes: duration ? Number(duration) : null,
          created_by: player?.id ?? null,
        })
        .select("*")
        .single();
      if (sessionError) throw sessionError;

      for (const group of groupsToSave) {
        const { data: team, error: teamError } = await supabase
          .from("teams")
          .insert({ session_id: session.id, label: group.name })
          .select("*")
          .single();
        if (teamError) throw teamError;

        const { error: membersError } = await supabase
          .from("team_members")
          .insert(group.playerIds.map((playerId) => ({ team_id: team.id, player_id: playerId })));
        if (membersError) throw membersError;

        const { error: scoreError } = await supabase.from("scores").insert({
          team_id: team.id,
          points: Number(group.points) || 0,
          is_winner: Boolean(group.winner),
        });
        if (scoreError) throw scoreError;
      }

      if (selectedGroupId) {
        await syncGroupMembers(selectedGroupId, groupsToSave.flatMap((g) => g.playerIds));
        rememberGroup(selectedGroupId);
      }

      setFfaEntries([]);
      setTeams([
        { id: nextId(), name: "Equipo 1", playerIds: [] , points: "" },
        { id: nextId(), name: "Equipo 2", playerIds: [], points: "" },
      ]);
      setDuration("");
      onLogged();
    } catch {
      setError("No se pudo guardar la partida. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="animate-float-in space-y-5 rounded-2xl border-2 border-primary/10 bg-white p-4 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary-dark">¿Qué grupo jugó?</p>
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <button
              type="button"
              key={g.id}
              onClick={() => {
                setSelectedGroupId(g.id);
                setShowAllPlayers(false);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                selectedGroupId === g.id
                  ? "bg-gradient-to-r from-primary to-pink text-white shadow-md shadow-primary/30"
                  : "border-2 border-primary/20 text-neutral-600 hover:border-primary"
              }`}
            >
              {groupLabel(g)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSelectedGroupId(null);
              setShowAllPlayers(false);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              selectedGroupId === null
                ? "bg-neutral-700 text-white"
                : "border-2 border-neutral-200 text-neutral-500 hover:border-neutral-400"
            }`}
          >
            Sin grupo
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Crear un grupo nuevo (ej. Pepas)"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={createGroup}
            disabled={!newGroupName.trim() || creatingGroup}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Crear
          </button>
        </div>
        <p className="text-xs text-neutral-400">
          Si dos grupos se juntan a jugar, creá un grupo aparte para esa juntada (ej. “Pepas + Facu”) y esas partidas
          van a tener su propio ranking.
        </p>
      </div>

      <div className="border-t border-neutral-100 pt-4">
      {mode === "ffa" ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-primary-dark">Jugadores</p>
          {suggestedPlayers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestedPlayers.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => addExistingPlayer(p)}
                  className="rounded-full border-2 border-primary/20 px-3 py-1 text-sm hover:border-primary transition-colors"
                >
                  + {p.name}
                </button>
              ))}
            </div>
          )}
          {hiddenPlayersCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllPlayers(true)}
              className="text-xs font-medium text-primary hover:underline"
            >
              + Mostrar otros jugadores ({hiddenPlayersCount})
            </button>
          )}
          <div className="flex gap-2">
            <input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Nombre de un jugador nuevo"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => addNewPlayer()}
              disabled={!newPlayerName.trim()}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Agregar
            </button>
          </div>

          {ffaEntries.length > 0 && (
            <div className="space-y-2 pt-2">
              {ffaEntries.map((e) => (
                <div key={e.playerId} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate text-sm font-medium">{e.playerName}</span>
                  <input
                    type="number"
                    value={e.points}
                    onChange={(ev) => updateFfaEntry(e.playerId, { points: ev.target.value })}
                    placeholder="Puntos"
                    className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removeFfaEntry(e.playerId)}
                    className="ml-auto text-neutral-400 hover:text-pink"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-primary-dark">Equipos</p>
          {teams.map((team) => (
            <div key={team.id} className="rounded-xl border-2 border-primary/10 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={team.name}
                  onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                  className="flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm font-semibold outline-none focus:border-primary"
                />
                <input
                  type="number"
                  value={team.points}
                  onChange={(e) => updateTeam(team.id, { points: e.target.value })}
                  placeholder="Puntos"
                  className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
                {teams.length > 2 && (
                  <button type="button" onClick={() => removeTeam(team.id)} className="text-neutral-400 hover:text-pink">
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {team.playerIds.map((id) => (
                  <span key={id} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-dark">
                    {playerName(id)}
                    <button type="button" onClick={() => removePlayerFromTeam(team.id, id)} className="text-primary-dark/50 hover:text-pink">
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              {suggestedPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestedPlayers.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => addExistingPlayer(p, team.id)}
                      className="rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-xs text-neutral-500 hover:border-primary hover:text-primary transition-colors"
                    >
                      + {p.name}
                    </button>
                  ))}
                </div>
              )}
              {hiddenPlayersCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllPlayers(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  + Mostrar otros jugadores ({hiddenPlayersCount})
                </button>
              )}

              <div className="flex gap-2">
                <input
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Nombre nuevo para este equipo"
                  className="flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => addNewPlayer(team.id)}
                  disabled={!newPlayerName.trim()}
                  className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  Agregar
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addTeam}
            className="w-full rounded-xl border-2 border-dashed border-primary/30 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            + Agregar equipo
          </button>
        </div>
      )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-neutral-500">Duración (min)</label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-24 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
      </div>

      <p className="text-xs text-neutral-400">🏆 El ganador se calcula solo, comparando los puntos que cargues.</p>

      {error && <p className="text-sm text-pink">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-gradient-to-r from-primary to-pink px-4 py-2.5 font-semibold text-white shadow-md shadow-primary/30 transition active:scale-95 disabled:opacity-40"
      >
        {saving ? "Guardando..." : "Guardar partida"}
      </button>
    </form>
  );
}
