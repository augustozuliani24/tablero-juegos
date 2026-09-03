"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchGroupMembers, fetchGroups, groupLabel } from "@/lib/groups";
import type { Game, GroupMember, Player, PlayerGroup } from "@/lib/database.types";

const SESSION_KEY = "tablero.isAdmin";
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "";

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupEmoji, setNewGroupEmoji] = useState("");
  const [groupError, setGroupError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") setUnlocked(true);
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: playersData }, { data: gamesData }, groupsData, membersData] = await Promise.all([
      supabase.from("players").select("*").order("name"),
      supabase.from("games").select("*").order("name"),
      fetchGroups(),
      fetchGroupMembers(),
    ]);
    setPlayers(playersData ?? []);
    setGames(gamesData ?? []);
    setGroups(groupsData);
    setGroupMembers(membersData);
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

    const { data: memberRows } = await supabase.from("team_members").select("team_id").eq("player_id", p.id);
    const affectedTeamIds = (memberRows ?? []).map((r) => r.team_id);

    await supabase.from("players").delete().eq("id", p.id);

    if (affectedTeamIds.length > 0) {
      const { data: remainingMembers } = await supabase
        .from("team_members")
        .select("team_id")
        .in("team_id", affectedTeamIds);
      const stillHasMembers = new Set((remainingMembers ?? []).map((r) => r.team_id));
      const emptyTeamIds = affectedTeamIds.filter((id) => !stillHasMembers.has(id));

      if (emptyTeamIds.length > 0) {
        const { data: emptyTeams } = await supabase.from("teams").select("id, session_id").in("id", emptyTeamIds);
        await supabase.from("teams").delete().in("id", emptyTeamIds);

        const affectedSessionIds = [...new Set((emptyTeams ?? []).map((t) => t.session_id))];
        if (affectedSessionIds.length > 0) {
          const { data: remainingTeams } = await supabase
            .from("teams")
            .select("session_id")
            .in("session_id", affectedSessionIds);
          const stillHasTeams = new Set((remainingTeams ?? []).map((t) => t.session_id));
          const emptySessionIds = affectedSessionIds.filter((id) => !stillHasTeams.has(id));
          if (emptySessionIds.length > 0) {
            await supabase.from("sessions").delete().in("id", emptySessionIds);
          }
        }
      }
    }

    await loadData();
    setBusyId(null);
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;
    setGroupError("");
    setBusyId("new-group");
    const { error: insertError } = await supabase
      .from("player_groups")
      .insert({ name, emoji: newGroupEmoji.trim() || null });
    setBusyId(null);
    if (insertError) {
      setGroupError("Ya existe un grupo con ese nombre.");
      return;
    }
    setNewGroupName("");
    setNewGroupEmoji("");
    await loadData();
  }

  async function renameGroup(g: PlayerGroup) {
    const name = prompt(`Nuevo nombre para "${g.name}":`, g.name)?.trim();
    if (!name || name === g.name) return;
    setBusyId(g.id);
    const { error: updateError } = await supabase.from("player_groups").update({ name }).eq("id", g.id);
    setBusyId(null);
    if (updateError) {
      setGroupError("Ya existe un grupo con ese nombre.");
      return;
    }
    await loadData();
  }

  async function deleteGroup(g: PlayerGroup) {
    if (
      !confirm(
        `¿Borrar el grupo "${g.name}"? Las partidas no se borran, pero quedan como "Sin grupo" y salen del ranking del grupo.`
      )
    )
      return;
    setBusyId(g.id);
    await supabase.from("player_groups").delete().eq("id", g.id);
    await loadData();
    setBusyId(null);
  }

  async function addMember(groupId: string, playerId: string) {
    setGroupMembers((prev) => [...prev, { group_id: groupId, player_id: playerId }]);
    await supabase.from("group_members").insert({ group_id: groupId, player_id: playerId });
  }

  async function removeMember(groupId: string, playerId: string) {
    setGroupMembers((prev) => prev.filter((m) => !(m.group_id === groupId && m.player_id === playerId)));
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("player_id", playerId);
  }

  async function deleteGame(g: Game) {
    if (!confirm(`¿Borrar "${g.name}"? Esto borra también todas sus partidas cargadas.`)) return;
    setBusyId(g.id);
    await supabase.from("games").delete().eq("id", g.id);
    await loadData();
    setBusyId(null);
  }

  async function clearGameHistory(g: Game) {
    if (
      !confirm(
        `¿Vaciar el historial de "${g.name}"? Esto borra todas sus partidas y estadísticas, pero el juego sigue existiendo.`
      )
    )
      return;
    setBusyId(`clear-${g.id}`);
    await supabase.from("sessions").delete().eq("game_id", g.id);
    await loadData();
    setBusyId(null);
  }

  function lockAdmin() {
    sessionStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
    setPassword("");
  }

  if (!unlocked) {
    return (
      <div className="space-y-4">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-primary transition-colors">
          ← Volver
        </Link>
        <div className="flex min-h-[60vh] items-center justify-center px-4">
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
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-primary transition-colors">
          ← Volver
        </Link>
        <button onClick={lockAdmin} className="text-sm font-medium text-neutral-400 hover:text-pink transition-colors">
          Cerrar sesión de admin
        </button>
      </div>
      <h1 className="text-2xl font-bold text-primary-dark">⚙️ Administrador</h1>

      {loading ? (
        <p className="text-sm text-neutral-500">Cargando...</p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-500">Grupos</h2>
            <p className="text-xs text-neutral-400">
              Cada partida se carga con un grupo. Si dos grupos se juntan a jugar, creá un grupo aparte para esa
              juntada (ej. “Pepas + Facu”): esas partidas van a tener su propio ranking.
            </p>

            <form onSubmit={createGroup} className="flex gap-2">
              <input
                value={newGroupEmoji}
                onChange={(e) => setNewGroupEmoji(e.target.value)}
                maxLength={2}
                placeholder="🎲"
                className="w-14 rounded-xl border-2 border-primary/10 px-2 py-2 text-center outline-none focus:border-primary"
              />
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nombre del grupo"
                className="flex-1 rounded-xl border-2 border-primary/10 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!newGroupName.trim() || busyId === "new-group"}
                className="shrink-0 rounded-xl bg-gradient-to-r from-primary to-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Crear
              </button>
            </form>
            {groupError && <p className="text-sm text-pink">{groupError}</p>}

            <div className="space-y-2">
              {groups.map((g) => {
                const memberIds = groupMembers.filter((m) => m.group_id === g.id).map((m) => m.player_id);
                const members = players.filter((p) => memberIds.includes(p.id));
                const nonMembers = players.filter((p) => !memberIds.includes(p.id));
                const expanded = expandedGroupId === g.id;
                return (
                  <div key={g.id} className="rounded-xl border-2 border-primary/10 bg-white px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        onClick={() => setExpandedGroupId(expanded ? null : g.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="truncate font-medium">{groupLabel(g)}</span>
                        <span className="shrink-0 text-xs text-neutral-400">
                          {members.length} {members.length === 1 ? "integrante" : "integrantes"} {expanded ? "▲" : "▼"}
                        </span>
                      </button>
                      <div className="flex shrink-0 gap-3">
                        <button
                          onClick={() => renameGroup(g)}
                          disabled={busyId === g.id}
                          className="text-sm font-medium text-accent hover:underline disabled:opacity-40"
                        >
                          Renombrar
                        </button>
                        <button
                          onClick={() => deleteGroup(g)}
                          disabled={busyId === g.id}
                          className="text-sm font-medium text-pink hover:underline disabled:opacity-40"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                        {members.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {members.map((p) => (
                              <span
                                key={p.id}
                                className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-dark"
                              >
                                {p.name}
                                <button
                                  onClick={() => removeMember(g.id, p.id)}
                                  className="text-primary-dark/50 hover:text-pink"
                                >
                                  ✕
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-neutral-400">
                            Todavía no tiene integrantes. Se van sumando solos cuando cargás una partida con este grupo.
                          </p>
                        )}
                        {nonMembers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {nonMembers.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => addMember(g.id, p.id)}
                                className="rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-xs text-neutral-500 hover:border-primary hover:text-primary transition-colors"
                              >
                                + {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {groups.length === 0 && <p className="text-sm text-neutral-400">Todavía no hay grupos creados.</p>}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-500">Juegos</h2>
            <div className="space-y-2">
              {games.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-primary/10 bg-white px-4 py-2.5">
                  <span className="font-medium">{g.name}</span>
                  <div className="flex shrink-0 gap-3">
                    <button
                      onClick={() => clearGameHistory(g)}
                      disabled={busyId === `clear-${g.id}`}
                      className="text-sm font-medium text-accent hover:underline disabled:opacity-40"
                    >
                      Vaciar historial
                    </button>
                    <button
                      onClick={() => deleteGame(g)}
                      disabled={busyId === g.id}
                      className="text-sm font-medium text-pink hover:underline disabled:opacity-40"
                    >
                      Borrar
                    </button>
                  </div>
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
