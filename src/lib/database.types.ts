export type Player = {
  id: string;
  name: string;
  created_at: string;
};

export type GameMode = "ffa" | "teams";

export type Game = {
  id: string;
  name: string;
  mode: GameMode;
  created_by: string | null;
  created_at: string;
};

export type Session = {
  id: string;
  game_id: string;
  played_at: string;
  duration_minutes: number | null;
  created_by: string | null;
  created_at: string;
};

export type Team = {
  id: string;
  session_id: string;
  label: string | null;
};

export type TeamMember = {
  team_id: string;
  player_id: string;
};

export type Score = {
  team_id: string;
  points: number;
  is_winner: boolean;
};

export type PlayerGameStats = {
  game_id: string;
  game_name: string;
  player_id: string;
  player_name: string;
  sessions_played: number;
  wins: number;
  total_points: number;
};

export type PlayerOverallStats = {
  player_id: string;
  player_name: string;
  sessions_played: number;
  wins: number;
  total_points: number;
  combined_score: number;
};

export type Database = {
  public: {
    Tables: {
      players: { Row: Player; Insert: Partial<Player>; Update: Partial<Player> };
      games: { Row: Game; Insert: Partial<Game>; Update: Partial<Game> };
      sessions: { Row: Session; Insert: Partial<Session>; Update: Partial<Session> };
      teams: { Row: Team; Insert: Partial<Team>; Update: Partial<Team> };
      team_members: { Row: TeamMember; Insert: Partial<TeamMember>; Update: Partial<TeamMember> };
      scores: { Row: Score; Insert: Partial<Score>; Update: Partial<Score> };
    };
    Views: {
      player_game_stats: { Row: PlayerGameStats };
      player_overall_stats: { Row: PlayerOverallStats };
    };
  };
};
