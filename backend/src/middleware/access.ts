import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import * as access from '../services/access.js';

type AccessCheck = (user: NonNullable<AuthRequest['user']>, resourceId: string) => Promise<boolean>;

/**
 * Builds a route guard that resolves a resource id from req.params and defers to
 * the matching ownership check in services/access. Replaces role-based
 * authorize(...) on every resource route: what a user may touch follows from the
 * manager relations they hold, not from their role.
 */
const guard = (check: AccessCheck, param: string) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const resourceId = req.params[param];
    if (!resourceId) {
      res.status(400).json({ error: `Missing ${param}` });
      return;
    }
    try {
      if (!(await check(req.user, resourceId))) {
        res.status(403).json({ error: 'Not authorized to manage this resource' });
        return;
      }
      next();
    } catch (error) {
      console.error('Access check error:', error);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };

export const requireLeagueAccess = (param = 'id') => guard(access.canManageLeague, param);
export const requireSeasonAccess = (param = 'id') => guard(access.canManageSeason, param);
export const requireTeamAccess = (param = 'id') => guard(access.canManageTeam, param);
export const requireTeamAdmin = (param = 'id') => guard(access.canAdministerTeam, param);
export const requirePlayerAccess = (param = 'id') => guard(access.canManagePlayer, param);
export const requireGameAccess = (param = 'id') => guard(access.canManageGame, param);
export const requireMatchEventAccess = (param = 'id') => guard(access.canManageMatchEvent, param);
export const requireSeriesAccess = (param = 'id') => guard(access.canManageSeries, param);
export const requireTournamentAccess = (param = 'id') => guard(access.canManageTournament, param);
export const requireTournamentTeamAccess = (param = 'id') => guard(access.canManageTournamentTeam, param);
export const requireTournamentPlayerAccess = (param = 'id') => guard(access.canManageTournamentPlayer, param);
export const requireTournamentGroupAccess = (param = 'id') => guard(access.canManageTournamentGroup, param);
export const requireTournamentGameAccess = (param = 'id') => guard(access.canManageTournamentGame, param);
