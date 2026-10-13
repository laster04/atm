import type { ManagerInvite } from '@types';

/** Where a team or league stands on having a manager, or a player on joining. */
export type ManagerState = 'ACTIVE' | 'INVITED' | 'EXPIRED' | 'NONE';

/**
 * A manager in place wins over any invite: an open invite to replace them is
 * shown next to it, but the team is still being run. For a player, pass the
 * linked account's id: once they have joined, the invite no longer matters.
 */
export function managerState(managerId: string | null | undefined, invite: ManagerInvite | undefined): ManagerState {
	if (managerId) return 'ACTIVE';
	if (invite?.status === 'PENDING') return 'INVITED';
	if (invite?.status === 'EXPIRED') return 'EXPIRED';
	return 'NONE';
}

/** The newest open invite per team, league or player, keyed by its id. */
export function invitesByTarget(invites: ManagerInvite[], key: 'teamId' | 'leagueId' | 'playerId'): Map<string, ManagerInvite> {
	const map = new Map<string, ManagerInvite>();
	[...invites]
		.sort((a, b) => b.sentAt.localeCompare(a.sentAt))
		.forEach((invite) => {
			const id = invite[key];
			if (id && !map.has(id)) map.set(id, invite);
		});
	return map;
}

/** "today", "yesterday", "3 days ago" in the UI language. */
export function sentAgo(iso: string, language: string): string {
	const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
	return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(days, 'day');
}
