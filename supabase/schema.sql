-- Esquema para "Tablero" (juegos de mesa con amigos)
-- Ejecutar en el SQL Editor de Supabase

create extension if not exists "pgcrypto";

create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  mode text not null default 'ffa' check (mode in ('ffa', 'teams')),
  created_by uuid references players(id) on delete set null,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  played_at timestamptz not null default now(),
  duration_minutes int,
  created_by uuid references players(id) on delete set null,
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  label text
);

create table team_members (
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (team_id, player_id)
);

create table scores (
  team_id uuid primary key references teams(id) on delete cascade,
  points int not null default 0,
  is_winner boolean not null default false
);

-- Vista: estadisticas por jugador y juego (para la tabla de cada juego)
create view player_game_stats as
select
  g.id as game_id,
  g.name as game_name,
  p.id as player_id,
  p.name as player_name,
  count(distinct s.id) as sessions_played,
  count(distinct s.id) filter (where sc.is_winner) as wins,
  coalesce(sum(sc.points), 0) as total_points
from players p
join team_members tm on tm.player_id = p.id
join teams t on t.id = tm.team_id
join sessions s on s.id = t.session_id
join games g on g.id = s.game_id
join scores sc on sc.team_id = t.id
group by g.id, g.name, p.id, p.name;

-- Vista: estadisticas generales por jugador (para el ranking general)
create view player_overall_stats as
select
  p.id as player_id,
  p.name as player_name,
  count(distinct s.id) as sessions_played,
  count(distinct s.id) filter (where sc.is_winner) as wins,
  coalesce(sum(sc.points), 0) as total_points,
  count(distinct s.id) filter (where sc.is_winner) * 3 + coalesce(sum(sc.points), 0) as combined_score
from players p
join team_members tm on tm.player_id = p.id
join teams t on t.id = tm.team_id
join sessions s on s.id = t.session_id
join scores sc on sc.team_id = t.id
group by p.id, p.name;

-- RLS abierta: no hay autenticacion, es un grupo de amigos de confianza
-- que solo elige su nombre. Cualquiera con el anon key puede leer y escribir.
alter table players enable row level security;
alter table games enable row level security;
alter table sessions enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table scores enable row level security;

create policy "public read players" on players for select using (true);
create policy "public insert players" on players for insert with check (true);
create policy "public delete players" on players for delete using (true);

create policy "public read games" on games for select using (true);
create policy "public insert games" on games for insert with check (true);
create policy "public delete games" on games for delete using (true);

create policy "public read sessions" on sessions for select using (true);
create policy "public insert sessions" on sessions for insert with check (true);
create policy "public delete sessions" on sessions for delete using (true);

create policy "public read teams" on teams for select using (true);
create policy "public insert teams" on teams for insert with check (true);
create policy "public delete teams" on teams for delete using (true);

create policy "public read team_members" on team_members for select using (true);
create policy "public insert team_members" on team_members for insert with check (true);
create policy "public delete team_members" on team_members for delete using (true);

create policy "public read scores" on scores for select using (true);
create policy "public insert scores" on scores for insert with check (true);
create policy "public delete scores" on scores for delete using (true);
