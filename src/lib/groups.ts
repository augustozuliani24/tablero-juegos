import { supabase } from "./supabase";
import type { GroupMember, PlayerGroup } from "./database.types";

// Valores especiales para los filtros de grupo de la UI
export const ALL_GROUPS = "__all__";
export const NO_GROUP = "__none__";

const LAST_GROUP_KEY = "tablero.lastGroupId";

export async function fetchGroups(): Promise<PlayerGroup[]> {
  const { data } = await supabase.from("player_groups").select("*").order("name");
  return data ?? [];
}

export async function fetchGroupMembers(): Promise<GroupMember[]> {
  const { data } = await supabase.from("group_members").select("group_id, player_id");
  return data ?? [];
}

/** Recuerda el último grupo con el que se cargó una partida, para preseleccionarlo. */
export function rememberGroup(groupId: string | null) {
  try {
    if (groupId) localStorage.setItem(LAST_GROUP_KEY, groupId);
    else localStorage.removeItem(LAST_GROUP_KEY);
  } catch {
    // localStorage puede fallar en modo incógnito: no es crítico
  }
}

export function recallGroup(): string | null {
  try {
    return localStorage.getItem(LAST_GROUP_KEY);
  } catch {
    return null;
  }
}

export function groupLabel(group: PlayerGroup) {
  return `${group.emoji ?? "👥"} ${group.name}`;
}
