import { AuthUser } from '../types/index.js';
import { canManageTeam } from './access.js';

/**
 * What a logged-out visitor is allowed to see of a roster.
 *
 * A public league page exists to show who is playing, not to publish a squad
 * list. Amateur leagues include minors, so birth years, notes and the account a
 * player is linked to stay behind the team's own door. A name and a shirt
 * number are what a spectator needs to follow a game.
 *
 * Whoever manages the team - and the league manager above them - gets the whole
 * row, because they are the ones who typed it in.
 */
export interface PublicPlayer {
  id: string;
  name: string;
  number: number | null;
  teamId: string;
}

export const toPublicPlayer = (player: {
  id: string;
  name: string;
  number: number | null;
  teamId: string;
}): PublicPlayer => ({
  id: player.id,
  name: player.name,
  number: player.number,
  teamId: player.teamId,
});

/**
 * True when this viewer may see the full roster rather than the public view.
 * A missing user is a logged-out visitor, which is the common case on these
 * routes and must not throw.
 */
export const canSeeFullRoster = async (
  user: AuthUser | undefined,
  teamId: string
): Promise<boolean> => {
  if (!user) return false;
  return canManageTeam(user, teamId);
};

/**
 * A manager's contact details belong to the people running the competition, not
 * to the public page. The name stays - a league wants to say who runs a team -
 * the address does not.
 */
export const toPublicManager = (
  manager: { id: string; name: string; email: string } | null | undefined
): { id: string; name: string } | null =>
  manager ? { id: manager.id, name: manager.name } : null;
