-- Ejecutar en el SQL Editor de Supabase (además del schema.sql original)

-- Modo de juego: todos contra todos o por equipos, definido al crear el juego
alter table games add column if not exists mode text not null default 'ffa' check (mode in ('ffa', 'teams'));

-- Permitir borrar jugadores y juegos (para el panel de administrador)
create policy "public delete players" on players for delete using (true);
create policy "public delete games" on games for delete using (true);
create policy "public delete teams" on teams for delete using (true);
create policy "public delete team_members" on team_members for delete using (true);
create policy "public delete scores" on scores for delete using (true);
