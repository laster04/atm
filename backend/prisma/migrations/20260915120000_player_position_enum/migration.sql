-- Player positions become a fixed list per sport instead of free text.
--
-- Existing text is mapped where it clearly names a position, in Czech or
-- English, any case, with or without diacritics. translate() strips the Czech
-- diacritics first so the match does not depend on the database locale, which
-- decides whether lower() touches letters such as "Ú". Anything unrecognised
-- becomes NULL and has to be picked again from the list.

-- CreateEnum
CREATE TYPE "PlayerPosition" AS ENUM ('GOALIE', 'DEFENDER', 'MIDFIELDER', 'FORWARD', 'WING', 'BACK', 'PIVOT', 'GUARD', 'CENTER', 'SETTER', 'OUTSIDE_HITTER', 'OPPOSITE', 'MIDDLE_BLOCKER', 'LIBERO');

CREATE FUNCTION pg_temp.to_player_position(value TEXT) RETURNS "PlayerPosition" AS $$
  SELECT CASE lower(translate(trim(value), 'ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž', 'ACDEEINORSTUUYZacdeeinorstuuyz'))
    WHEN 'golman' THEN 'GOALIE'
    WHEN 'brankar' THEN 'GOALIE'
    WHEN 'goalie' THEN 'GOALIE'
    WHEN 'goalkeeper' THEN 'GOALIE'
    WHEN 'g' THEN 'GOALIE'
    WHEN 'obrance' THEN 'DEFENDER'
    WHEN 'defender' THEN 'DEFENDER'
    WHEN 'defence' THEN 'DEFENDER'
    WHEN 'defense' THEN 'DEFENDER'
    WHEN 'd' THEN 'DEFENDER'
    WHEN 'zaloznik' THEN 'MIDFIELDER'
    WHEN 'midfielder' THEN 'MIDFIELDER'
    WHEN 'utocnik' THEN 'FORWARD'
    WHEN 'forward' THEN 'FORWARD'
    WHEN 'attacker' THEN 'FORWARD'
    WHEN 'f' THEN 'FORWARD'
  END::"PlayerPosition"
$$ LANGUAGE SQL IMMUTABLE;

-- AlterTable
ALTER TABLE "players" ALTER COLUMN "position" TYPE "PlayerPosition" USING pg_temp.to_player_position("position");

-- AlterTable
ALTER TABLE "tournament_players" ALTER COLUMN "position" TYPE "PlayerPosition" USING pg_temp.to_player_position("position");
