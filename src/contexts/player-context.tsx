"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { Player } from "@/lib/database.types";

const STORAGE_KEY = "tablero.playerId";

type PlayerContextValue = {
  player: Player | null;
  loading: boolean;
  selectPlayer: (name: string) => Promise<void>;
  logout: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (!storedId) {
      setLoading(false);
      return;
    }
    supabase
      .from("players")
      .select("*")
      .eq("id", storedId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPlayer(data);
        else localStorage.removeItem(STORAGE_KEY);
        setLoading(false);
      });
  }, []);

  async function selectPlayer(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const { data: existing } = await supabase
      .from("players")
      .select("*")
      .ilike("name", trimmed)
      .maybeSingle();

    let resolved = existing;
    if (!resolved) {
      const { data: created, error } = await supabase
        .from("players")
        .insert({ name: trimmed })
        .select("*")
        .single();
      if (error) throw error;
      resolved = created;
    }

    localStorage.setItem(STORAGE_KEY, resolved.id);
    setPlayer(resolved);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setPlayer(null);
  }

  return (
    <PlayerContext.Provider value={{ player, loading, selectPlayer, logout }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer debe usarse dentro de PlayerProvider");
  return ctx;
}
