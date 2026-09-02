"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePlayer } from "@/contexts/player-context";
import type { Player } from "@/lib/database.types";

type Participant = {
  playerId: string;
  playerName: string;
  team: string;
};

export function LogSessionForm({ gameId, onLogged }: { gameId: string; onLogged: () => void }) {
  const { player } = usePlayer();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [duration, setDuration] = useState("");
  const [points, setPoints] = useState<Record<string, string>>({});
  const [winners, setWinners] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("players")
      .select("*")
      .order("name")
      .then(({ data }) => setAllPlayers(data ?? []));
  }, []);

  function addParticipant(p: Player) {
    if (participants.some((x) => x.playerId === p.id)) return;
    setParticipants([...participants, { playerId: p.id, playerName: p.name, team: p.name }]);
  }

  async function addNewPlayer() {
    const name = newPlayerName.trim();
    if (!name) return;
    const { data: existing } = await supabase.from("players").select("*").ilike("name", name).maybeSingle();
    let p = existing;
    if (!p) {
      const { data: created, error } = await supabase.from("players").insert({ name }).select("*").single();
      if (error) return;
      p = created;
    }
    setAllPlayers((prev) => (prev.some((x) => x.id === p!.id) ? prev : [...prev, p!]));
    addParticipant(p);
    setNewPlayerName("");
  }

  function removeParticipant(playerId: string) {
    setParticipants(participants.filter((x) => x.playerId !== playerId));
  }

  function updateTeam(playerId: string, team: string) {
    setParticipants(participants.map((x) => (x.playerId === playerId ? { ...x, team } : x)));
  }

  const teams = useMemo(() => {
    const map = new Map<string, Participant[]>();
    for (const p of participants) {
      const label = p.team.trim() || p.playerName;
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(p);
    }
    return Array.from(map.entries());
  }, [participants]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (participants.length === 0) {
      setError("Agregá al menos un jugador.");
      return;
    }
    setSaving(true);
    try {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          game_id: gameId,
          duration_minutes: duration ? Number(duration) : null,
          created_by: player?.id ?? null,
        })
        .select("*")
        .single();
      if (sessionError) throw sessionError;

      for (const [label, members] of teams) {
        const { data: team, error: teamError } = await supabase
          .from("teams")
          .insert({ session_id: session.id, label })
          .select("*")
          .single();
        if (teamError) throw teamError;

        const { error: membersError } = await supabase
          .from("team_members")
          .insert(members.map((m) => ({ team_id: team.id, player_id: m.playerId })));
        if (membersError) throw membersError;

        const { error: scoreError } = await supabase.from("scores").insert({
          team_id: team.id,
          points: Number(points[label] ?? 0) || 0,
          is_winner: Boolean(winners[label]),
        });
        if (scoreError) throw scoreError;
      }

      setParticipants([]);
      setPoints({});
      setWinners({});
      setDuration("");
      onLogged();
    } catch {
      setError("No se pudo guardar la partida. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const availablePlayers = allPlayers.filter((p) => !participants.some((x) => x.playerId === p.id));

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-4">
      <div>
        <p className="mb-2 text-sm font-medium">Jugadores</p>
        {availablePlayers.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {availablePlayers.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => addParticipant(p)}
                className="rounded-full border border-neutral-300 px-3 py-1 text-sm hover:border-neutral-500"
              >
                + {p.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Nombre de un jugador nuevo"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
          />
          <button
            type="button"
            onClick={addNewPlayer}
            disabled={!newPlayerName.trim()}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Agregar
          </button>
        </div>
      </div>

      {participants.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Equipo de cada jugador{" "}
            <span className="font-normal text-neutral-400">
              (poné el mismo nombre de equipo a quienes juegan juntos; si es todos contra todos, dejalo como está)
            </span>
          </p>
          {participants.map((p) => (
            <div key={p.playerId} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm">{p.playerName}</span>
              <input
                value={p.team}
                onChange={(e) => updateTeam(p.playerId, e.target.value)}
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
              />
              <button
                type="button"
                onClick={() => removeParticipant(p.playerId)}
                className="text-sm text-neutral-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {teams.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Puntos por equipo</p>
          {teams.map(([label, members]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate text-sm">
                {label}
                <span className="text-neutral-400"> ({members.map((m) => m.playerName).join(", ")})</span>
              </span>
              <input
                type="number"
                value={points[label] ?? ""}
                onChange={(e) => setPoints({ ...points, [label]: e.target.value })}
                placeholder="Puntos"
                className="w-24 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
              />
              <label className="flex items-center gap-1 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={Boolean(winners[label])}
                  onChange={(e) => setWinners({ ...winners, [label]: e.target.checked })}
                />
                Ganador
              </label>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="text-sm text-neutral-500">Duración (min)</label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-24 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving || participants.length === 0}
        className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-40"
      >
        {saving ? "Guardando..." : "Guardar partida"}
      </button>
    </form>
  );
}
