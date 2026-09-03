"use client";

import type { PlayerGroup } from "@/lib/database.types";
import { ALL_GROUPS, NO_GROUP, groupLabel } from "@/lib/groups";

type Props = {
  groups: PlayerGroup[];
  value: string;
  onChange: (value: string) => void;
  /** Mostrar la opción "Sin grupo" (solo si hay partidas viejas sin asignar). */
  showNoGroup?: boolean;
};

export function GroupFilter({ groups, value, onChange, showNoGroup }: Props) {
  // Sin grupos creados no hay nada que filtrar
  if (groups.length === 0) return null;

  const options = [
    { key: ALL_GROUPS, label: "🌍 Todos" },
    ...groups.map((g) => ({ key: g.id, label: groupLabel(g) })),
    ...(showNoGroup ? [{ key: NO_GROUP, label: "Sin grupo" }] : []),
  ];

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((option) => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            value === option.key
              ? "bg-gradient-to-r from-primary to-pink text-white shadow-md shadow-primary/30"
              : "bg-white border-2 border-primary/15 text-neutral-600"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Filtra filas de las vistas de estadísticas según el grupo elegido. */
export function matchesGroupFilter(rowGroupId: string | null, filter: string) {
  if (filter === ALL_GROUPS) return true;
  if (filter === NO_GROUP) return rowGroupId === null;
  return rowGroupId === filter;
}
