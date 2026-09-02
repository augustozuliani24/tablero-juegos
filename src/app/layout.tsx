import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PlayerProvider } from "@/contexts/player-context";
import { PlayerGate } from "@/components/player-gate";
import { NavBar } from "@/components/nav-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tablero",
  description: "Ranking de juegos de mesa entre amigos",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-neutral-900">
        <PlayerProvider>
          <PlayerGate>
            <NavBar />
            <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">{children}</main>
          </PlayerGate>
        </PlayerProvider>
      </body>
    </html>
  );
}
