-- Rename tables to snake_case
ALTER TABLE "User" RENAME TO "users";
ALTER TABLE "League" RENAME TO "leagues";
ALTER TABLE "Season" RENAME TO "seasons";
ALTER TABLE "Team" RENAME TO "teams";
ALTER TABLE "Player" RENAME TO "players";
ALTER TABLE "Game" RENAME TO "games";
ALTER TABLE "GameStatistic" RENAME TO "game_statistics";

-- Rename columns in users table
ALTER TABLE "users" RENAME COLUMN "emailVerified" TO "email_verified";
ALTER TABLE "users" RENAME COLUMN "emailVerifiedAt" TO "email_verified_at";
ALTER TABLE "users" RENAME COLUMN "activationToken" TO "activation_token";
ALTER TABLE "users" RENAME COLUMN "activationTokenExpiresAt" TO "activation_token_expires_at";
ALTER TABLE "users" RENAME COLUMN "passwordResetToken" TO "password_reset_token";
ALTER TABLE "users" RENAME COLUMN "passwordResetTokenExpiresAt" TO "password_reset_token_expires_at";
ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "updated_at";

-- Rename columns in leagues table
ALTER TABLE "leagues" RENAME COLUMN "sportType" TO "sport_type";
ALTER TABLE "leagues" RENAME COLUMN "managerId" TO "manager_id";
ALTER TABLE "leagues" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "leagues" RENAME COLUMN "updatedAt" TO "updated_at";

-- Rename columns in seasons table
ALTER TABLE "seasons" RENAME COLUMN "startDate" TO "start_date";
ALTER TABLE "seasons" RENAME COLUMN "endDate" TO "end_date";
ALTER TABLE "seasons" RENAME COLUMN "leagueId" TO "league_id";
ALTER TABLE "seasons" RENAME COLUMN "managerId" TO "manager_id";
ALTER TABLE "seasons" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "seasons" RENAME COLUMN "updatedAt" TO "updated_at";

-- Rename columns in teams table
ALTER TABLE "teams" RENAME COLUMN "primaryColor" TO "primary_color";
ALTER TABLE "teams" RENAME COLUMN "seasonId" TO "season_id";
ALTER TABLE "teams" RENAME COLUMN "managerId" TO "manager_id";
ALTER TABLE "teams" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "teams" RENAME COLUMN "updatedAt" TO "updated_at";

-- Rename columns in players table
ALTER TABLE "players" RENAME COLUMN "bornYear" TO "born_year";
ALTER TABLE "players" RENAME COLUMN "teamId" TO "team_id";
ALTER TABLE "players" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "players" RENAME COLUMN "updatedAt" TO "updated_at";

-- Rename columns in games table
ALTER TABLE "games" RENAME COLUMN "homeScore" TO "home_score";
ALTER TABLE "games" RENAME COLUMN "awayScore" TO "away_score";
ALTER TABLE "games" RENAME COLUMN "seasonId" TO "season_id";
ALTER TABLE "games" RENAME COLUMN "homeTeamId" TO "home_team_id";
ALTER TABLE "games" RENAME COLUMN "awayTeamId" TO "away_team_id";
ALTER TABLE "games" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "games" RENAME COLUMN "updatedAt" TO "updated_at";

-- Rename columns in game_statistics table
ALTER TABLE "game_statistics" RENAME COLUMN "playerId" TO "player_id";
ALTER TABLE "game_statistics" RENAME COLUMN "gameId" TO "game_id";

-- Rename sequences
ALTER SEQUENCE "User_id_seq" RENAME TO "users_id_seq";
ALTER SEQUENCE "League_id_seq" RENAME TO "leagues_id_seq";
ALTER SEQUENCE "Season_id_seq" RENAME TO "seasons_id_seq";
ALTER SEQUENCE "Team_id_seq" RENAME TO "teams_id_seq";
ALTER SEQUENCE "Player_id_seq" RENAME TO "players_id_seq";
ALTER SEQUENCE "Game_id_seq" RENAME TO "games_id_seq";
ALTER SEQUENCE "GameStatistic_id_seq" RENAME TO "game_statistics_id_seq";
