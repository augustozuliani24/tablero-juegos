-- Ejecutar en el SQL Editor de Supabase (despues del schema.sql y la migracion 002)
-- Agrega grupos de amigos: cada partida queda asociada a un grupo para poder
-- separar los rankings de cada grupo.

create table if not exists player_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text,
  created_by uuid references players(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid not null references player_groups(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (group_id, player_id)
);

-- Cada partida pertenece a un solo grupo. Las partidas viejas quedan en null
-- ("Sin grupo") hasta que alguien las reasigne.
alter table sessions add column if not exists group_id uuid references player_groups(id) on delete set null;

create index if not exists sessions_group_id_idx on sessions(group_id);

alter table player_groups enable row level security;
alter table group_members enable row level security;

drop policy if exists "public read player_groups" on player_groups;
drop policy if exists "public insert player_groups" on player_groups;
drop policy if exists "public update player_groups" on player_groups;
drop policy if exists "public delete player_groups" on player_groups;
create policy "public read player_groups" on player_groups for select using (true);
create policy "public insert player_groups" on player_groups for insert with check (true);
create policy "public update player_groups" on player_groups for update using (true) with check (true);
create policy "public delete player_groups" on player_groups for delete using (true);

drop policy if exists "public read group_members" on group_members;
drop policy if exists "public insert group_members" on group_members;
drop policy if exists "public delete group_members" on group_members;
create policy "public read group_members" on group_members for select using (true);
create policy "public insert group_members" on group_members for insert with check (true);
create policy "public delete group_members" on group_members for delete using (true);

-- Las partidas necesitan poder actualizarse para reasignar el grupo desde el admin
drop policy if exists "public update sessions" on sessions;
create policy "public update sessions" on sessions for update using (true) with check (true);

-- Las vistas ahora abren una fila por grupo. El front suma las filas cuando se
-- mira "Todos los grupos" y filtra cuando se elige uno.
drop view if exists player_game_stats;
create view player_game_stats as
select
  g.id as game_id,
  g.name as game_name,
  p.id as player_id,
  p.name as player_name,
  s.group_id as group_id,
  count(distinct s.id) as sessions_played,
  count(distinct s.id) filter (where sc.is_winner) as wins,
  coalesce(sum(sc.points), 0) as total_points
from players p
join team_members tm on tm.player_id = p.id
join teams t on t.id = tm.team_id
join sessions s on s.id = t.session_id
join games g on g.id = s.game_id
join scores sc on sc.team_id = t.id
group by g.id, g.name, p.id, p.name, s.group_id;

drop view if exists player_overall_stats;
create view player_overall_stats as
select
  p.id as player_id,
  p.name as player_name,
  s.group_id as group_id,
  count(distinct s.id) as sessions_played,
  count(distinct s.id) filter (where sc.is_winner) as wins,
  coalesce(sum(sc.points), 0) as total_points,
  count(distinct s.id) filter (where sc.is_winner) * 3 + coalesce(sum(sc.points), 0) as combined_score
from players p
join team_members tm on tm.player_id = p.id
join teams t on t.id = tm.team_id
join sessions s on s.id = t.session_id
join scores sc on sc.team_id = t.id
group by p.id, p.name, s.group_id;
