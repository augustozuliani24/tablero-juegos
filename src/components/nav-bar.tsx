"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlayer } from "@/contexts/player-context";

const links = [
  { href: "/", label: "Juegos" },
  { href: "/ranking", label: "Ranking" },
];

export function NavBar() {
  const pathname = usePathname();
  const { player, logout } = usePlayer();

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="w-full max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <nav className="flex gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "font-semibold text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-900"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>{player?.name}</span>
          <button onClick={logout} className="hover:text-neutral-900">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
