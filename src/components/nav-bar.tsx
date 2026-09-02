"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlayer } from "@/contexts/player-context";

const links = [
  { href: "/", label: "🎲 Juegos" },
  { href: "/ranking", label: "🏆 Ranking" },
];

export function NavBar() {
  const pathname = usePathname();
  const { player, logout } = usePlayer();

  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-white/80 backdrop-blur">
      <div className="w-full max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <nav className="flex gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "font-semibold text-primary"
                  : "text-neutral-500 hover:text-primary transition-colors"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
            {player?.name}
          </span>
          <Link href="/admin" className="text-neutral-400 hover:text-neutral-700 transition-colors" title="Admin">
            ⚙️
          </Link>
          <button onClick={logout} className="text-neutral-400 hover:text-pink transition-colors">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
